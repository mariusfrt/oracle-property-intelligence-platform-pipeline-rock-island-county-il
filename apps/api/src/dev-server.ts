#!/usr/bin/env node
import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { Logger } from "@aws-lambda-powertools/logger";
import { appRouter } from "./routers/index.js";
import { createApiContext } from "./context.js";
import { DEFAULT_LOCAL_PARQUET, getParquetPath } from "./db/duckdb.js";
import { handleMcpNodeRequest, isMcpPath } from "./mcp/http.js";

const PORT = Number(process.env.PORT ?? 3001);

if (!process.env.PARQUET_PATH) {
  process.env.PARQUET_PATH = DEFAULT_LOCAL_PARQUET;
}

const logger = new Logger({ serviceName: "oracle-rock-island-api-dev" });

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: () => createApiContext(logger),
});

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, mcp-session-id, mcp-protocol-version, accept",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = (req.url ?? "/").split("?")[0] ?? "/";
  if (isMcpPath(pathname)) {
    void handleMcpNodeRequest(req, res).catch((error: unknown) => {
      logger.error("MCP request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "MCP handler failed" }));
      }
    });
    return;
  }

  trpcHandler(req, res);
});

server.listen(PORT);
console.log(`API dev server listening on http://localhost:${PORT}`);
console.log(`MCP endpoint: POST http://localhost:${PORT}/mcp`);
console.log(`Parquet path: ${getParquetPath()}`);
console.log(`Query engine: DuckDB native (@duckdb/node-api) over bundled Parquet`);
