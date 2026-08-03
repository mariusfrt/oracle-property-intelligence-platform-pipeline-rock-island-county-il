import type { DuckDbClient } from "./db/duckdb.js";
import { createDuckDbClient, getParquetSource } from "./db/duckdb.js";
import type { Logger } from "@aws-lambda-powertools/logger";

export interface ApiContext {
  logger: Logger;
  duckdb: DuckDbClient;
}

let cachedClient: DuckDbClient | null = null;

export function createApiContext(logger: Logger): ApiContext {
  if (!cachedClient) {
    cachedClient = createDuckDbClient({
      parquetSource: getParquetSource(),
      s3Region: process.env.S3_REGION ?? "us-east-2",
    });
  }
  return { logger, duckdb: cachedClient };
}

export async function disposeApiContext(ctx: ApiContext): Promise<void> {
  await ctx.duckdb.close();
  cachedClient = null;
}
