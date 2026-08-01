import { PATHS } from "../config.js";
import { all, closeDatabase, initSpatialAndSchema, openDatabase, run } from "../db.js";
import type { Feature } from "../types.js";
import { RAW_ENRICHMENT_FILES } from "./constants.js";
import { readRawGeoJson, readRawOsm } from "./fetch.js";
import {
  geomSqlExpression,
  osmElementId,
  osmElementName,
  osmElementToGeometry,
} from "./osm-geometry.js";
import {
  CREATE_POI_SQL,
  CREATE_POWER_LINES_SQL,
  CREATE_POWER_SUBSTATIONS_SQL,
} from "./schema.js";

export interface EnrichmentLoadResult {
  powerLines: number;
  powerSubstations: number;
  poiTransit: number;
  poiStarbucks: number;
  poiWater: number;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function lineId(feature: Feature, index: number): string {
  const props = feature.properties ?? {};
  const objectId = asString(props.OBJECTID) ?? asString(props.objectid);
  if (objectId) return objectId;
  const globalId = asString(props.GLOBALID);
  if (globalId) return globalId;
  return `line-${index}`;
}

async function loadPowerLines(
  conn: import("../db.js").DuckDbConnection,
): Promise<number> {
  const { sourceUrl, retrievedAt, collection } = await readRawGeoJson(
    RAW_ENRICHMENT_FILES.transmissionLines,
  );

  await run(conn, CREATE_POWER_LINES_SQL);

  let count = 0;
  for (const [index, feature] of collection.features.entries()) {
    const props = feature.properties ?? {};
    const geomExpr = geomSqlExpression(feature.geometry);
    const sql = `
      INSERT INTO power_lines (id, owner, voltage, volt_class, status, geom, source_url, retrieved_at)
      VALUES (?, ?, ?, ?, ?, ${geomExpr}, ?, ?)
    `;
    await run(
      conn,
      sql,
      lineId(feature, index),
      asString(props.OWNER),
      asNumber(props.VOLTAGE),
      asString(props.VOLT_CLASS),
      asString(props.STATUS),
      sourceUrl,
      retrievedAt,
    );
    count += 1;
  }

  console.log(`enrich load: ${count} power line(s)`);
  return count;
}

async function loadSubstations(
  conn: import("../db.js").DuckDbConnection,
): Promise<number> {
  const { sourceUrl, retrievedAt, elements } = await readRawOsm(
    RAW_ENRICHMENT_FILES.substations,
  );

  await run(conn, CREATE_POWER_SUBSTATIONS_SQL);

  let count = 0;
  for (const element of elements) {
    const geometry = osmElementToGeometry(element);
    if (!geometry) continue;
    const sql = `
      INSERT INTO power_substations (osm_id, name, geom, source_url, retrieved_at)
      VALUES (?, ?, ${geomSqlExpression(geometry)}, ?, ?)
    `;
    await run(
      conn,
      sql,
      osmElementId(element),
      osmElementName(element),
      sourceUrl,
      retrievedAt,
    );
    count += 1;
  }

  console.log(`enrich load: ${count} substation(s)`);
  return count;
}

async function loadPoiKind(
  conn: import("../db.js").DuckDbConnection,
  fileName: string,
  kind: "transit" | "starbucks" | "water",
): Promise<number> {
  const { sourceUrl, retrievedAt, elements } = await readRawOsm(fileName);

  let count = 0;
  for (const element of elements) {
    const geometry = osmElementToGeometry(element);
    if (!geometry) continue;
    const sql = `
      INSERT INTO poi (osm_id, kind, name, geom, source_url, retrieved_at)
      VALUES (?, ?, ?, ${geomSqlExpression(geometry)}, ?, ?)
    `;
    await run(
      conn,
      sql,
      osmElementId(element),
      kind,
      osmElementName(element),
      sourceUrl,
      retrievedAt,
    );
    count += 1;
  }

  console.log(`enrich load: ${count} poi ${kind}`);
  return count;
}

export async function loadEnrichmentLayers(): Promise<EnrichmentLoadResult> {
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const powerLines = await loadPowerLines(conn);
  const powerSubstations = await loadSubstations(conn);

  await run(conn, CREATE_POI_SQL);
  const poiTransit = await loadPoiKind(conn, RAW_ENRICHMENT_FILES.transit, "transit");
  const poiStarbucks = await loadPoiKind(conn, RAW_ENRICHMENT_FILES.starbucks, "starbucks");
  const poiWater = await loadPoiKind(conn, RAW_ENRICHMENT_FILES.water, "water");

  await closeDatabase(db, conn);

  return {
    powerLines,
    powerSubstations,
    poiTransit,
    poiStarbucks,
    poiWater,
  };
}

export async function countEnrichmentLayers(): Promise<EnrichmentLoadResult & { parcelsEnriched: number }> {
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  async function tableCount(table: string): Promise<number> {
    try {
      const [{ count }] = await all<{ count: bigint | number }>(
        conn,
        `SELECT COUNT(*)::BIGINT AS count FROM ${table}`,
      );
      return Number(count);
    } catch {
      return 0;
    }
  }

  const result = {
    powerLines: await tableCount("power_lines"),
    powerSubstations: await tableCount("power_substations"),
    poiTransit: Number(
      (
        await all<{ count: bigint | number }>(
          conn,
          "SELECT COUNT(*)::BIGINT AS count FROM poi WHERE kind = 'transit'",
        )
      )[0]?.count ?? 0,
    ),
    poiStarbucks: Number(
      (
        await all<{ count: bigint | number }>(
          conn,
          "SELECT COUNT(*)::BIGINT AS count FROM poi WHERE kind = 'starbucks'",
        )
      )[0]?.count ?? 0,
    ),
    poiWater: Number(
      (
        await all<{ count: bigint | number }>(
          conn,
          "SELECT COUNT(*)::BIGINT AS count FROM poi WHERE kind = 'water'",
        )
      )[0]?.count ?? 0,
    ),
    parcelsEnriched: await tableCount("parcels_enriched"),
  };

  await closeDatabase(db, conn);
  return result;
}
