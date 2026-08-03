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
