import duckdb from "duckdb";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default local Parquet path (repo root data/parquet). */
export const DEFAULT_LOCAL_PARQUET = path.resolve(
  __dirname,
  "../../../../data/parquet/parcels_enriched_api.parquet",
);

export interface DuckDbClient {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  count(sql: string, params?: unknown[]): Promise<number>;
  close(): Promise<void>;
}

export interface DuckDbClientConfig {
  /** s3:// URI or local filesystem path to parcels_enriched_api.parquet */
  parquetSource: string;
  s3Region?: string;
}

type DuckDbConnection = duckdb.Connection;

function run(conn: DuckDbConnection, sql: string, ...params: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, ...params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function all<T extends Record<string, unknown>>(
  conn: DuckDbConnection,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows ?? []) as T[]);
    });
  });
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Escape `%`, `_`, and `\` for use in parameterized LIKE … ESCAPE '\\' patterns. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

export function getParquetSource(): string {
  return (
    process.env.PARQUET_SOURCE ??
    process.env.PARQUET_S3_URI ??
    DEFAULT_LOCAL_PARQUET
  );
}

/** @deprecated Use getParquetSource() */
export function getParquetS3Uri(): string {
  return getParquetSource();
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    // DuckDB TIMESTAMP columns come back as JS Date; keep them as ISO strings so
    // the generic-object branch below doesn't flatten them to {} (React can't render a Date).
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeValue(v)]),
    );
  }
  return value;
}

function normalizeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => normalizeValue(row) as T);
}

async function initializeView(conn: DuckDbConnection, config: DuckDbClientConfig): Promise<void> {
  const source = config.parquetSource;
  const isS3 = source.startsWith("s3://");

  if (isS3) {
    const region = config.s3Region ?? "us-east-2";
    await run(conn, "INSTALL httpfs;");
    await run(conn, "LOAD httpfs;");
    await run(conn, "CREATE SECRET IF NOT EXISTS (TYPE S3, PROVIDER credential_chain);");
    await run(conn, `SET s3_region='${escapeSqlString(region)}';`);
  }

  const parquetRef = isS3
    ? `'${escapeSqlString(source)}'`
    : `'${escapeSqlString(path.resolve(source))}'`;

  await run(
    conn,
    `CREATE OR REPLACE VIEW ${PARCELS_API_TABLE} AS SELECT * FROM read_parquet(${parquetRef});`,
  );
}

export function createDuckDbClient(config: DuckDbClientConfig): DuckDbClient {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  let initPromise: Promise<void> | null = null;

  const ensureInit = (): Promise<void> => {
    if (!initPromise) {
      initPromise = initializeView(conn, config);
    }
    return initPromise;
  };

  return {
    async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      await ensureInit();
      const rows = await all<T>(conn, sql, ...params);
      return normalizeRows(rows);
    },

    async count(sql: string, params: unknown[] = []): Promise<number> {
      await ensureInit();
      const rows = await all<{ count: bigint | number }>(conn, sql, ...params);
      return Number(rows[0]?.count ?? 0);
    },

    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        conn.close((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

export const PARCELS_API_TABLE = "parcels_enriched_api";

export const SEARCH_SELECT_COLUMNS = [
  "objectid",
  "pin",
  "site_address",
  "site_city",
  "site_state",
  "acreage",
  "zoning",
  "zoning_norm",
  "is_industrial",
  "owner_name",
  "owner_state",
  "stable_ownership",
  "owner_out_of_area",
  "roof_age_proxy_yrs",
  "years_since_sale",
  "dist_transmission_m",
  "dist_substation_m",
  "dist_transit_m",
  "dist_starbucks_m",
  "dist_water_m",
  "near_transit",
  "near_starbucks",
  "near_water",
  "near_power",
  "geom_geojson",
  "source_system",
  "source_url",
  "retrieved_at",
] as const;

export const DATA_CENTER_SELECT_COLUMNS = [
  ...SEARCH_SELECT_COLUMNS,
  "least(coalesce(dist_transmission_m, 1e18), coalesce(dist_substation_m, 1e18)) AS dist_to_power_m",
] as const;

export function paginationClause(page: number, pageSize: number): {
  sql: string;
  params: [number, number];
} {
  return {
    sql: "LIMIT ? OFFSET ?",
    params: [pageSize, (page - 1) * pageSize],
  };
}
