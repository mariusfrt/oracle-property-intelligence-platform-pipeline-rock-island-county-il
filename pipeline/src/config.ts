import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTY } from "./county.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (parent of pipeline/). */
export const REPO_ROOT = path.resolve(__dirname, "../..");

export const SOURCE_SYSTEM = COUNTY.sourceSystem;

export const FEATURE_SERVER_URL = COUNTY.parcelFeatureServerUrl;

export const COUNTY_MIRROR_URL = COUNTY.parcelMirrorUrl;

export const PAGE_SIZE = 2000;
export const PILOT_PAGE_SIZE = 200;
export const FULL_PARCEL_COUNT = COUNTY.parcelCount;

export const PATHS = {
  rawParcels: path.join(REPO_ROOT, "data/raw/parcels"),
  rawEnrichment: path.join(REPO_ROOT, "data/raw/enrichment"),
  parquet: path.join(REPO_ROOT, "data/parquet"),
  duckdb: path.join(REPO_ROOT, "data/rock-island.duckdb"),
  enrichmentRunRecord: path.join(REPO_ROOT, "data/enrichment-run-record.json"),
  publicParquet: path.join(REPO_ROOT, "data/parquet/parcels_enriched_public.parquet"),
  ipfsManifest: path.join(REPO_ROOT, "data/ipfs-manifest.json"),
} as const;

export function buildQueryUrl(
  resultOffset: number,
  resultRecordCount: number,
  baseUrl: string = FEATURE_SERVER_URL,
): string {
  const params = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    orderByFields: "OBJECTID",
    resultOffset: String(resultOffset),
    resultRecordCount: String(resultRecordCount),
  });
  return `${baseUrl}/query?${params.toString()}`;
}
