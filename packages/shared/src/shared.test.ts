import { describe, expect, it } from "vitest";
import { parcelApiRowSchema } from "./parcel.js";
import { searchParcelsInputSchema, presetQueryKindSchema } from "./filters.js";

describe("parcelApiRowSchema", () => {
  it("requires objectid and accepts geom_geojson without geom", () => {
    const parsed = parcelApiRowSchema.safeParse({
      objectid: 1,
      geom_geojson: '{"type":"Point","coordinates":[-90.5,41.5]}',
      source_system: "RICO_GIS_Parcels_FeatureServer_0",
      source_url: "https://example.com",
      retrieved_at: "2026-08-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("searchParcelsInputSchema", () => {
  it("accepts filter flags and pagination defaults", () => {
    const parsed = searchParcelsInputSchema.parse({
      nearPower: true,
      minAcres: 20,
    });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.nearPower).toBe(true);
  });
});

describe("presetQueryKindSchema", () => {
  it("includes all six generic presets", () => {
    expect(presetQueryKindSchema.options).toHaveLength(6);
  });
});
