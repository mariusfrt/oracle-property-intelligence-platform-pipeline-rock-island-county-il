import type { DuckDbClient } from "./db/duckdb.js";
import { getSharedDuckDbClient, resetSharedDuckDbClient } from "./db/duckdb.js";
import type { Logger } from "@aws-lambda-powertools/logger";

export interface ApiContext {
  logger: Logger;
  duckdb: DuckDbClient;
}

export function createApiContext(logger: Logger): ApiContext {
  return { logger, duckdb: getSharedDuckDbClient() };
}

export async function disposeApiContext(_ctx: ApiContext): Promise<void> {
  await resetSharedDuckDbClient();
}
