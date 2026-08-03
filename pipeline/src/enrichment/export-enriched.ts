import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../config.js";
import { all, closeDatabase, initSpatialAndSchema, openDatabase, run } from "../db.js";

export interface EnrichmentExportResult {
  parquetPath: string;
  rowCount: number;
}

export interface EnrichmentApiExportResult extends EnrichmentExportResult {
  fileSizeBytes: number;
}

export async function exportParcelsEnriched(): Promise<EnrichmentExportResult> {
  await fs.mkdir(PATHS.parquet, { recursive: true });

  const parquetPath = path.join(PATHS.parquet, "parcels_enriched.parquet");
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels_enriched",
  );
  const rowCount = Number(count);
  if (rowCount === 0) {
    await closeDatabase(db, conn);
    throw new Error("parcels_enriched is empty. Run enrich build first.");
  }

  await run(
    conn,
    `COPY parcels_enriched TO '${parquetPath.replace(/'/g, "''")}' (FORMAT PARQUET);`,
  );

  await closeDatabase(db, conn);

  console.log(`enrich export: wrote ${parquetPath} (${rowCount} rows)`);

  return { parquetPath, rowCount };
}

export async function exportParcelsEnrichedApi(): Promise<EnrichmentApiExportResult> {
  await fs.mkdir(PATHS.parquet, { recursive: true });

  const parquetPath = path.join(PATHS.parquet, "parcels_enriched_api.parquet");
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels_enriched",
  );
  const rowCount = Number(count);
  if (rowCount === 0) {
    await closeDatabase(db, conn);
    throw new Error("parcels_enriched is empty. Run enrich build first.");
  }

  const escapedPath = parquetPath.replace(/'/g, "''");
  await run(
    conn,
    `COPY (
      SELECT * EXCLUDE (geom, source_payload),
             ST_AsGeoJSON(geom) AS geom_geojson
      FROM parcels_enriched
    ) TO '${escapedPath}' (FORMAT PARQUET);`,
  );

  await closeDatabase(db, conn);

  const stat = await fs.stat(parquetPath);
  const fileSizeBytes = stat.size;

  console.log(
    `enrich export-api: wrote ${parquetPath} (${rowCount} rows, ${fileSizeBytes} bytes)`,
  );

  return { parquetPath, rowCount, fileSizeBytes };
}

/** Non-PII columns eligible for public IPFS. Allowlist only (never a blocklist). */
export const PUBLIC_EXPORT_COLUMNS = [
  "objectid",
  "pin",
  "alt_pin",
  "lon",
  "lat",
  "site_address",
  "site_city",
  "site_state",
  "site_zip",
  "municipality",
  "township",
  "jurisdiction",
  "gis_acres",
  "gross_acres",
  "acreage",
  "zoning",
  "class",
  "zoning_norm",
  "is_industrial",
  "year_built",
  "total_sqft",
  "garage_sqft",
  "roof_age_proxy_yrs",
  "date_last_sale",
  "date_of_sale",
  "last_sale",
  "years_since_sale",
  "stable_ownership",
  "owner_out_of_area",
  "dist_transmission_m",
  "dist_substation_m",
  "dist_transit_m",
  "dist_starbucks_m",
  "dist_water_m",
  "near_transit",
  "near_starbucks",
  "near_water",
  "near_power",
  "dc_candidate",
  "geom_geojson",
  "source_system",
  "source_url",
  "retrieved_at",
] as const;

/** Columns that must never appear in the public artifact. */
export const PUBLIC_EXPORT_EXCLUDED_COLUMNS = [
  "owner_name",
  "owner_addr",
  "owner_city",
  "owner_state",
  "owner_zip",
  "taxbill_name",
  "taxbill_addr",
  "taxbill_csz",
  "taxbill_year",
  "emv",
  "eav",
  "land_value",
  "building_value",
  "gross_sale_price",
] as const;

/**
 * Export a PII-stripped Parquet for public IPFS.
 * Uses an explicit allowlist; owner identity and financial fields are never selected.
 */
export async function exportParcelsEnrichedPublic(): Promise<EnrichmentApiExportResult> {
  await fs.mkdir(PATHS.parquet, { recursive: true });

  const parquetPath = PATHS.publicParquet;
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels_enriched",
  );
  const rowCount = Number(count);
  if (rowCount === 0) {
    await closeDatabase(db, conn);
    throw new Error("parcels_enriched is empty. Run enrich build first.");
  }

  const selectList = PUBLIC_EXPORT_COLUMNS.map((col) =>
    col === "geom_geojson" ? "ST_AsGeoJSON(geom) AS geom_geojson" : col,
  ).join(",\n      ");

  const escapedPath = parquetPath.replace(/'/g, "''");
  await run(
    conn,
    `COPY (
      SELECT
      ${selectList}
      FROM parcels_enriched
    ) TO '${escapedPath}' (FORMAT PARQUET);`,
  );

  const columns = await all<{ column_name: string }>(
    conn,
    `DESCRIBE SELECT * FROM read_parquet('${escapedPath}')`,
  );
  const columnNames = columns.map((c) => c.column_name);
  const leaked = PUBLIC_EXPORT_EXCLUDED_COLUMNS.filter((col) => columnNames.includes(col));
  if (leaked.length > 0) {
    await closeDatabase(db, conn);
    throw new Error(
      `Public export contains excluded PII/financial columns: ${leaked.join(", ")}`,
    );
  }

  await closeDatabase(db, conn);

  const stat = await fs.stat(parquetPath);
  const fileSizeBytes = stat.size;

  console.log(
    `enrich export-public: wrote ${parquetPath} (${rowCount} rows, ${fileSizeBytes} bytes)`,
  );
  console.log(
    `enrich export-public: confirmed none of the excluded columns are present (${PUBLIC_EXPORT_EXCLUDED_COLUMNS.join(", ")})`,
  );

  return { parquetPath, rowCount, fileSizeBytes };
}
