import type { Feature, FeatureCollection, Geometry } from "./types.js";

type RawProps = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n == null ? null : Math.trunc(n);
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const epoch = Number(s);
  if (Number.isFinite(epoch) && epoch > 1_000_000_000_000) {
    return new Date(epoch).toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function sumNumbers(...values: unknown[]): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    const n = asNumber(value);
    if (n != null) {
      total += n;
      seen = true;
    }
  }
  return seen ? total : null;
}

export function resolvePin(props: RawProps): string {
  const pin = asString(props.parcel_number) ?? asString(props.PIN);
  if (pin) return pin;
  const objectId = asInt(props.OBJECTID);
  if (objectId != null) return `OBJECTID-${objectId}`;
  throw new Error("Feature missing parcel_number, PIN, and OBJECTID");
}

export interface MappedParcelRow {
  pin: string;
  alt_pin: string | null;
  objectid: number | null;
  geometry: Geometry | null;
  lon: number | null;
  lat: number | null;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_zip: string | null;
  municipality: string | null;
  township: string | null;
  jurisdiction: string | null;
  gis_acres: number | null;
  gross_acres: number | null;
  zoning: string | null;
  class: string | null;
  emv: number | null;
  eav: number | null;
  land_value: number | null;
  building_value: number | null;
  owner_name: string | null;
  owner_addr: string | null;
  owner_city: string | null;
  owner_state: string | null;
  owner_zip: string | null;
  taxbill_name: string | null;
  taxbill_addr: string | null;
  taxbill_csz: string | null;
  taxbill_year: number | null;
  date_last_sale: string | null;
  date_of_sale: string | null;
  gross_sale_price: number | null;
  year_built: number | null;
  total_sqft: number | null;
  garage_sqft: number | null;
  source_payload: RawProps;
}

export function mapFeatureToRow(feature: Feature): MappedParcelRow {
  const props = feature.properties ?? {};

  return {
    pin: resolvePin(props),
    alt_pin: asString(props.alternate_parcel_number) ?? asString(props.RICO_PARCE),
    objectid: asInt(props.OBJECTID),
    geometry: feature.geometry ?? null,
    lon: asNumber(props.X_longitude),
    lat: asNumber(props.Y_latitude),
    site_address: asString(props.site_address),
    site_city: asString(props.Site_City),
    site_state: asString(props.Site_State),
    site_zip: asString(props.Site_Zip),
    municipality: asString(props.municipality),
    township: asString(props.township),
    jurisdiction: asString(props.Jurisdiction),
    gis_acres: asNumber(props.GIS_acres_num),
    gross_acres: asNumber(props.gross_acres),
    zoning: asString(props.Zoning),
    class: asString(props.class),
    emv: asNumber(props.EMV),
    eav: asNumber(props.EAV),
    land_value: sumNumbers(props.non_farm_land, props.farm_land),
    building_value: sumNumbers(props.non_farm_building, props.farm_building),
    owner_name: asString(props.owner1_name),
    owner_addr: asString(props.owner1_address1),
    owner_city: asString(props.Owner_city),
    owner_state: asString(props.Owner_state),
    owner_zip: asString(props.Owner_Zip),
    taxbill_name: asString(props.taxbill_name),
    taxbill_addr: asString(props.taxbill_addr),
    taxbill_csz: asString(props.taxbill_csz),
    taxbill_year: asInt(props.taxbill_year),
    date_last_sale: parseDate(props.date_last_sale),
    date_of_sale: parseDate(props.date_of_sale),
    gross_sale_price: asNumber(props.gross_sale_price),
    year_built: asInt(props.YRBuilt),
    total_sqft: asNumber(props.TOTSQFT),
    garage_sqft: asNumber(props.GarSQFT),
    source_payload: props,
  };
}

export function parseFeatureCollection(raw: unknown): FeatureCollection {
  if (
    typeof raw !== "object" ||
    raw == null ||
    !("type" in raw) ||
    (raw as FeatureCollection).type !== "FeatureCollection"
  ) {
    throw new Error("Expected GeoJSON FeatureCollection");
  }
  const fc = raw as FeatureCollection;
  if (!Array.isArray(fc.features)) {
    throw new Error("FeatureCollection missing features array");
  }
  return fc;
}

export function pageFileName(offset: number): string {
  return `page-${offset}.geojson`;
}

export function listPageOffsets(files: string[]): number[] {
  const offsets: number[] = [];
  for (const file of files) {
    const match = /^page-(\d+)\.geojson$/.exec(file);
    if (match) offsets.push(Number(match[1]));
  }
  return offsets.sort((a, b) => a - b);
}
