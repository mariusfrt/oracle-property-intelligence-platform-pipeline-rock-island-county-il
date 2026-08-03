/** Rock Island County + Quad Cities surroundings (EPSG:4326). */
export const ARCGIS_BBOX = {
  xmin: -91.0,
  ymin: 41.2,
  xmax: -89.7,
  ymax: 42.0,
} as const;

/** Overpass bbox: south, west, north, east. */
export const OVERPASS_BBOX = {
  south: 41.2,
  west: -91.0,
  north: 42.0,
  east: -89.7,
} as const;

export const HIFLD_TRANSMISSION_URL =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const UTM_SRID = "EPSG:32615";
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
