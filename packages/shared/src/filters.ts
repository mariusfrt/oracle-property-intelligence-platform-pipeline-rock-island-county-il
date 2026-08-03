import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const searchParcelsFiltersSchema = z.object({
  minAcres: z.number().min(0).optional(),
  maxAcres: z.number().min(0).optional(),
  industrial: z.boolean().optional(),
  ownerOutOfArea: z.boolean().optional(),
  stableOwnership: z.boolean().optional(),
  nearPower: z.boolean().optional(),
  nearWater: z.boolean().optional(),
  nearTransit: z.boolean().optional(),
  nearStarbucks: z.boolean().optional(),
  /** Free-text match on owner name or site address. */
  query: z.string().trim().optional(),
});

export type SearchParcelsFilters = z.infer<typeof searchParcelsFiltersSchema>;

export const searchParcelsInputSchema = paginationSchema.merge(searchParcelsFiltersSchema);

export type SearchParcelsInput = z.infer<typeof searchParcelsInputSchema>;

export const dataCenterCandidatesInputSchema = z.object({
  minAcres: z.number().min(0).default(20),
  powerRadiusM: z.number().min(0).default(1609),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
});

export type DataCenterCandidatesInput = z.infer<typeof dataCenterCandidatesInputSchema>;

/** Six generic question presets from app-plan / README acceptance criteria. */
export const presetQueryKindSchema = z.enum([
  "roof_age_over_15y",
  "water_view",
  "no_recorded_sale_over_10y",
  "regional_owner",
  "near_transit",
  "near_starbucks",
]);

export type PresetQueryKind = z.infer<typeof presetQueryKindSchema>;

export const presetQueryInputSchema = paginationSchema.extend({
  preset: presetQueryKindSchema,
});

export type PresetQueryInput = z.infer<typeof presetQueryInputSchema>;

export const PRESET_LABELS: Record<PresetQueryKind, string> = {
  roof_age_over_15y: "Roofs older than 15 years (YRBuilt proxy)",
  water_view: "View of water (near_water proximity proxy)",
  no_recorded_sale_over_10y: "No recorded ownership exchange > 10 years",
  regional_owner: "Regional / out-of-area owners",
  near_transit: "Within walking distance of public transit",
  near_starbucks: "Within walking distance of Starbucks",
};

export const PRESET_LIMITATIONS: Partial<Record<PresetQueryKind, string>> = {
  roof_age_over_15y:
    "roof_age_proxy_yrs is derived from year_built; permit-based roof age is preferred when available.",
  water_view:
    "near_water is a proximity proxy (≤300 m), not line-of-sight water view.",
  no_recorded_sale_over_10y:
    "stable_ownership with NULL last_sale means no recorded sale — not proof the parcel was never sold.",
};
