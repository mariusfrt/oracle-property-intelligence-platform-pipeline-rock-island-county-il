import { z } from "zod";
import { provenanceSchema } from "./provenance.js";

/**
 * Row shape for `parcels_enriched_api.parquet` (API-ready export).
 * Matches pipeline export: all attribute/signal columns + `geom_geojson` text;
 * NO `geom` GEOMETRY column.
 */
export const parcelApiRowSchema = z
  .object({
    objectid: z.number(),
    pin: z.string().nullable().optional(),
    alt_pin: z.string().nullable().optional(),
    lon: z.number().nullable().optional(),
    lat: z.number().nullable().optional(),
    site_address: z.string().nullable().optional(),
    site_city: z.string().nullable().optional(),
    site_state: z.string().nullable().optional(),
    site_zip: z.string().nullable().optional(),
    municipality: z.string().nullable().optional(),
    township: z.string().nullable().optional(),
    jurisdiction: z.string().nullable().optional(),
    gis_acres: z.number().nullable().optional(),
    gross_acres: z.number().nullable().optional(),
    zoning: z.string().nullable().optional(),
    class: z.string().nullable().optional(),
    emv: z.number().nullable().optional(),
    eav: z.number().nullable().optional(),
    land_value: z.number().nullable().optional(),
    building_value: z.number().nullable().optional(),
    owner_name: z.string().nullable().optional(),
    owner_addr: z.string().nullable().optional(),
    owner_city: z.string().nullable().optional(),
    owner_state: z.string().nullable().optional(),
    owner_zip: z.string().nullable().optional(),
    taxbill_name: z.string().nullable().optional(),
    taxbill_addr: z.string().nullable().optional(),
    taxbill_csz: z.string().nullable().optional(),
    taxbill_year: z.number().nullable().optional(),
    date_last_sale: z.string().nullable().optional(),
    date_of_sale: z.string().nullable().optional(),
    gross_sale_price: z.number().nullable().optional(),
    year_built: z.number().nullable().optional(),
    total_sqft: z.number().nullable().optional(),
    garage_sqft: z.number().nullable().optional(),
    zoning_norm: z.string().nullable().optional(),
    is_industrial: z.boolean().nullable().optional(),
    acreage: z.number().nullable().optional(),
    last_sale: z.string().nullable().optional(),
    years_since_sale: z.number().nullable().optional(),
    stable_ownership: z.boolean().nullable().optional(),
    owner_out_of_area: z.boolean().nullable().optional(),
    roof_age_proxy_yrs: z.number().nullable().optional(),
    dist_transmission_m: z.number().nullable().optional(),
    dist_substation_m: z.number().nullable().optional(),
    dist_transit_m: z.number().nullable().optional(),
    dist_starbucks_m: z.number().nullable().optional(),
    dist_water_m: z.number().nullable().optional(),
    near_transit: z.boolean().nullable().optional(),
    near_starbucks: z.boolean().nullable().optional(),
    near_water: z.boolean().nullable().optional(),
    near_power: z.boolean().nullable().optional(),
    dc_candidate: z.boolean().nullable().optional(),
    geom_geojson: z.string().nullable().optional(),
    source_system: z.string().nullable().optional(),
    source_url: z.string().nullable().optional(),
    retrieved_at: z.string().nullable().optional(),
  });

export type ParcelApiRow = z.infer<typeof parcelApiRowSchema>;

export const parcelSummarySchema = parcelApiRowSchema.pick({
  objectid: true,
  pin: true,
  site_address: true,
  site_city: true,
  acreage: true,
  zoning: true,
  owner_name: true,
  geom_geojson: true,
  source_system: true,
  source_url: true,
  retrieved_at: true,
});

export type ParcelSummary = z.infer<typeof parcelSummarySchema>;

export const parcelIdSchema = z.object({
  objectid: z.number().int().positive(),
});

export type ParcelIdInput = z.infer<typeof parcelIdSchema>;
