/**
 * DuckDB client for read-only Parquet queries over S3 via httpfs.
 * NO spatial extension at runtime — geometry is pre-serialized as geom_geojson text.
 *
 * TODO: wire INSTALL/LOAD httpfs, SET s3_region, query parcels_enriched_api.parquet.
 */
export interface DuckDbClient {
  /** Run a read-only SQL query against the API Parquet view/table. */
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Run a scalar count query. */
  count(sql: string, params?: unknown[]): Promise<number>;
  close(): Promise<void>;
}

export interface DuckDbClientConfig {
  /** S3 URI to parcels_enriched_api.parquet, e.g. s3://bucket/key.parquet */
  parquetS3Uri: string;
  /** AWS region for httpfs (default us-east-2). */
  s3Region?: string;
}

export function getParquetS3Uri(): string {
  return (
    process.env.PARQUET_S3_URI ??
    "s3://placeholder-bucket/parquet/parcels_enriched_api.parquet"
  );
}

/** Stub client — queries not wired yet; procedures return empty typed responses. */
export function createDuckDbClient(_config: DuckDbClientConfig): DuckDbClient {
  return {
    async query<T extends Record<string, unknown>>(): Promise<T[]> {
      throw new Error("DuckDB queries not wired yet");
    },
    async count(): Promise<number> {
      throw new Error("DuckDB queries not wired yet");
    },
    async close(): Promise<void> {
      /* no-op */
    },
  };
}

/** SQL view name used once Parquet is mounted. */
export const PARCELS_API_TABLE = "parcels_enriched_api";

/**
 * Columns selected for list/search responses (includes provenance + geom_geojson).
 * Full parcel detail selects * from the API table.
 */
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
