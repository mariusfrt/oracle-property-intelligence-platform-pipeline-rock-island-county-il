import * as duckdb from "@duckdb/duckdb-wasm";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import Worker from "web-worker";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default local Parquet path (repo root data/parquet). */
export const DEFAULT_LOCAL_PARQUET = path.resolve(
  __dirname,
  "../../../../data/parquet/parcels_enriched_api.parquet",
);

const VIRTUAL_PARQUET_NAME = "parcels_enriched_api.parquet";

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

type NodeWorker = InstanceType<typeof Worker>;

/** Minimal Arrow table shape returned by DuckDB-WASM query(). */
interface ArrowLikeTable {
  schema: { fields: ReadonlyArray<{ name: string }> };
  toArray(): Array<Record<string, unknown>>;
}

/** Escape `%`, `_`, and `\` for use in parameterized LIKE … ESCAPE '\\' patterns. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
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
    // Arrow Row / StructRow often have non-enumerable field accessors —
    // prefer schema-driven conversion in tableToRows; this branch covers plain objects.
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeValue(v)]),
    );
  }
  return value;
}

function tableToRows<T extends Record<string, unknown>>(table: ArrowLikeTable): T[] {
  const names = table.schema.fields.map((f) => f.name);
  return table.toArray().map((row) => {
    const obj: Record<string, unknown> = {};
    for (const name of names) {
      obj[name] = normalizeValue(row[name]);
    }
    return obj as T;
  });
}

function resolveDuckDbDist(): string {
  return path.dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node.cjs"));
}

async function instantiateAsyncDuckDb(): Promise<{
  db: duckdb.AsyncDuckDB;
  worker: NodeWorker;
}> {
  const dist = resolveDuckDbDist();
  const bundles: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: path.join(dist, "duckdb-mvp.wasm"),
      mainWorker: pathToFileURL(path.join(dist, "duckdb-node-mvp.worker.cjs")).href,
    },
    eh: {
      mainModule: path.join(dist, "duckdb-eh.wasm"),
      mainWorker: pathToFileURL(path.join(dist, "duckdb-node-eh.worker.cjs")).href,
    },
  };

  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker) {
    throw new Error("DuckDB-WASM bundle is missing mainWorker");
  }

  // Node classic workers use importScripts (breaks CJS); module workers import() the .cjs fine.
  const worker = new Worker(bundle.mainWorker, { type: "module" });
  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
  return { db, worker };
}

async function registerParquetView(
  db: duckdb.AsyncDuckDB,
  parquetPath: string,
): Promise<void> {
  const absolute = path.resolve(parquetPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Parquet file not found: ${absolute}`);
  }

  const buffer = new Uint8Array(fs.readFileSync(absolute));
  await db.registerFileBuffer(VIRTUAL_PARQUET_NAME, buffer);

  const conn = await db.connect();
  try {
    await conn.query(
      `CREATE OR REPLACE VIEW ${PARCELS_API_TABLE} AS SELECT * FROM read_parquet('${VIRTUAL_PARQUET_NAME}')`,
    );
  } finally {
    await conn.close();
  }
}

/**
 * Create a DuckDB-WASM client that registers the Parquet buffer and exposes
 * `parcels_enriched_api`. Initialization is lazy on first query.
 */
export function createDuckDbClient(config: DuckDbClientConfig): DuckDbClient {
  let db: duckdb.AsyncDuckDB | null = null;
  let worker: NodeWorker | null = null;
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  let initPromise: Promise<void> | null = null;

  const ensureInit = (): Promise<void> => {
    if (!initPromise) {
      initPromise = (async () => {
        const instantiated = await instantiateAsyncDuckDb();
        db = instantiated.db;
        worker = instantiated.worker;
        await registerParquetView(db, config.parquetPath);
        conn = await db.connect();
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
        const table = await conn.query(sql);
        return tableToRows<T>(table);
      }

      const stmt = await conn.prepare(sql);
      try {
        const table = await stmt.query(...params);
        return tableToRows<T>(table);
      } finally {
        await stmt.close();
      }
    },

    async count(sql: string, params: unknown[] = []): Promise<number> {
      const rows = await this.query<{ count: number }>(sql, params);
      return Number(rows[0]?.count ?? 0);
    },

    async close(): Promise<void> {
      if (conn) {
        await conn.close();
        conn = null;
      }
      if (db) {
        await db.terminate();
        db = null;
      }
      if (worker) {
        worker.terminate();
        worker = null;
      }
      initPromise = null;
    },
  };
}

/** Module-scope singleton — warm Lambda invocations reuse the same WASM instance. */
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
