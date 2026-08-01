import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../config.js";
import { fetchWithRetry } from "../http-retry.js";
import type { ArcGisQueryResponse, FeatureCollection } from "../types.js";
import {
  ARCGIS_BBOX,
  HIFLD_TRANSMISSION_URL,
  OVERPASS_BBOX,
  OVERPASS_URL,
  RAW_ENRICHMENT_FILES,
} from "./constants.js";

export interface EnrichmentFetchOptions {
  pilot?: boolean;
  full?: boolean;
}

export interface LayerFetchMeta {
  file: string;
  sourceUrl: string;
  retrievedAt: string;
  elementCount: number;
}

export interface EnrichmentFetchResult {
  layers: LayerFetchMeta[];
}

interface RawEnvelope<T> {
  _pipeline: { source_url: string; retrieved_at: string };
  data: T;
}

const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHifldQueryUrl(): string {
  const geometry = JSON.stringify({
    xmin: ARCGIS_BBOX.xmin,
    ymin: ARCGIS_BBOX.ymin,
    xmax: ARCGIS_BBOX.xmax,
    ymax: ARCGIS_BBOX.ymax,
    spatialReference: { wkid: 4326 },
  });
  const params = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
  });
  return `${HIFLD_TRANSMISSION_URL}/query?${params.toString()}`;
}

function buildOverpassQuery(body: string): string {
  const { south, west, north, east } = OVERPASS_BBOX;
  return `[out:json][timeout:120];\n(\n${body.replace(/\{bbox\}/g, `${south},${west},${north},${east}`)}\n);\nout geom;`;
}

const OVERPASS_QUERIES = {
  substations: `
  node["power"="substation"]({bbox});
  way["power"="substation"]({bbox});`,
  transit: `
  node["highway"="bus_stop"]({bbox});
  node["railway"="station"]({bbox});
  node["public_transport"="platform"]({bbox});`,
  starbucks: `
  node["brand"="Starbucks"]({bbox});
  node["name"~"Starbucks",i]["amenity"="cafe"]({bbox});`,
  water: `
  way["natural"="water"]({bbox});
  relation["natural"="water"]({bbox});
  way["waterway"="riverbank"]({bbox});`,
} as const;

async function ensureRawDir(): Promise<void> {
  await fs.mkdir(PATHS.rawEnrichment, { recursive: true });
}

async function writeRawEnvelope<T>(
  fileName: string,
  sourceUrl: string,
  retrievedAt: string,
  data: T,
): Promise<void> {
  const envelope: RawEnvelope<T> = {
    _pipeline: { source_url: sourceUrl, retrieved_at: retrievedAt },
    data,
  };
  const outPath = path.join(PATHS.rawEnrichment, fileName);
  await fs.writeFile(outPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  console.log(`enrich fetch: wrote ${outPath}`);
}

async function fetchTransmissionLines(): Promise<LayerFetchMeta> {
  const sourceUrl = buildHifldQueryUrl();
  const response = await fetchWithRetry(sourceUrl, {
    headers: { Accept: "application/geo+json, application/json" },
    label: "HIFLD transmission lines",
  });
  const retrievedAt = new Date().toISOString();
  const body = (await response.json()) as ArcGisQueryResponse;
  if (body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error("Invalid HIFLD GeoJSON response");
  }

  await writeRawEnvelope(RAW_ENRICHMENT_FILES.transmissionLines, sourceUrl, retrievedAt, body);

  return {
    file: RAW_ENRICHMENT_FILES.transmissionLines,
    sourceUrl,
    retrievedAt,
    elementCount: body.features.length,
  };
}

async function fetchOverpassLayer(
  key: keyof typeof OVERPASS_QUERIES,
  fileName: string,
): Promise<LayerFetchMeta> {
  const query = buildOverpassQuery(OVERPASS_QUERIES[key]);
  const response = await fetchWithRetry(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "oracle-rock-island-pipeline/0.1 (local enrichment)",
    },
    body: `data=${encodeURIComponent(query)}`,
    label: `Overpass ${key}`,
  });
  const retrievedAt = new Date().toISOString();
  const body = (await response.json()) as { elements?: unknown[] };
  if (!Array.isArray(body.elements)) {
    throw new Error(`Invalid Overpass response for ${key}`);
  }

  await writeRawEnvelope(fileName, OVERPASS_URL, retrievedAt, body);

  return {
    file: fileName,
    sourceUrl: OVERPASS_URL,
    retrievedAt,
    elementCount: body.elements.length,
  };
}

export async function fetchEnrichmentLayers(
  _options: EnrichmentFetchOptions = {},
): Promise<EnrichmentFetchResult> {
  await ensureRawDir();

  const layers: LayerFetchMeta[] = [];

  layers.push(await fetchTransmissionLines());
  await sleep(REQUEST_DELAY_MS);

  layers.push(await fetchOverpassLayer("substations", RAW_ENRICHMENT_FILES.substations));
  await sleep(REQUEST_DELAY_MS);

  layers.push(await fetchOverpassLayer("transit", RAW_ENRICHMENT_FILES.transit));
  await sleep(REQUEST_DELAY_MS);

  layers.push(await fetchOverpassLayer("starbucks", RAW_ENRICHMENT_FILES.starbucks));
  await sleep(REQUEST_DELAY_MS);

  layers.push(await fetchOverpassLayer("water", RAW_ENRICHMENT_FILES.water));

  return { layers };
}

export async function readRawGeoJson(fileName: string): Promise<{
  sourceUrl: string;
  retrievedAt: string;
  collection: FeatureCollection;
}> {
  const rawPath = path.join(PATHS.rawEnrichment, fileName);
  const text = await fs.readFile(rawPath, "utf8");
  const envelope = JSON.parse(text) as RawEnvelope<FeatureCollection>;
  return {
    sourceUrl: envelope._pipeline.source_url,
    retrievedAt: envelope._pipeline.retrieved_at,
    collection: envelope.data,
  };
}

export async function readRawOsm(fileName: string): Promise<{
  sourceUrl: string;
  retrievedAt: string;
  elements: import("./osm-geometry.js").OsmElement[];
}> {
  const rawPath = path.join(PATHS.rawEnrichment, fileName);
  const text = await fs.readFile(rawPath, "utf8");
  const envelope = JSON.parse(text) as RawEnvelope<{ elements: import("./osm-geometry.js").OsmElement[] }>;
  return {
    sourceUrl: envelope._pipeline.source_url,
    retrievedAt: envelope._pipeline.retrieved_at,
    elements: envelope.data.elements ?? [],
  };
}
