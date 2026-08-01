import fs from "node:fs/promises";
import path from "node:path";
import { SOURCE_SYSTEM, PATHS } from "./config.js";
import { all, closeDatabase, initSpatialAndSchema, openDatabase, run } from "./db.js";
import {
  listPageOffsets,
  mapFeatureToRow,
  pageFileName,
  parseFeatureCollection,
} from "./mapping.js";
import { PARCEL_INSERT_COLUMNS } from "./schema.js";
import type { FeatureCollection } from "./types.js";

interface PageEnvelope extends FeatureCollection {
  _pipeline?: { source_url: string; retrieved_at: string };
}

async function listRawPages(): Promise<number[]> {
  const entries = await fs.readdir(PATHS.rawParcels);
  const geojsonFiles = entries.filter((f) => f.endsWith(".geojson"));
  const offsets = listPageOffsets(geojsonFiles);
  if (offsets.length === 0) {
    throw new Error(`No raw pages found in ${PATHS.rawParcels}. Run ingest pull first.`);
  }
  return offsets;
}

function geomSqlExpression(geometry: object | null): string {
  if (!geometry) return "NULL";
  const geomJson = JSON.stringify(geometry).replace(/'/g, "''");
  return `ST_GeomFromGeoJSON('${geomJson}')`;
}

function buildInsertSql(geometry: object | null): string {
  const cols = PARCEL_INSERT_COLUMNS.join(", ");
  const valueParts: string[] = [];
  for (const col of PARCEL_INSERT_COLUMNS) {
    if (col === "geom") {
      valueParts.push(geomSqlExpression(geometry));
    } else {
      valueParts.push("?");
    }
  }
  // Upsert keyed on objectid (PRIMARY KEY); pin is not unique (e.g. "USA", "RAILROAD").
  return `INSERT OR REPLACE INTO parcels (${cols}) VALUES (${valueParts.join(", ")})`;
}

export interface NormalizeResult {
  pagesProcessed: number;
  rowsUpserted: number;
  rowCount: number;
}

export async function normalizeParcels(): Promise<NormalizeResult> {
  await fs.mkdir(path.dirname(PATHS.duckdb), { recursive: true });

  const offsets = await listRawPages();
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  let rowsUpserted = 0;

  for (const offset of offsets) {
    const pagePath = path.join(PATHS.rawParcels, pageFileName(offset));
    const rawText = await fs.readFile(pagePath, "utf8");
    const envelope = JSON.parse(rawText) as PageEnvelope;
    const fc = parseFeatureCollection(envelope);
    const sourceUrl = envelope._pipeline?.source_url ?? null;
    const retrievedAt = envelope._pipeline?.retrieved_at ?? new Date().toISOString();

    for (const feature of fc.features) {
      const row = mapFeatureToRow(feature);
      const insertSql = buildInsertSql(row.geometry);

      await run(
        conn,
        insertSql,
        row.pin,
        row.alt_pin,
        row.objectid,
        row.lon,
        row.lat,
        row.site_address,
        row.site_city,
        row.site_state,
        row.site_zip,
        row.municipality,
        row.township,
        row.jurisdiction,
        row.gis_acres,
        row.gross_acres,
        row.zoning,
        row.class,
        row.emv,
        row.eav,
        row.land_value,
        row.building_value,
        row.owner_name,
        row.owner_addr,
        row.owner_city,
        row.owner_state,
        row.owner_zip,
        row.taxbill_name,
        row.taxbill_addr,
        row.taxbill_csz,
        row.taxbill_year,
        row.date_last_sale,
        row.date_of_sale,
        row.gross_sale_price,
        row.year_built,
        row.total_sqft,
        row.garage_sqft,
        SOURCE_SYSTEM,
        sourceUrl,
        retrievedAt,
        JSON.stringify(row.source_payload),
      );
      rowsUpserted += 1;
    }

    console.log(`normalize: loaded ${fc.features.length} features from ${pagePath}`);
  }

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels",
  );
  const rowCount = Number(count);

  await closeDatabase(db, conn);

  return {
    pagesProcessed: offsets.length,
    rowsUpserted,
    rowCount,
  };
}
