import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { DuckDbClient } from "../db/duckdb.js";
import {
  dataCenterCandidates,
  getParcelByObjectId,
  searchParcels,
} from "../queries/parcels.js";
import { loggedProcedure, router } from "../trpc.js";

const BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const AGENT_ROW_CAP = 25;

const agentAskInputSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

const agentSourceSchema = z.object({
  pin: z.string().nullable(),
  site_address: z.string().nullable(),
  owner_name: z.string().nullable(),
  source_url: z.string().nullable(),
  retrieved_at: z.string().nullable(),
});

export type AgentSource = z.infer<typeof agentSourceSchema>;

export interface AgentAskResponse {
  answer: string;
  sources: AgentSource[];
}

const searchToolInputSchema = z.object({
  minAcres: z.number().min(0).optional(),
  industrial: z.boolean().optional(),
  stableOwnership: z.boolean().optional(),
  ownerOutOfArea: z.boolean().optional(),
  nearPower: z.boolean().optional(),
  nearWater: z.boolean().optional(),
  nearTransit: z.boolean().optional(),
  query: z.string().trim().optional(),
});

const dataCenterToolInputSchema = z.object({
  minAcres: z.number().min(0).default(20),
  powerRadiusM: z.number().min(0).default(1609),
});

const SYSTEM_PROMPT = `You are the Rock Island County, Illinois property intelligence agent.
Answer questions about parcels, ownership stability, industrial suitability, and data-center site selection.

Rules:
- Use ONLY the provided tools. Do not invent parcels, owners, acreage, distances, or source URLs.
- Explain your reasoning clearly: which filters or signals you used and why the listed parcels matter.
- Cite evidence for every property you name: include the pin or address and ground it in source_url plus retrieved_at from the tool results.
- Explicitly state assumptions and missing data (for example when sale history is null, roof age is a year-built proxy, or near_power is a distance threshold).
- Prefer larger, industrially zoned, stably owned, near-power parcels when discussing data-center suitability.
- Keep answers concise but specific. Name concrete parcels from the tool results.
- Never use em dashes in any user-facing text. Use commas, periods, or parentheses instead.`;

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function distToPowerM(row: Record<string, unknown>): number | null {
  if (row.dist_to_power_m != null && Number.isFinite(Number(row.dist_to_power_m))) {
    const n = Number(row.dist_to_power_m);
    return n < 1e17 ? n : null;
  }
  const tx = row.dist_transmission_m != null ? Number(row.dist_transmission_m) : Number.POSITIVE_INFINITY;
  const sub = row.dist_substation_m != null ? Number(row.dist_substation_m) : Number.POSITIVE_INFINITY;
  const least = Math.min(tx, sub);
  return Number.isFinite(least) && least < 1e17 ? least : null;
}

function projectAgentRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    objectid: row.objectid ?? null,
    pin: asNullableString(row.pin),
    site_address: asNullableString(row.site_address),
    owner_name: asNullableString(row.owner_name),
    acreage: row.acreage != null ? Number(row.acreage) : null,
    years_since_sale: row.years_since_sale != null ? Number(row.years_since_sale) : null,
    stable_ownership: Boolean(row.stable_ownership),
    is_industrial: Boolean(row.is_industrial),
    near_power: Boolean(row.near_power),
    dist_to_power_m: distToPowerM(row),
    source_system: asNullableString(row.source_system),
    source_url: asNullableString(row.source_url),
    retrieved_at: asNullableString(row.retrieved_at),
  };
}

function sourceFromRow(row: Record<string, unknown>): AgentSource {
  return {
    pin: asNullableString(row.pin),
    site_address: asNullableString(row.site_address),
    owner_name: asNullableString(row.owner_name),
    source_url: asNullableString(row.source_url),
    retrieved_at: asNullableString(row.retrieved_at),
  };
}

function sourceKey(source: AgentSource): string {
  return [
    source.pin ?? "",
    source.site_address ?? "",
    source.source_url ?? "",
    source.retrieved_at ?? "",
  ].join("|");
}

function collectSources(
  bag: Map<string, AgentSource>,
  rows: Array<Record<string, unknown>>,
): void {
  for (const row of rows) {
    const source = sourceFromRow(row);
    if (!source.pin && !source.site_address && !source.source_url) continue;
    bag.set(sourceKey(source), source);
  }
}

function createBedrockProvider() {
  return createAmazonBedrock({
    region: process.env.AWS_REGION ?? process.env.BEDROCK_REGION ?? "us-east-2",
  });
}

export async function runAgentAsk(
  duckdb: DuckDbClient,
  question: string,
): Promise<AgentAskResponse> {
  const sourceBag = new Map<string, AgentSource>();
  const bedrock = createBedrockProvider();

  const result = await generateText({
    model: bedrock(BEDROCK_MODEL_ID),
    system: SYSTEM_PROMPT,
    prompt: question,
    stopWhen: stepCountIs(6),
    tools: {
      searchParcels: tool({
        description:
          "Search Rock Island County parcels by acreage, industrial zoning, ownership stability, out-of-area ownership, proximity signals, or free-text owner/address match. Returns provenance for each row.",
        inputSchema: searchToolInputSchema,
        execute: async (filters) => {
          const page = await searchParcels(duckdb, {
            ...filters,
            page: 1,
            pageSize: AGENT_ROW_CAP,
          });
          const rows = page.rows.map(projectAgentRow);
          collectSources(sourceBag, rows);
          return {
            total: page.total,
            returned: rows.length,
            rows,
          };
        },
      }),
      dataCenterCandidates: tool({
        description:
          "Rank data-center candidate parcels: large, industrial, stable ownership, and within a power radius (meters) of transmission or substations. Returns provenance and dist_to_power_m.",
        inputSchema: dataCenterToolInputSchema,
        execute: async ({ minAcres, powerRadiusM }) => {
          const page = await dataCenterCandidates(duckdb, {
            minAcres,
            powerRadiusM,
            page: 1,
            pageSize: AGENT_ROW_CAP,
          });
          const rows = page.rows.map(projectAgentRow);
          collectSources(sourceBag, rows);
          return {
            total: page.total,
            returned: rows.length,
            minAcres,
            powerRadiusM,
            rows,
          };
        },
      }),
      parcelDetail: tool({
        description:
          "Fetch one parcel by objectid for detailed identity, ownership, distances, and provenance.",
        inputSchema: z.object({
          objectid: z.number().int().positive(),
        }),
        execute: async ({ objectid }) => {
          const parcel = await getParcelByObjectId(duckdb, objectid);
          if (!parcel) {
            return { parcel: null };
          }
          const projected = projectAgentRow(parcel);
          collectSources(sourceBag, [projected]);
          return { parcel: projected };
        },
      }),
    },
  });

  return {
    answer: result.text.trim(),
    sources: [...sourceBag.values()],
  };
}

export const agentRouter = router({
  ask: loggedProcedure
    .input(agentAskInputSchema)
    .mutation(async ({ ctx, input }): Promise<AgentAskResponse> => {
      return runAgentAsk(ctx.duckdb, input.question);
    }),
});

export type AgentRouter = typeof agentRouter;
