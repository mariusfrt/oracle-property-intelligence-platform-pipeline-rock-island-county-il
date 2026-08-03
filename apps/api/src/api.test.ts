import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./db/duckdb.js";
import {
  buildDataCenterWhereClause,
  buildPresetWhereClause,
  buildSearchWhereClause,
} from "./queries/parcels.js";

describe("escapeLikePattern", () => {
  it("escapes LIKE metacharacters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });
});

describe("query builders", () => {
  it("buildSearchWhereClause applies filters with parameterized values", () => {
    const result = buildSearchWhereClause({
      page: 1,
      pageSize: 50,
      nearPower: true,
      minAcres: 10,
      query: "Smith",
    });
    expect(result.sql).toContain("near_power = true");
    expect(result.sql).toContain("acreage >= ?");
    expect(result.sql).toContain("ILIKE ?");
    expect(result.params).toEqual([10, "%Smith%", "%Smith%"]);
  });

  it("buildDataCenterWhereClause encodes configurable thresholds", () => {
    const result = buildDataCenterWhereClause({
      minAcres: 20,
      powerRadiusM: 1609,
      page: 1,
      pageSize: 50,
    });
    expect(result.params).toEqual([20, 1609]);
    expect(result.sql).toContain("is_industrial");
    expect(result.sql).toContain("stable_ownership");
  });

  it("buildPresetWhereClause maps all six presets", () => {
    expect(buildPresetWhereClause("roof_age_over_15y")).toContain("roof_age_proxy_yrs");
    expect(buildPresetWhereClause("no_recorded_sale_over_10y")).toContain("years_since_sale > 10");
    expect(buildPresetWhereClause("near_transit")).toContain("near_transit");
    expect(buildPresetWhereClause("near_starbucks")).toContain("near_starbucks");
  });
});
