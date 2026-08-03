#!/usr/bin/env node
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { Logger } from "@aws-lambda-powertools/logger";
import { appRouter } from "./routers/index.js";
import { createApiContext } from "./context.js";
import { DEFAULT_LOCAL_PARQUET, getParquetSource } from "./db/duckdb.js";

const PORT = Number(process.env.PORT ?? 3001);

if (!process.env.PARQUET_SOURCE && !process.env.PARQUET_S3_URI) {
  process.env.PARQUET_SOURCE = DEFAULT_LOCAL_PARQUET;
}

const logger = new Logger({ serviceName: "oracle-rock-island-api-dev" });

const server = createHTTPServer({
  // Dev-only CORS so the local web app (localhost:3000) can call this API (localhost:3001).
  // Production CORS is handled by API Gateway, so this is not needed when deployed.
  middleware: (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  },
  router: appRouter,
  createContext: () => createApiContext(logger),
});

server.listen(PORT);
console.log(`API dev server listening on http://localhost:${PORT}`);
console.log(`Parquet source: ${getParquetSource()}`);
