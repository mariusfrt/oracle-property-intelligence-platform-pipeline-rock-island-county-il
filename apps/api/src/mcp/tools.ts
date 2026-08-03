import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  dataCenterCandidatesInputSchema,
  parcelIdSchema,
  presetQueryInputSchema,
  searchParcelsInputSchema,
} from "@oracle/shared";
import { SEARCH_SELECT_COLUMNS, type DuckDbClient } from "../db/duckdb.js";
import {
  dataCenterCandidates,
  getParcelByObjectId,
  presetQuery,
  searchParcels,
} from "../queries/parcels.js";
import { getDatasetSummary } from "../queries/dataset.js";

/** Cap MCP page sizes so tool payloads stay small for agents. */
export const MCP_MAX_PAGE_SIZE = 25;

export const emptyInputSchema = z.object({});

function clampPageSize(pageSize: number | undefined): number {
  const n = pageSize ?? MCP_MAX_PAGE_SIZE;
  return Math.min(Math.max(1, n), MCP_MAX_PAGE_SIZE);
}

function jsonResult(summary: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}

export async function toolSearchParcels(
  duckdb: DuckDbClient,
  raw: unknown,
): Promise<CallToolResult> {
  const input = searchParcelsInputSchema.parse({
    ...(raw as object),
    pageSize: clampPageSize((raw as { pageSize?: number } | null)?.pageSize),
  });
  const page = await searchParcels(duckdb, input);
  return jsonResult(
    `${page.rows.length} of ${page.total} parcels`,
    {
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      rows: page.rows,
    },
  );
}

export async function toolDataCenterCandidates(
  duckdb: DuckDbClient,
  raw: unknown,
): Promise<CallToolResult> {
  const input = dataCenterCandidatesInputSchema.parse({
    ...(raw as object),
    pageSize: clampPageSize((raw as { pageSize?: number } | null)?.pageSize),
  });
  const page = await dataCenterCandidates(duckdb, input);
  return jsonResult(
    `${page.rows.length} of ${page.total} data-center candidates`,
    {
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      minAcres: input.minAcres,
      powerRadiusM: input.powerRadiusM,
      rows: page.rows,
    },
  );
}

export async function toolPresetQuery(
  duckdb: DuckDbClient,
  raw: unknown,
): Promise<CallToolResult> {
  const input = presetQueryInputSchema.parse({
    ...(raw as object),
    pageSize: clampPageSize((raw as { pageSize?: number } | null)?.pageSize),
  });
  const page = await presetQuery(duckdb, input);
  return jsonResult(
    `${page.rows.length} of ${page.total} parcels (${page.label})`,
    {
      preset: page.preset,
      label: page.label,
      limitation: page.limitation,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      rows: page.rows,
    },
  );
}

export async function toolGetParcel(
  duckdb: DuckDbClient,
  raw: unknown,
): Promise<CallToolResult> {
  const input = parcelIdSchema.parse(raw);
  const parcel = await getParcelByObjectId(duckdb, input.objectid);
  if (!parcel) {
    return jsonResult(`No parcel found for objectid ${input.objectid}`, {
      parcel: null,
    });
  }
  const label =
    (parcel.pin as string | null | undefined) ??
    (parcel.site_address as string | null | undefined) ??
    String(input.objectid);
  return jsonResult(`Parcel ${label}`, { parcel });
}

export async function toolGetDatasetInfo(duckdb: DuckDbClient): Promise<CallToolResult> {
  const summary = await getDatasetSummary(duckdb);
  const payload = {
    ...summary,
    note: "Same DuckDB/Parquet data model used by the UI and the Bedrock agent. MCP tools call the shared query layer without changing the schema or SQL.",
  };
  return jsonResult(
    `${summary.layers.parcels.count.toLocaleString()} parcels in Rock Island County dataset`,
    payload,
  );
}

export async function toolListQuerySchema(): Promise<CallToolResult> {
  const tools = [
    {
      name: "search_parcels",
      description:
        "Search Rock Island County parcels by acreage, industrial zoning, ownership stability, out-of-area ownership, proximity signals, or free-text owner/address match.",
      inputSchema: zodToJsonSchema(searchParcelsInputSchema, {
        $refStrategy: "none",
      }),
    },
    {
      name: "data_center_candidates",
      description:
        "Rank data-center candidate parcels: large, industrial, stable ownership, and within a power radius of transmission or substations.",
      inputSchema: zodToJsonSchema(dataCenterCandidatesInputSchema, {
        $refStrategy: "none",
      }),
    },
    {
      name: "preset_query",
      description:
        "Run a standard question preset (roof age, water view, ownership stability, regional owner, near transit, near Starbucks).",
      inputSchema: zodToJsonSchema(presetQueryInputSchema, { $refStrategy: "none" }),
    },
    {
      name: "get_parcel",
      description: "Fetch one parcel by objectid with identity, signals, and provenance.",
      inputSchema: zodToJsonSchema(parcelIdSchema, { $refStrategy: "none" }),
    },
    {
      name: "get_dataset_info",
      description:
        "Dataset summary: parcel count, enrichment layer counts, provenance, and infra notes.",
      inputSchema: zodToJsonSchema(emptyInputSchema, { $refStrategy: "none" }),
    },
    {
      name: "list_query_schema",
      description:
        "Self-describing MCP tool catalog and the queryable column list for the parcel Parquet model.",
      inputSchema: zodToJsonSchema(emptyInputSchema, { $refStrategy: "none" }),
    },
  ];

  const payload = {
    tools,
    queryableColumns: [...SEARCH_SELECT_COLUMNS],
    note: "Documented MCP-compatible query structure over the unchanged DuckDB/Parquet model (same as UI and Bedrock agent).",
  };

  return jsonResult(
    `${tools.length} MCP tools; ${SEARCH_SELECT_COLUMNS.length} queryable columns`,
    payload,
  );
}
