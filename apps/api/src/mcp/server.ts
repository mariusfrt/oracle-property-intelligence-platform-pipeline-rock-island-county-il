import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  dataCenterCandidatesInputSchema,
  parcelIdSchema,
  presetQueryInputSchema,
  searchParcelsInputSchema,
} from "@oracle/shared";
import { getSharedDuckDbClient } from "../db/duckdb.js";
import {
  emptyInputSchema,
  toolDataCenterCandidates,
  toolGetDatasetInfo,
  toolGetParcel,
  toolListQuerySchema,
  toolPresetQuery,
  toolSearchParcels,
} from "./tools.js";

export const MCP_SERVER_INFO = {
  name: "oracle-rock-island",
  version: "0.1.0",
} as const;

/**
 * Create a fresh MCP server with parcel tools.
 * Stateless Streamable HTTP creates one server per request.
 */
export function createOracleMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: {
      tools: {},
    },
  });

  const duckdb = getSharedDuckDbClient();

  server.registerTool(
    "search_parcels",
    {
      title: "Search parcels",
      description:
        "Search Rock Island County parcels by acreage, industrial zoning, ownership stability, out-of-area ownership, proximity signals, or free-text owner/address match.",
      inputSchema: searchParcelsInputSchema,
    },
    async (args) => toolSearchParcels(duckdb, args),
  );

  server.registerTool(
    "data_center_candidates",
    {
      title: "Data-center candidates",
      description:
        "Rank data-center candidate parcels: large, industrial, stable ownership, and within a power radius of transmission or substations.",
      inputSchema: dataCenterCandidatesInputSchema,
    },
    async (args) => toolDataCenterCandidates(duckdb, args),
  );

  server.registerTool(
    "preset_query",
    {
      title: "Preset query",
      description:
        "Run a standard question preset (roof age, water view, ownership stability, regional owner, near transit, near Starbucks).",
      inputSchema: presetQueryInputSchema,
    },
    async (args) => toolPresetQuery(duckdb, args),
  );

  server.registerTool(
    "get_parcel",
    {
      title: "Get parcel",
      description: "Fetch one parcel by objectid with identity, signals, and provenance.",
      inputSchema: parcelIdSchema,
    },
    async (args) => toolGetParcel(duckdb, args),
  );

  server.registerTool(
    "get_dataset_info",
    {
      title: "Dataset info",
      description:
        "Dataset summary: parcel count, enrichment layer counts, provenance, and infra notes. Same data model as the UI and Bedrock agent.",
      inputSchema: emptyInputSchema,
    },
    async () => toolGetDatasetInfo(duckdb),
  );

  server.registerTool(
    "list_query_schema",
    {
      title: "List query schema",
      description:
        "Self-describing MCP tool catalog and the queryable column list for the parcel Parquet model.",
      inputSchema: emptyInputSchema,
    },
    async () => toolListQuerySchema(),
  );

  return server;
}
