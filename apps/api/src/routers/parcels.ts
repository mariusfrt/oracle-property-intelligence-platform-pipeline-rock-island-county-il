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
  type PresetQueryInput,
  type SearchParcelsInput,
  type SummaryResponse,
} from "@oracle/shared";
import { loggedProcedure, router } from "../trpc.js";
import {
  DATA_CENTER_SELECT_COLUMNS,
  escapeLikePattern,
  paginationClause,
  PARCELS_API_TABLE,
  SEARCH_SELECT_COLUMNS,
  type DuckDbClient,
} from "../db/duckdb.js";

export function buildSearchWhereClause(filters: SearchParcelsInput): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.minAcres != null) {
    clauses.push("acreage >= ?");
    params.push(filters.minAcres);
  }
  if (filters.maxAcres != null) {
    clauses.push("acreage <= ?");
    params.push(filters.maxAcres);
  }
  if (filters.industrial === true) {
    clauses.push("is_industrial = true");
  }
  if (filters.ownerOutOfArea === true) {
    clauses.push("owner_out_of_area = true");
  }
  if (filters.stableOwnership === true) {
    clauses.push("stable_ownership = true");
  }
  if (filters.nearPower === true) {
    clauses.push("near_power = true");
  }
  if (filters.nearWater === true) {
    clauses.push("near_water = true");
  }
  if (filters.nearTransit === true) {
    clauses.push("near_transit = true");
  }
  if (filters.nearStarbucks === true) {
    clauses.push("near_starbucks = true");
  }
  if (filters.query) {
    const pattern = `%${escapeLikePattern(filters.query)}%`;
    clauses.push(
      "(owner_name ILIKE ? ESCAPE '\\' OR site_address ILIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern);
  }

  return {
    sql: clauses.length > 0 ? clauses.join(" AND ") : "1=1",
    params,
  };
}

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

export function buildPresetWhereClause(preset: PresetQueryInput["preset"]): string {
  switch (preset) {
    case "roof_age_over_15y":
      return "roof_age_proxy_yrs > 15";
    case "water_view":
      return "near_water = true";
    case "no_recorded_sale_over_10y":
      return "years_since_sale > 10";
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

async function queryPaged(
  duckdb: DuckDbClient,
  selectColumns: readonly string[],
  whereSql: string,
  whereParams: unknown[],
  page: number,
  pageSize: number,
  orderBy: string,
): Promise<PagedParcelsResponse> {
  const table = PARCELS_API_TABLE;
  const total = await duckdb.count(
    `SELECT COUNT(*)::BIGINT AS count FROM ${table} WHERE ${whereSql}`,
    whereParams,
  );

  const { sql: limitSql, params: limitParams } = paginationClause(page, pageSize);
  const rows = await duckdb.query<Record<string, unknown>>(
    `SELECT ${selectColumns.join(", ")} FROM ${table} WHERE ${whereSql} ORDER BY ${orderBy} ${limitSql}`,
    [...whereParams, ...limitParams],
  );

  return { rows, total, page, pageSize };
}

export const parcelsRouter = router({
  summary: loggedProcedure.query(async ({ ctx }): Promise<SummaryResponse> => {
    const table = PARCELS_API_TABLE;
    const parcelCount = await ctx.duckdb.count(
      `SELECT COUNT(*)::BIGINT AS count FROM ${table}`,
    );

    const [provenance] = await ctx.duckdb.query<{
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
        "Queried live via DuckDB in-memory over S3 Parquet (httpfs); no always-on hosted database.",
      limitations: [...GLOBAL_LIMITATIONS],
    };
  }),

  searchParcels: loggedProcedure
    .input(searchParcelsInputSchema)
    .query(async ({ ctx, input }): Promise<PagedParcelsResponse> => {
      const where = buildSearchWhereClause(input);
      return queryPaged(
        ctx.duckdb,
        SEARCH_SELECT_COLUMNS,
        where.sql,
        where.params,
        input.page,
        input.pageSize,
        "objectid",
      );
    }),

  parcel: loggedProcedure.input(parcelIdSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.duckdb.query<Record<string, unknown>>(
      `SELECT * FROM ${PARCELS_API_TABLE} WHERE objectid = ?`,
      [input.objectid],
    );
    return { parcel: rows[0] ?? null };
  }),

  dataCenterCandidates: loggedProcedure
    .input(dataCenterCandidatesInputSchema)
    .query(async ({ ctx, input }): Promise<PagedParcelsResponse> => {
      const where = buildDataCenterWhereClause(input);
      return queryPaged(
        ctx.duckdb,
        DATA_CENTER_SELECT_COLUMNS,
        where.sql,
        where.params,
        input.page,
        input.pageSize,
        "acreage DESC NULLS LAST, objectid",
      );
    }),

  presetQuery: loggedProcedure.input(presetQueryInputSchema).query(async ({ ctx, input }) => {
    const whereSql = buildPresetWhereClause(input.preset);
    const paged = await queryPaged(
      ctx.duckdb,
      SEARCH_SELECT_COLUMNS,
      whereSql,
      [],
      input.page,
      input.pageSize,
      "objectid",
    );
    return {
      ...paged,
      preset: input.preset,
      label: PRESET_LABELS[input.preset],
      limitation: PRESET_LIMITATIONS[input.preset],
    };
  }),
});

export type ParcelsRouter = typeof parcelsRouter;
