import { z } from "zod";

export const layerCountSchema = z.object({
  count: z.number().int().nonnegative(),
  sourceUrl: z.string().nullable(),
  retrievedAt: z.string().nullable(),
});

export type LayerCount = z.infer<typeof layerCountSchema>;

export const summaryResponseSchema = z.object({
  layers: z.object({
    parcels: layerCountSchema,
    transmission: layerCountSchema,
    substations: layerCountSchema,
    transit: layerCountSchema,
    starbucks: layerCountSchema,
    water: layerCountSchema,
  }),
  infraNote: z.string(),
  limitations: z.array(z.string()),
});

export type SummaryResponse = z.infer<typeof summaryResponseSchema>;

export const pagedParcelsResponseSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type PagedParcelsResponse = z.infer<typeof pagedParcelsResponseSchema>;

export const parcelDetailResponseSchema = z.object({
  parcel: z.record(z.unknown()).nullable(),
});

export type ParcelDetailResponse = z.infer<typeof parcelDetailResponseSchema>;

export const presetQueryResponseSchema = pagedParcelsResponseSchema.extend({
  preset: z.string(),
  label: z.string(),
  limitation: z.string().optional(),
});

export type PresetQueryResponse = z.infer<typeof presetQueryResponseSchema>;

/** Documented layer counts (from the enrichment run record). */
export const DOCUMENTED_LAYER_COUNTS = {
  parcels: 65_956,
  transmission: 157,
  substations: 167,
  transit: 123,
  starbucks: 5,
  water: 3_970,
} as const;

/** Source URLs for the enrichment layers (transmission from HIFLD, the rest from OSM via Overpass). */
export const DOCUMENTED_LAYER_SOURCES: Record<string, string> = {
  transmission:
    "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0",
  substations: "https://overpass-api.de/api/interpreter",
  transit: "https://overpass-api.de/api/interpreter",
  starbucks: "https://overpass-api.de/api/interpreter",
  water: "https://overpass-api.de/api/interpreter",
};

/** When the enrichment layers were fetched (enrichment run completed_at). */
export const ENRICHMENT_RETRIEVED_AT = "2026-08-01T15:47:35.717Z";

export const GLOBAL_LIMITATIONS = [
  "Roof age is estimated from the year each building was built, so it is an approximation. Permit records would give a more exact figure where they are available.",
  "When a parcel has no sale on record, it is treated as long held. A missing sale date does not prove the parcel was never sold.",
] as const;
