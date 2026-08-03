import { COUNTY } from "../county.js";

/** County bounding box (EPSG:4326), from the active county config. */
export const ARCGIS_BBOX = COUNTY.bbox;

/** Overpass bbox (south, west, north, east), derived from the county bbox. */
export const OVERPASS_BBOX = {
  south: COUNTY.bbox.ymin,
  west: COUNTY.bbox.xmin,
  north: COUNTY.bbox.ymax,
  east: COUNTY.bbox.xmax,
} as const;

// HIFLD transmission lines is a national dataset, filtered by the county bbox.
export const HIFLD_TRANSMISSION_URL =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const UTM_SRID = COUNTY.utmSrid;
export const WGS84_SRID = "EPSG:4326";

/** ~0.5 mi walkshed for transit and Starbucks. */
export const TRANSIT_WALK_THRESHOLD_M = 800;
export const STARBUCKS_WALK_THRESHOLD_M = 800;

/** Proximity proxy for water view, not line-of-sight. */
export const WATER_PROXIMITY_THRESHOLD_M = 300;

/** Default ~1 mi radius for near_power / dc_candidate. */
export const DEFAULT_POWER_RADIUS_M = 1609;

/** Default minimum acreage for dc_candidate. */
export const DEFAULT_MIN_ACRES = 5;

export const ENRICHMENT_LIMITATIONS = [
  "Roof age is estimated from the year each building was built, so it is an approximation. Permit records would give a more exact figure where they are available.",
  "When a parcel has no sale on record, it is treated as long held. A missing sale date does not prove the parcel was never sold.",
] as const;

export const RAW_ENRICHMENT_FILES = {
  transmissionLines: "hifld-transmission-lines.geojson",
  substations: "osm-substations.json",
  transit: "osm-transit.json",
  starbucks: "osm-starbucks.json",
  water: "osm-water.json",
} as const;
