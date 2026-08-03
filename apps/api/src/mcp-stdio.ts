#!/usr/bin/env node
/**
 * Local-only stdio MCP entrypoint for Cursor.
 * Reuses the same tool handlers as the hosted Streamable HTTP server.
 * Prefer the hosted POST /mcp endpoint for demos and grading.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_LOCAL_PARQUET } from "./db/duckdb.js";
import { createOracleMcpServer } from "./mcp/server.js";

if (!process.env.PARQUET_PATH) {
  process.env.PARQUET_PATH = DEFAULT_LOCAL_PARQUET;
}

const server = createOracleMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
