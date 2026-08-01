import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../config.js";
import {
  ARCGIS_BBOX,
  ENRICHMENT_LIMITATIONS,
  OVERPASS_BBOX,
} from "./constants.js";
import type { LayerFetchMeta } from "./fetch.js";
import { countEnrichmentLayers } from "./load.js";

export interface EnrichmentRunRecord {
  completed_at: string;
  mode: "pilot" | "full";
  bbox: {
    arcgis: typeof ARCGIS_BBOX;
    overpass: typeof OVERPASS_BBOX;
  };
  layer_counts: {
    power_lines: number;
    power_substations: number;
    poi_transit: number;
    poi_starbucks: number;
    poi_water: number;
    parcels_enriched: number;
  };
  fetch_timestamps: Record<string, string>;
  limitations: readonly string[];
}

export async function writeEnrichmentRunRecord(options: {
  mode: "pilot" | "full";
  fetchLayers?: LayerFetchMeta[];
}): Promise<{ recordPath: string; record: EnrichmentRunRecord }> {
  const counts = await countEnrichmentLayers();

  const fetchTimestamps: Record<string, string> = {};
  for (const layer of options.fetchLayers ?? []) {
    fetchTimestamps[layer.file] = layer.retrievedAt;
  }

  const record: EnrichmentRunRecord = {
    completed_at: new Date().toISOString(),
    mode: options.mode,
    bbox: {
      arcgis: ARCGIS_BBOX,
      overpass: OVERPASS_BBOX,
    },
    layer_counts: {
      power_lines: counts.powerLines,
      power_substations: counts.powerSubstations,
      poi_transit: counts.poiTransit,
      poi_starbucks: counts.poiStarbucks,
      poi_water: counts.poiWater,
      parcels_enriched: counts.parcelsEnriched,
    },
    fetch_timestamps: fetchTimestamps,
    limitations: [...ENRICHMENT_LIMITATIONS],
  };

  await fs.mkdir(path.dirname(PATHS.enrichmentRunRecord), { recursive: true });
  await fs.writeFile(
    PATHS.enrichmentRunRecord,
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );

  console.log(`enrich record: wrote ${PATHS.enrichmentRunRecord}`);

  return { recordPath: PATHS.enrichmentRunRecord, record };
}
