import { PATHS } from "../config.js";
import { all, closeDatabase, initSpatialAndSchema, openDatabase, run } from "../db.js";
import {
  DEFAULT_MIN_ACRES,
  DEFAULT_POWER_RADIUS_M,
} from "./constants.js";
import { buildParcelsEnrichedSql } from "./schema.js";

export interface EnrichmentBuildOptions {
  powerRadiusM?: number;
  minAcres?: number;
}

export interface EnrichmentBuildResult {
  rowCount: number;
  powerRadiusM: number;
  minAcres: number;
}

export async function buildParcelsEnriched(
  options: EnrichmentBuildOptions = {},
): Promise<EnrichmentBuildResult> {
  const powerRadiusM = options.powerRadiusM ?? DEFAULT_POWER_RADIUS_M;
  const minAcres = options.minAcres ?? DEFAULT_MIN_ACRES;

  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const [{ parcelCount }] = await all<{ parcelCount: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS parcelCount FROM parcels",
  );
  if (Number(parcelCount) === 0) {
    await closeDatabase(db, conn);
    throw new Error("parcels table is empty. Run ingest normalize first.");
  }

  const sql = buildParcelsEnrichedSql(powerRadiusM, minAcres);
  await run(conn, sql);

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels_enriched",
  );
  const rowCount = Number(count);

  await closeDatabase(db, conn);

  console.log(
    `enrich build: parcels_enriched ${rowCount} row(s) (power_radius_m=${powerRadiusM}, min_acres=${minAcres})`,
  );

  return { rowCount, powerRadiusM, minAcres };
}
