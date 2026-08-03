import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default local Parquet path (repo root data/parquet). */
export const DEFAULT_LOCAL_PARQUET = path.resolve(
  __dirname,
  "../../../../data/parquet/parcels_enriched_api.parquet",
);

export const PARCELS_API_TABLE = "parcels_enriched_api";

export interface DuckDbClient {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  count(sql: string, params?: unknown[]): Promise<number>;
  close(): Promise<void>;
}

export interface DuckDbClientConfig {
  /** Absolute or relative filesystem path to parcels_enriched_api.parquet */
  parquetPath: string;
}

/** Escape `%`, `_`, and `\` for use in parameterized LIKE … ESCAPE '\\' patterns. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Resolve the Parquet file path for local and Lambda.
 * Prefers PARQUET_PATH; falls back to the bundled Lambda asset or the repo default.
 */
export function getParquetPath(): string {
  if (process.env.PARQUET_PATH) {
    return path.resolve(process.env.PARQUET_PATH);
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(
      process.env.LAMBDA_TASK_ROOT ?? process.cwd(),
      "parcels_enriched_api.parquet",
    );
  }
  return DEFAULT_LOCAL_PARQUET;
}

/** Default local IPFS manifest path (repo root data/). */
export const DEFAULT_LOCAL_IPFS_MANIFEST = path.resolve(
  __dirname,
  "../../../../data/ipfs-manifest.json",
);

/**
 * Resolve the IPFS manifest path for local and Lambda.
 * Prefers IPFS_MANIFEST_PATH; falls back to the bundled Lambda asset or the repo default.
 */
export function getIpfsManifestPath(): string {
  if (process.env.IPFS_MANIFEST_PATH) {
    return path.resolve(process.env.IPFS_MANIFEST_PATH);
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(
      process.env.LAMBDA_TASK_ROOT ?? process.cwd(),
      "ipfs-manifest.json",
    );
  }
  return DEFAULT_LOCAL_IPFS_MANIFEST;
}

/** @deprecated Use getParquetPath() */
export function getParquetSource(): string {
  return getParquetPath();
}

/** @deprecated Use getParquetPath() */
export function getParquetS3Uri(): string {
  return getParquetPath();
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value !== null && typeof value === "object") {
    // Neo returns temporal/decimal columns as DuckDBValue class instances
    // (e.g. TIMESTAMP -> { micros }). Those are NOT plain objects; left alone they
    // collapse to {} in JSON and crash React. Stringify any non-plain object via its
    // toString (gives "2026-08-01 14:10:14.833" etc). Plain nested structs recurse.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      return String(value);
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeValue(v)]),
    );
  }
  return value;
}

function readerToRows<T extends Record<string, unknown>>(reader: {
  columnNames(): string[];
  getRows(): unknown[][];
}): T[] {
  const names = reader.columnNames();
  return reader.getRows().map((cells) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < names.length; i++) {
      obj[names[i]!] = normalizeValue(cells[i]);
    }
    return obj as T;
  });
}

/**
 * Create a native DuckDB client that registers the Parquet path as a view.
 * Initialization is lazy on first query (singleton reused via getSharedDuckDbClient).
 */
export function createDuckDbClient(config: DuckDbClientConfig): DuckDbClient {
  let instance: DuckDBInstance | null = null;
  let conn: DuckDBConnection | null = null;
  let initPromise: Promise<void> | null = null;

  const ensureInit = (): Promise<void> => {
    if (!initPromise) {
      initPromise = (async () => {
        const parquetPath = path.resolve(config.parquetPath);
        instance = await DuckDBInstance.create(":memory:");
        conn = await instance.connect();
        await conn.run(
          `CREATE OR REPLACE VIEW ${PARCELS_API_TABLE} AS SELECT * FROM read_parquet('${escapeSqlString(parquetPath)}')`,
        );
      })();
    }
    return initPromise;
  };

  return {
    async query<T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> {
      await ensureInit();
      if (!conn) throw new Error("DuckDB connection not initialized");

      if (params.length === 0) {
        const reader = await conn.runAndReadAll(sql);
        return readerToRows<T>(reader);
      }

      const prepared = await conn.prepare(sql);
      prepared.bind(params as DuckDBValue[]);
      const reader = await prepared.runAndReadAll();
      return readerToRows<T>(reader);
    },

    async count(sql: string, params: unknown[] = []): Promise<number> {
      const rows = await this.query<{ count: number }>(sql, params);
      return Number(rows[0]?.count ?? 0);
    },

    async close(): Promise<void> {
      if (conn) {
        conn.closeSync();
        conn = null;
      }
      if (instance) {
        instance.closeSync();
        instance = null;
      }
      initPromise = null;
    },
  };
}

/** Module-scope singleton — warm Lambda invocations reuse the same DuckDB instance. */
let sharedClient: DuckDbClient | null = null;

export function getSharedDuckDbClient(): DuckDbClient {
  if (!sharedClient) {
    sharedClient = createDuckDbClient({ parquetPath: getParquetPath() });
  }
  return sharedClient;
}

export async function resetSharedDuckDbClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.close();
    sharedClient = null;
  }
}

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
