import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  presetQueryKindSchema,
  searchParcelsFiltersSchema,
  type SearchParcelsFilters,
} from "@oracle/shared";
import type { DuckDbClient } from "../db/duckdb.js";
import {
  dataCenterCandidates,
  getParcelByObjectId,
  presetQuery,
  searchParcels,
} from "../queries/parcels.js";
import { loggedProcedure, router } from "../trpc.js";

const BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const AGENT_MODEL_ROW_CAP = 25;
const AGENT_PARCEL_CAP = 40;

const agentAskInputSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  filters: searchParcelsFiltersSchema.optional(),
});

/** Full raw parcel row returned to the UI (map + results table). */
export type ParcelRow = Record<string, unknown>;

export interface AgentAskResponse {
  answer: string;
  parcels: ParcelRow[];
  /** Largest matching-set size the agent's tools reported (may exceed the parcels shown). */
  matchedTotal: number;
}

const searchToolInputSchema = z.object({
  minAcres: z.number().min(0).optional(),
  maxAcres: z.number().min(0).optional(),
  industrial: z.boolean().optional(),
  stableOwnership: z.boolean().optional(),
  ownerOutOfArea: z.boolean().optional(),
  nearPower: z.boolean().optional(),
  nearWater: z.boolean().optional(),
  nearTransit: z.boolean().optional(),
  nearStarbucks: z.boolean().optional(),
  query: z.string().trim().optional(),
});

const dataCenterToolInputSchema = z.object({
  minAcres: z.number().min(0).default(20),
  powerRadiusM: z.number().min(0).default(1609),
});

const SYSTEM_PROMPT_TEMPLATE = `You are the property intelligence agent for Rock Island County, Illinois. You help users explore parcels and assess data-center site suitability by querying a DuckDB dataset through the provided tools. You never invent data.

Data context (columns and meaning):
- acreage: parcel size in acres.
- zoning and is_industrial: zoning code and whether it is industrial.
- owner_name, owner_state, owner_out_of_area: owner and whether the owner is outside the local area.
- stable_ownership: true when there is no recorded sale in 10 or more years. A missing sale date is treated as long held, which is an assumption, not proof.
- years_since_sale: years since the last recorded sale, when known.
- roof_age_proxy_yrs: estimated roof age from the year built, a proxy, not permit verified.
- near_power and dist_to_power_m: near_power is true within about one mile (1609 meters) of a transmission line or substation; dist_to_power_m is the straight line distance to the nearest one.
- near_water, near_transit, near_starbucks: within about 800 meters, a short walk. near_water is a proximity proxy for a water view, not a confirmed line of sight.
- source_url, source_system, retrieved_at: provenance for each record.

Tools: use searchParcels for signal based filtering, dataCenterCandidates for ranked large industrial stable near power sites, presetQuery for the standard question types (roof age over 15 years, water view, no recorded sale over 10 years, regional owner, near transit, near Starbucks), and parcelDetail for a single parcel.

Active interface filters: {FILTERS}. Every search you run is automatically constrained to these, so your results already respect the user's selection.

How to answer:
- The matching parcels are shown to the user in a results table and on a map, so you do not need to list every field. Focus on a clear, concise explanation.
- Explain your reasoning: which signals or thresholds you used and why the parcels matter.
- Name several concrete parcels by owner and pin or address as examples.
- Always state assumptions and missing data, for example ownership stability inferred from no recorded sale, roof age as a year built proxy, or power proximity as straight line distance.
- Never use em dashes. Use commas, periods, or parentheses.`;

const BOOLEAN_FILTER_KEYS = [
  "industrial",
  "stableOwnership",
  "ownerOutOfArea",
  "nearPower",
  "nearWater",
  "nearTransit",
  "nearStarbucks",
] as const;

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
  const tx =
    row.dist_transmission_m != null ? Number(row.dist_transmission_m) : Number.POSITIVE_INFINITY;
  const sub =
    row.dist_substation_m != null ? Number(row.dist_substation_m) : Number.POSITIVE_INFINITY;
  const least = Math.min(tx, sub);
  return Number.isFinite(least) && least < 1e17 ? least : null;
}

/** Compact projection sent to the model (no geom_geojson). */
function projectCompactRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    objectid: row.objectid ?? null,
    pin: asNullableString(row.pin),
    site_address: asNullableString(row.site_address),
    owner_name: asNullableString(row.owner_name),
    owner_state: asNullableString(row.owner_state),
    acreage: row.acreage != null ? Number(row.acreage) : null,
    zoning: asNullableString(row.zoning),
    years_since_sale: row.years_since_sale != null ? Number(row.years_since_sale) : null,
    stable_ownership: Boolean(row.stable_ownership),
    is_industrial: Boolean(row.is_industrial),
    near_power: Boolean(row.near_power),
    near_water: Boolean(row.near_water),
    near_transit: Boolean(row.near_transit),
    dist_to_power_m: distToPowerM(row),
    source_system: asNullableString(row.source_system),
    source_url: asNullableString(row.source_url),
    retrieved_at: asNullableString(row.retrieved_at),
  };
}

/** Full row for the UI response, including geom_geojson. */
function projectFullParcelRow(row: Record<string, unknown>): ParcelRow {
  return {
    objectid: row.objectid != null ? Number(row.objectid) : null,
    pin: asNullableString(row.pin),
    site_address: asNullableString(row.site_address),
    acreage: row.acreage != null ? Number(row.acreage) : null,
    zoning: asNullableString(row.zoning),
    owner_name: asNullableString(row.owner_name),
    owner_state: asNullableString(row.owner_state),
    stable_ownership: Boolean(row.stable_ownership),
    is_industrial: Boolean(row.is_industrial),
    near_power: Boolean(row.near_power),
    near_water: Boolean(row.near_water),
    near_transit: Boolean(row.near_transit),
    years_since_sale: row.years_since_sale != null ? Number(row.years_since_sale) : null,
    dist_to_power_m: distToPowerM(row),
    geom_geojson: asNullableString(row.geom_geojson),
    source_system: asNullableString(row.source_system),
    source_url: asNullableString(row.source_url),
    retrieved_at: asNullableString(row.retrieved_at),
  };
}

/**
 * Merge tool-proposed filters with UI base filters.
 * Base filters always win: true booleans are forced, minAcres takes the max, maxAcres the min.
 */
export function mergeWithBaseFilters(
  base: SearchParcelsFilters,
  tool: SearchParcelsFilters,
): SearchParcelsFilters {
  const merged: SearchParcelsFilters = { ...tool };

  if (base.minAcres != null) {
    merged.minAcres =
      merged.minAcres != null ? Math.max(base.minAcres, merged.minAcres) : base.minAcres;
  }
  if (base.maxAcres != null) {
    merged.maxAcres =
      merged.maxAcres != null ? Math.min(base.maxAcres, merged.maxAcres) : base.maxAcres;
  }
  for (const key of BOOLEAN_FILTER_KEYS) {
    if (base[key] === true) {
      merged[key] = true;
    }
  }
  if (base.query != null && base.query !== "") {
    merged.query = base.query;
  }

  return merged;
}

function rowMatchesBaseFilters(
  row: Record<string, unknown>,
  base: SearchParcelsFilters,
): boolean {
  if (base.minAcres != null && !(Number(row.acreage) >= base.minAcres)) return false;
  if (base.maxAcres != null && !(Number(row.acreage) <= base.maxAcres)) return false;
  if (base.industrial === true && !row.is_industrial) return false;
  if (base.stableOwnership === true && !row.stable_ownership) return false;
  if (base.ownerOutOfArea === true && !row.owner_out_of_area) return false;
  if (base.nearPower === true && !row.near_power) return false;
  if (base.nearWater === true && !row.near_water) return false;
  if (base.nearTransit === true && !row.near_transit) return false;
  if (base.nearStarbucks === true && !row.near_starbucks) return false;
  if (base.query) {
    const q = base.query.toLowerCase();
    const owner = String(row.owner_name ?? "").toLowerCase();
    const address = String(row.site_address ?? "").toLowerCase();
    if (!owner.includes(q) && !address.includes(q)) return false;
  }
  return true;
}

function formatFiltersForPrompt(filters: SearchParcelsFilters): string {
  const parts: string[] = [];
  if (filters.minAcres != null) parts.push(`min acres ${filters.minAcres}`);
  if (filters.maxAcres != null) parts.push(`max acres ${filters.maxAcres}`);
  if (filters.industrial === true) parts.push("industrial zoning");
  if (filters.stableOwnership === true) parts.push("stable ownership");
  if (filters.ownerOutOfArea === true) parts.push("out-of-area owner");
  if (filters.nearPower === true) parts.push("near power");
  if (filters.nearWater === true) parts.push("near water");
  if (filters.nearTransit === true) parts.push("near transit");
  if (filters.nearStarbucks === true) parts.push("near Starbucks");
  if (filters.query) parts.push(`text query "${filters.query}"`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function accumulateParcels(
  bag: Map<number, ParcelRow>,
  rows: Array<Record<string, unknown>>,
): void {
  for (const row of rows) {
    if (bag.size >= AGENT_PARCEL_CAP) break;
    const id = Number(row.objectid);
    if (!Number.isFinite(id) || bag.has(id)) continue;
    bag.set(id, projectFullParcelRow(row));
  }
}

function createBedrockProvider() {
  return createAmazonBedrock({
    region: process.env.AWS_REGION ?? process.env.BEDROCK_REGION ?? "us-east-2",
    // Resolve credentials from the full AWS chain (env vars on Lambda, or SSO /
    // shared profile / role locally) so the agent works without exporting keys.
    credentialProvider: fromNodeProviderChain(),
  });
}

export async function runAgentAsk(
  duckdb: DuckDbClient,
  question: string,
  baseFilters: SearchParcelsFilters = {},
): Promise<AgentAskResponse> {
  const parcelBag = new Map<number, ParcelRow>();
  let matchedTotal = 0;
  const bedrock = createBedrockProvider();
  const system = SYSTEM_PROMPT_TEMPLATE.replace(
    "{FILTERS}",
    formatFiltersForPrompt(baseFilters),
  );

  const result = await generateText({
    model: bedrock(BEDROCK_MODEL_ID),
    system,
    prompt: question,
    stopWhen: stepCountIs(6),
    tools: {
      searchParcels: tool({
        description:
          "Search Rock Island County parcels by acreage, industrial zoning, ownership stability, out-of-area ownership, proximity signals, or free-text owner/address match. Results are constrained by the active interface filters.",
        inputSchema: searchToolInputSchema,
        execute: async (toolFilters) => {
          const merged = mergeWithBaseFilters(baseFilters, toolFilters);
          const page = await searchParcels(duckdb, {
            ...merged,
            page: 1,
            pageSize: AGENT_MODEL_ROW_CAP,
          });
          accumulateParcels(parcelBag, page.rows);
          matchedTotal = Math.max(matchedTotal, page.total);
          return {
            total: page.total,
            returned: page.rows.length,
            rows: page.rows.map(projectCompactRow),
          };
        },
      }),
      dataCenterCandidates: tool({
        description:
          "Rank data-center candidate parcels: large, industrial, stable ownership, and within a power radius (meters) of transmission or substations.",
        inputSchema: dataCenterToolInputSchema,
        execute: async ({ minAcres, powerRadiusM }) => {
          const effectiveMin =
            baseFilters.minAcres != null ? Math.max(baseFilters.minAcres, minAcres) : minAcres;
          const page = await dataCenterCandidates(duckdb, {
            minAcres: effectiveMin,
            powerRadiusM,
            page: 1,
            pageSize: AGENT_MODEL_ROW_CAP,
          });
          const constrained = page.rows.filter((row) => rowMatchesBaseFilters(row, baseFilters));
          accumulateParcels(parcelBag, constrained);
          matchedTotal = Math.max(matchedTotal, page.total);
          return {
            total: constrained.length,
            returned: constrained.length,
            minAcres: effectiveMin,
            powerRadiusM,
            rows: constrained.map(projectCompactRow),
          };
        },
      }),
      presetQuery: tool({
        description:
          "Run a standard question preset: roof age over 15 years, water view, no recorded sale over 10 years, regional owner, near transit, or near Starbucks. Results are constrained by the active interface filters.",
        inputSchema: z.object({
          preset: presetQueryKindSchema,
        }),
        execute: async ({ preset }) => {
          const page = await presetQuery(duckdb, {
            preset,
            page: 1,
            pageSize: Math.min(100, AGENT_MODEL_ROW_CAP * 3),
          });
          const constrained = page.rows
            .filter((row) => rowMatchesBaseFilters(row, baseFilters))
            .slice(0, AGENT_MODEL_ROW_CAP);
          accumulateParcels(parcelBag, constrained);
          matchedTotal = Math.max(matchedTotal, page.total);
          return {
            preset,
            label: page.label,
            limitation: page.limitation,
            total: constrained.length,
            returned: constrained.length,
            rows: constrained.map(projectCompactRow),
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
          if (!rowMatchesBaseFilters(parcel, baseFilters)) {
            return {
              parcel: null,
              note: "Parcel exists but does not match the active interface filters.",
            };
          }
          accumulateParcels(parcelBag, [parcel]);
          return { parcel: projectCompactRow(parcel) };
        },
      }),
    },
  });

  const parcels = [...parcelBag.values()].slice(0, AGENT_PARCEL_CAP);
  return {
    answer: result.text.trim(),
    parcels,
    matchedTotal: Math.max(matchedTotal, parcels.length),
  };
}

export const agentRouter = router({
  ask: loggedProcedure
    .input(agentAskInputSchema)
    .mutation(async ({ ctx, input }): Promise<AgentAskResponse> => {
      return runAgentAsk(ctx.duckdb, input.question, input.filters ?? {});
    }),
});

export type AgentRouter = typeof agentRouter;
