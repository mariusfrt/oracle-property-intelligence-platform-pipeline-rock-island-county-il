import type { DuckDbClient } from "./db/duckdb.js";
import { createDuckDbClient, getParquetS3Uri } from "./db/duckdb.js";
import type { Logger } from "@aws-lambda-powertools/logger";

export interface ApiContext {
  logger: Logger;
  duckdb: DuckDbClient;
}

let cachedClient: DuckDbClient | null = null;

export function createApiContext(logger: Logger): ApiContext {
  if (!cachedClient) {
    cachedClient = createDuckDbClient({
      parquetS3Uri: getParquetS3Uri(),
      s3Region: process.env.AWS_REGION ?? "us-east-2",
    });
  }
  return { logger, duckdb: cachedClient };
}

export async function disposeApiContext(ctx: ApiContext): Promise<void> {
  await ctx.duckdb.close();
  cachedClient = null;
}
