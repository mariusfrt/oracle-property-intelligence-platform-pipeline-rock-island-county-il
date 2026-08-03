import {
  dataCenterCandidatesInputSchema,
  DOCUMENTED_LAYER_COUNTS,
  GLOBAL_LIMITATIONS,
  parcelIdSchema,
  PRESET_LABELS,
  PRESET_LIMITATIONS,
  presetQueryInputSchema,
  searchParcelsInputSchema,
  type DataCenterCandidatesInput,
  type PagedParcelsResponse,
  type ParcelApiRow,
  type PresetQueryInput,
  type SearchParcelsInput,
  type SummaryResponse,
} from "@oracle/shared";
import { loggedProcedure, router } from "../trpc.js";
import { PARCELS_API_TABLE, SEARCH_SELECT_COLUMNS } from "../db/duckdb.js";

function emptyPaged(page: number, pageSize: number): PagedParcelsResponse {
  return { rows: [], total: 0, page, pageSize };
}

/** Stub summary — structure matches app-plan; counts from documented enrichment run. */
function stubSummary(): SummaryResponse {
  return {
    layers: {
      parcels: {
        count: DOCUMENTED_LAYER_COUNTS.parcels,
        sourceUrl: null,
        retrievedAt: null,
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
      "Queried live via DuckDB in-memory over S3 Parquet (httpfs); no always-on hosted database.",
    limitations: [...GLOBAL_LIMITATIONS],
  };
}

/**
 * TODO: build WHERE clause from SearchParcelsFilters against plain columns on
 * `${PARCELS_API_TABLE}` — no spatial functions; geom_geojson returned as text.
 */
export function buildSearchWhereClause(_filters: SearchParcelsInput): {
  sql: string;
  params: unknown[];
} {
  return { sql: "1=1", params: [] };
}

/**
 * TODO: live dc_candidate — ignore baked dc_candidate column; compute:
 * acreage >= minAcres AND is_industrial AND stable_ownership AND
 * least(dist_transmission_m, dist_substation_m) <= powerRadiusM
 */
export function buildDataCenterWhereClause(input: DataCenterCandidatesInput): {
  sql: string;
  params: unknown[];
} {
  return {
    sql: `acreage >= ? AND is_industrial = true AND stable_ownership = true
          AND least(coalesce(dist_transmission_m, 1e18), coalesce(dist_substation_m, 1e18)) <= ?`,
    params: [input.minAcres, input.powerRadiusM],
  };
}

/** TODO: map preset enum to WHERE on plain boolean/numeric columns. */
export function buildPresetWhereClause(preset: PresetQueryInput["preset"]): string {
  switch (preset) {
    case "roof_age_over_15y":
      return "roof_age_proxy_yrs > 15";
    case "water_view":
      return "near_water = true";
    case "no_recorded_sale_over_10y":
      return "stable_ownership = true";
    case "regional_owner":
      return "owner_out_of_area = true";
    case "near_transit":
      return "near_transit = true";
    case "near_starbucks":
      return "near_starbucks = true";
    default:
      return "1=0";
  }
}

export const parcelsRouter = router({
  /** Demo pipeline run summary — record counts by source + timestamps. */
  summary: loggedProcedure.query(async (): Promise<SummaryResponse> => {
    // TODO: read live counts/timestamps from enrichment-run-record or DuckDB metadata
    return stubSummary();
  }),

  /** Filtered parcel search with paged geom_geojson for map/table. */
  searchParcels: loggedProcedure
    .input(searchParcelsInputSchema)
    .query(async ({ input }): Promise<PagedParcelsResponse> => {
      const _where = buildSearchWhereClause(input);
      const _select = SEARCH_SELECT_COLUMNS.join(", ");
      void _where;
      void _select;
      void PARCELS_API_TABLE;
      // TODO: SELECT ... FROM read_parquet(...) WHERE ... LIMIT/OFFSET
      return emptyPaged(input.page, input.pageSize);
    }),

  /** Single parcel detail with all attributes, distances, provenance, geojson. */
  parcel: loggedProcedure.input(parcelIdSchema).query(async ({ input }) => {
    void input;
    // TODO: SELECT * FROM parcels_enriched_api WHERE objectid = ?
    return { parcel: null as ParcelApiRow | null };
  }),

  /**
   * Data-center candidates — configurable minAcres / powerRadiusM;
   * ignores baked dc_candidate; ranked by acreage DESC.
   */
  dataCenterCandidates: loggedProcedure
    .input(dataCenterCandidatesInputSchema)
    .query(async ({ input }): Promise<PagedParcelsResponse> => {
      const _where = buildDataCenterWhereClause(input);
      void _where;
      // TODO: ORDER BY acreage DESC
      return emptyPaged(input.page, input.pageSize);
    }),

  /** One of the six generic question presets. */
  presetQuery: loggedProcedure.input(presetQueryInputSchema).query(async ({ input }) => {
    const _where = buildPresetWhereClause(input.preset);
    void _where;
    return {
      ...emptyPaged(input.page, input.pageSize),
      preset: input.preset,
      label: PRESET_LABELS[input.preset],
      limitation: PRESET_LIMITATIONS[input.preset],
    };
  }),
});

export type ParcelsRouter = typeof parcelsRouter;
