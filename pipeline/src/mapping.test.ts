import { describe, expect, it } from "vitest";
import { buildQueryUrl, PAGE_SIZE, PILOT_PAGE_SIZE } from "./config.js";
import { listPageOffsets, mapFeatureToRow, pageFileName, resolvePin } from "./mapping.js";
import { CREATE_PARCELS_TABLE_SQL } from "./schema.js";

describe("config", () => {
  it("builds ArcGIS query URLs with pagination params", () => {
    const url = buildQueryUrl(4000, PAGE_SIZE);
    expect(url).toContain("f=geojson");
    expect(url).toContain("resultOffset=4000");
    expect(url).toContain("resultRecordCount=2000");
    expect(url).toContain("orderByFields=OBJECTID");
  });
});

describe("schema", () => {
  it("uses objectid as primary key; pin is a non-unique attribute", () => {
    expect(CREATE_PARCELS_TABLE_SQL).toMatch(/objectid\s+BIGINT\s+PRIMARY KEY/i);
    expect(CREATE_PARCELS_TABLE_SQL).not.toMatch(/pin\s+TEXT\s+PRIMARY KEY/i);
    expect(CREATE_PARCELS_TABLE_SQL).toMatch(/pin\s+TEXT,/);
  });
});

describe("mapping", () => {
  it("resolves pin from parcel_number or PIN", () => {
    expect(resolvePin({ parcel_number: "123" })).toBe("123");
    expect(resolvePin({ PIN: "ABC" })).toBe("ABC");
    expect(resolvePin({ OBJECTID: 42 })).toBe("OBJECTID-42");
  });

  it("maps feature properties to canonical row shape", () => {
    const row = mapFeatureToRow({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: [] },
      properties: {
        parcel_number: "01-01-1001",
        alternate_parcel_number: "ALT1",
        OBJECTID: 1,
        X_longitude: -90.5,
        Y_latitude: 41.5,
        GIS_acres_num: 2.5,
        non_farm_land: 1000,
        farm_land: 500,
        non_farm_building: 200,
        farm_building: 50,
        EMV: 150000,
        Zoning: "I2",
      },
    });

    expect(row.pin).toBe("01-01-1001");
    expect(row.alt_pin).toBe("ALT1");
    expect(row.lon).toBe(-90.5);
    expect(row.land_value).toBe(1500);
    expect(row.building_value).toBe(250);
    expect(row.zoning).toBe("I2");
  });

  it("preserves distinct objectids when parcel_number is a shared placeholder", () => {
    const usa1 = mapFeatureToRow({
      type: "Feature",
      geometry: null,
      properties: { parcel_number: "USA", OBJECTID: 1001, GIS_acres_num: 1.0 },
    });
    const usa2 = mapFeatureToRow({
      type: "Feature",
      geometry: null,
      properties: { parcel_number: "USA", OBJECTID: 1002, GIS_acres_num: 2.0 },
    });

    expect(usa1.pin).toBe("USA");
    expect(usa2.pin).toBe("USA");
    expect(usa1.objectid).toBe(1001);
    expect(usa2.objectid).toBe(1002);
  });

  it("lists page offsets from filenames", () => {
    expect(pageFileName(0)).toBe("page-0.geojson");
    expect(listPageOffsets(["page-0.geojson", "page-2000.geojson", "readme.txt"])).toEqual([
      0, 2000,
    ]);
  });
});

describe("pilot sizing", () => {
  it("uses 200 record page size for pilot pulls", () => {
    expect(PILOT_PAGE_SIZE).toBe(200);
  });
});
