import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "./config.js";
import { all, closeDatabase, initSpatialAndSchema, openDatabase, run } from "./db.js";

export interface ExportResult {
  parquetPath: string;
  rowCount: number;
}

export async function exportParcels(): Promise<ExportResult> {
  await fs.mkdir(PATHS.parquet, { recursive: true });

  const parquetPath = path.join(PATHS.parquet, "parcels.parquet");
  const { db, conn } = await openDatabase(PATHS.duckdb);
  await initSpatialAndSchema(conn);

  const [{ count }] = await all<{ count: bigint | number }>(
    conn,
    "SELECT COUNT(*)::BIGINT AS count FROM parcels",
  );
  const rowCount = Number(count);
  if (rowCount === 0) {
    await closeDatabase(db, conn);
    throw new Error("parcels table is empty. Run ingest normalize first.");
  }

  await run(
    conn,
    `COPY parcels TO '${parquetPath.replace(/'/g, "''")}' (FORMAT PARQUET);`,
  );

  await closeDatabase(db, conn);

  console.log(`export: wrote ${parquetPath} (${rowCount} rows)`);

  return { parquetPath, rowCount };
}
