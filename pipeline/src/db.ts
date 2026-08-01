import duckdb from "duckdb";
import { CREATE_PARCELS_TABLE_SQL } from "./schema.js";

export type DuckDbConnection = duckdb.Connection;

export function openDatabase(dbPath: string): Promise<{
  db: duckdb.Database;
  conn: DuckDbConnection;
}> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      const conn = db.connect();
      resolve({ db, conn });
    });
  });
}

export function run(conn: DuckDbConnection, sql: string, ...params: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, ...params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function all<T = Record<string, unknown>>(
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

export async function initSpatialAndSchema(conn: DuckDbConnection): Promise<void> {
  await run(conn, "INSTALL spatial;");
  await run(conn, "LOAD spatial;");
  await run(conn, CREATE_PARCELS_TABLE_SQL);
}

export function closeDatabase(db: duckdb.Database, conn: DuckDbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.close((connErr) => {
      if (connErr) {
        reject(connErr);
        return;
      }
      db.close((dbErr) => {
        if (dbErr) reject(dbErr);
        else resolve();
      });
    });
  });
}
