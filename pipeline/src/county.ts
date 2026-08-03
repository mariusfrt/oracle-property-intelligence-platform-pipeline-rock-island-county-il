/**
 * County-specific configuration. The pipeline architecture (ArcGIS parcels +
 * Overpass OSM + HIFLD power lines + DuckDB) is county-agnostic; everything that
 * is specific to a given county lives here. To target another county, add a new
 * CountyConfig and point COUNTY at it, then re-run the pipeline.
 */
export interface CountyConfig {
  /** Human-readable county name, e.g. "Rock Island County". */
  name: string;
  /** Two-letter state code, e.g. "IL". */
  state: string;
  /** Provenance label stamped on every record. */
  sourceSystem: string;
  /** Primary ArcGIS parcel FeatureServer (layer 0). */
  parcelFeatureServerUrl: string;
  /** County-hosted mirror of the parcel service (fallback). */
  parcelMirrorUrl: string;
  /** Total parcel count, used for progress and summary display. */
  parcelCount: number;
  /** Bounding box in EPSG:4326 that encloses the county (plus a small margin). */
  bbox: { xmin: number; ymin: number; xmax: number; ymax: number };
  /** UTM zone SRID used for metric (meter) distance calculations. */
  utmSrid: string;
}

export const ROCK_ISLAND: CountyConfig = {
  name: "Rock Island County",
  state: "IL",
  sourceSystem: "RICO_GIS_Parcels_FeatureServer_0",
  parcelFeatureServerUrl:
    "https://services9.arcgis.com/6FnscPPlUa9DXXOk/arcgis/rest/services/Parcels/FeatureServer/0",
  parcelMirrorUrl:
    "https://gis.rockislandcountyil.gov/arcgis/rest/services/Hosted/Parcels/FeatureServer/0",
  parcelCount: 65_956,
  // Rock Island County + Quad Cities surroundings.
  bbox: { xmin: -91.0, ymin: 41.2, xmax: -89.7, ymax: 42.0 },
  utmSrid: "EPSG:32615",
};

/** The active county for this deployment. Swap this to target another county. */
export const COUNTY: CountyConfig = ROCK_ISLAND;
