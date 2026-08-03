import {
  DOCUMENTED_LAYER_COUNTS,
  GLOBAL_LIMITATIONS,
  type SummaryResponse,
} from "@oracle/shared";
import { PARCELS_API_TABLE, type DuckDbClient } from "../db/duckdb.js";

/**
 * Dataset summary shared by tRPC parcels.summary and MCP get_dataset_info.
 * Does not change parcel query SQL; only reads COUNT + provenance.
 */
export async function getDatasetSummary(duckdb: DuckDbClient): Promise<SummaryResponse> {
  const table = PARCELS_API_TABLE;
  const parcelCount = await duckdb.count(`SELECT COUNT(*)::BIGINT AS count FROM ${table}`);

  const [provenance] = await duckdb.query<{
    source_url: string | null;
    retrieved_at: string | null;
  }>(
    `SELECT ANY_VALUE(source_url) AS source_url, CAST(MAX(retrieved_at) AS VARCHAR) AS retrieved_at FROM ${table}`,
  );

  return {
    layers: {
      parcels: {
        count: parcelCount,
        sourceUrl: provenance?.source_url ?? null,
        retrievedAt: provenance?.retrieved_at ?? null,
      },
      transmission: {
        count: DOCUMENTED_LAYER_COUNTS.transmission,
        sourceUrl: null,
        retrievedAt: null,
      },
      substations: {
        count: DOCUMENTED_LAYER_COUNTS.substations,
        sourceUrl: null,
        retrievedAt: null,
      },
      transit: {
        count: DOCUMENTED_LAYER_COUNTS.transit,
        sourceUrl: null,
        retrievedAt: null,
      },
      starbucks: {
        count: DOCUMENTED_LAYER_COUNTS.starbucks,
        sourceUrl: null,
        retrievedAt: null,
      },
      water: {
        count: DOCUMENTED_LAYER_COUNTS.water,
        sourceUrl: null,
        retrievedAt: null,
      },
    },
    infraNote:
      "Results are computed on demand from a single data file bundled inside the serverless API. There is no always-on database, so it only runs, and only costs, when a query comes in. Eligible, non-personal dataset artifacts are published to IPFS for decentralized storage and independent verification, while owner and financial data stay in the access-gated app.",
    limitations: [...GLOBAL_LIMITATIONS],
  };
}
