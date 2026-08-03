import {
  dataCenterCandidatesInputSchema,
  parcelIdSchema,
  PRESET_LABELS,
  PRESET_LIMITATIONS,
  presetQueryInputSchema,
  searchParcelsInputSchema,
  type DataCenterCandidatesInput,
  type PagedParcelsResponse,
  type PresetQueryInput,
  type PresetQueryResponse,
  type SearchParcelsInput,
} from "@oracle/shared";
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

export async function queryPaged(
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

export async function searchParcels(
  duckdb: DuckDbClient,
  input: SearchParcelsInput,
): Promise<PagedParcelsResponse> {
  const parsed = searchParcelsInputSchema.parse(input);
  const where = buildSearchWhereClause(parsed);
  return queryPaged(
    duckdb,
    SEARCH_SELECT_COLUMNS,
    where.sql,
    where.params,
    parsed.page,
    parsed.pageSize,
    // Order by a hash, not objectid: objectids cluster by township, so paging or
    // capping by objectid shows one corner of the county. A hash spreads the
    // result set (and the mapped subset) representatively across the county.
    "hash(objectid), objectid",
  );
}

export async function dataCenterCandidates(
  duckdb: DuckDbClient,
  input: DataCenterCandidatesInput,
): Promise<PagedParcelsResponse> {
  const parsed = dataCenterCandidatesInputSchema.parse(input);
  const where = buildDataCenterWhereClause(parsed);
  return queryPaged(
    duckdb,
    DATA_CENTER_SELECT_COLUMNS,
    where.sql,
    where.params,
    parsed.page,
    parsed.pageSize,
    "acreage DESC NULLS LAST, objectid",
  );
}

export async function getParcelByObjectId(
  duckdb: DuckDbClient,
  objectid: number,
): Promise<Record<string, unknown> | null> {
  const parsed = parcelIdSchema.parse({ objectid });
  const rows = await duckdb.query<Record<string, unknown>>(
    `SELECT * FROM ${PARCELS_API_TABLE} WHERE objectid = ?`,
    [parsed.objectid],
  );
  return rows[0] ?? null;
}

export async function presetQuery(
  duckdb: DuckDbClient,
  input: PresetQueryInput,
): Promise<PresetQueryResponse> {
  const parsed = presetQueryInputSchema.parse(input);
  const whereSql = buildPresetWhereClause(parsed.preset);
  const paged = await queryPaged(
    duckdb,
    SEARCH_SELECT_COLUMNS,
    whereSql,
    [],
    parsed.page,
    parsed.pageSize,
    "hash(objectid), objectid",
  );
  return {
    ...paged,
    preset: parsed.preset,
    label: PRESET_LABELS[parsed.preset],
    limitation: PRESET_LIMITATIONS[parsed.preset],
  };
}
