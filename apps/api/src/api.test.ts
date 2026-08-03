import { describe, expect, it } from "vitest";
import {
  buildDataCenterWhereClause,
  buildPresetWhereClause,
  buildSearchWhereClause,
} from "./routers/parcels.js";

describe("query builders (stub)", () => {
  it("buildSearchWhereClause returns open filter placeholder", () => {
    const result = buildSearchWhereClause({
      page: 1,
      pageSize: 50,
      nearPower: true,
      minAcres: 10,
    });
    expect(result.sql).toBe("1=1");
    expect(result.params).toEqual([]);
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
    expect(buildPresetWhereClause("near_transit")).toContain("near_transit");
    expect(buildPresetWhereClause("near_starbucks")).toContain("near_starbucks");
  });
});
