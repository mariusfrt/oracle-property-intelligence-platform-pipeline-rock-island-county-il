import { describe, expect, it } from "vitest";
import {
  computeDcCandidate,
  computeProximityFlags,
  isNearDistance,
  isOwnerOutOfArea,
  isStableOwnership,
  nearestPowerDistanceM,
} from "./thresholds.js";
import { isIndustrialZoning, normalizeZoning } from "./zoning.js";

describe("normalizeZoning", () => {
  it("strips spaces, question marks, and exclamation marks then uppercases", () => {
    expect(normalizeZoning("I2?")).toBe("I2");
    expect(normalizeZoning("i1 !")).toBe("I1");
    expect(normalizeZoning("  R3  ")).toBe("R3");
  });

  it("returns empty string for nullish zoning", () => {
    expect(normalizeZoning(null)).toBe("");
    expect(normalizeZoning(undefined)).toBe("");
  });
});

describe("isIndustrialZoning", () => {
  it("matches industrial codes starting with I", () => {
    expect(isIndustrialZoning("I2")).toBe(true);
    expect(isIndustrialZoning("I1")).toBe(true);
    expect(isIndustrialZoning("R3")).toBe(false);
    expect(isIndustrialZoning("")).toBe(false);
  });
});

describe("proximity thresholds", () => {
  it("computes nearest power distance from transmission and substation", () => {
    expect(nearestPowerDistanceM(1200, 800)).toBe(800);
    expect(nearestPowerDistanceM(null, 500)).toBe(500);
    expect(nearestPowerDistanceM(null, null)).toBeNull();
  });

  it("flags near_transit, near_starbucks, near_water at documented thresholds", () => {
    const flags = computeProximityFlags({
      distTransmissionM: 2000,
      distSubstationM: 1500,
      distTransitM: 799,
      distStarbucksM: 801,
      distWaterM: 300,
    });

    expect(flags.nearTransit).toBe(true);
    expect(flags.nearStarbucks).toBe(false);
    expect(flags.nearWater).toBe(true);
    expect(flags.nearPower).toBe(true);
  });

  it("returns false for near flags when distance is null", () => {
    expect(isNearDistance(null, 800)).toBe(false);
    const flags = computeProximityFlags({
      distTransmissionM: null,
      distSubstationM: null,
      distTransitM: null,
      distStarbucksM: null,
      distWaterM: null,
    });
    expect(flags.nearTransit).toBe(false);
    expect(flags.nearPower).toBe(false);
  });

  it("treats power radius default (~1 mi) for near_power", () => {
    const within = computeProximityFlags({
      distTransmissionM: 1600,
      distSubstationM: null,
      distTransitM: null,
      distStarbucksM: null,
      distWaterM: null,
    });
    const outside = computeProximityFlags({
      distTransmissionM: 1610,
      distSubstationM: null,
      distTransitM: null,
      distStarbucksM: null,
      distWaterM: null,
    });
    expect(within.nearPower).toBe(true);
    expect(outside.nearPower).toBe(false);
  });
});

describe("stable ownership and dc_candidate", () => {
  it("treats null last sale as stable (no recorded sale)", () => {
    expect(isStableOwnership(null, null)).toBe(true);
    expect(isStableOwnership("2010-01-01", 16)).toBe(true);
    expect(isStableOwnership("2020-01-01", 6)).toBe(false);
  });

  it("flags owner_out_of_area for non-IL states", () => {
    expect(isOwnerOutOfArea("IA")).toBe(true);
    expect(isOwnerOutOfArea("IL")).toBe(false);
    expect(isOwnerOutOfArea(null)).toBe(false);
  });

  it("requires acreage, industrial, stable ownership, and near_power for dc_candidate", () => {
    expect(
      computeDcCandidate({
        acreage: 10,
        isIndustrial: true,
        stableOwnership: true,
        nearPower: true,
      }),
    ).toBe(true);
    expect(
      computeDcCandidate({
        acreage: 3,
        isIndustrial: true,
        stableOwnership: true,
        nearPower: true,
      }),
    ).toBe(false);
    expect(
      computeDcCandidate({
        acreage: 10,
        isIndustrial: false,
        stableOwnership: true,
        nearPower: true,
      }),
    ).toBe(false);
  });
});
