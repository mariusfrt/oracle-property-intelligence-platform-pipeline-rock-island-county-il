# Ingest and DuckDB Schema — Rock Island County

How the county parcel fabric (and external layers) get pulled, normalized, queried, and published,
using **DuckDB + IPFS so no always-on Oracle database is required** (the assignment's cost thesis).

## Pipeline (idempotent, resumable)

1. **Pull** — page the Parcels FeatureServer `f=geojson`, `resultOffset` stepping by 2,000
   (`ORDER BY OBJECTID`), ~33 pages for 65,956 parcels. Write each raw page to
   `data/raw/parcels/page-<offset>.geojson` (provenance; lets any field be re-derived).
2. **Normalize** — load raw pages into the canonical `parcels` table (below); keep every unmapped
   field in `source_payload` (drop nothing); stamp `source_url` / `source_system` / `retrieved_at`.
3. **Enrich (external)** — load HIFLD power + OSM POIs into their tables; compute proximity facts.
4. **Export** — write `parcels` (and the flat query table) to **Parquet** in `data/parquet/`.
5. **Serve** — the API Lambda opens DuckDB **over the Parquet files** (no hosted DB); the MCP + agent
   query the same layer.
6. **Publish** — non-PII **coverage** (counts by source, bbox, field fill-rates) to **IPFS** (real CID);
   the per-property query table is prepared + validated, PII handled per `docs/decisions/ipfs-publication.md`.

Idempotency: stable file keys per offset, `INSERT OR REPLACE` on `pin`, re-running a page overwrites it.

## Canonical `parcels` table (DuckDB)

```sql
CREATE TABLE parcels (
  pin              TEXT PRIMARY KEY,   -- parcel_number / PIN
  alt_pin          TEXT,               -- alternate_parcel_number / RICO_PARCE
  objectid         BIGINT,
  geom             GEOMETRY,           -- MultiPolygon (DuckDB spatial)
  lon              DOUBLE,             -- X_longitude (centroid)
  lat              DOUBLE,             -- Y_latitude
  site_address     TEXT, site_city TEXT, site_state TEXT, site_zip TEXT,
  municipality     TEXT, township TEXT, jurisdiction TEXT,
  gis_acres        DOUBLE,             -- GIS_acres_num
  gross_acres      DOUBLE,
  zoning           TEXT,               -- e.g. I1/I2 industrial
  class            TEXT,
  emv              DOUBLE,             -- est. market value
  eav              DOUBLE,             -- assessed value
  land_value       DOUBLE,             -- non_farm_land + farm_land
  building_value   DOUBLE,             -- non_farm_building + farm_building
  owner_name       TEXT,               -- owner1_name
  owner_addr       TEXT, owner_city TEXT, owner_state TEXT, owner_zip TEXT,
  taxbill_name     TEXT, taxbill_addr TEXT, taxbill_csz TEXT, taxbill_year INT,
  date_last_sale   DATE, date_of_sale DATE, gross_sale_price DOUBLE,
  year_built       INT,                -- YRBuilt
  total_sqft       DOUBLE, garage_sqft DOUBLE,
  -- provenance
  source_system    TEXT,               -- 'RICO_GIS_Parcels_FeatureServer_0'
  source_url       TEXT,
  retrieved_at     TIMESTAMP,
  source_payload   JSON                -- all raw fields, verbatim
);
```

### Derived columns / view (`parcels_enriched`)
```sql
acreage              = coalesce(gis_acres, gross_acres)
last_sale            = greatest(date_last_sale, date_of_sale)      -- most recent recorded
years_since_sale     = date_diff('year', last_sale, current_date)
no_sale_over_10y     = last_sale IS NULL OR years_since_sale > 10
owner_out_of_area    = upper(owner_state) <> 'IL'                   -- + optional: owner_city outside county municipalities
is_industrial_zoning = zoning ILIKE 'I%'                           -- I1/I2
roof_age_proxy_yrs   = year(current_date) - year_built             -- proxy; permit-based preferred
```

## External tables
```sql
CREATE TABLE power_infra (kind TEXT, name TEXT, voltage TEXT, lon DOUBLE, lat DOUBLE, geom GEOMETRY); -- HIFLD substations + lines
CREATE TABLE poi        (kind TEXT, name TEXT, lon DOUBLE, lat DOUBLE, geom GEOMETRY);                -- OSM: transit | starbucks | water
```
Proximity uses a walkshed of **~800 m** (0.5 mi, a standard walking-distance threshold) for
transit/Starbucks and a configurable radius for power. Distance via DuckDB spatial `ST_Distance` on a
projected CRS, or haversine on lon/lat; every proximity answer returns the computed distance basis.

## Required queries → SQL (sketches, over `parcels_enriched`)
```sql
-- Data-center: large, stable-ownership, industrial parcels
SELECT pin, owner_name, acreage, zoning, years_since_sale
FROM parcels_enriched
WHERE acreage >= :min_acres AND no_sale_over_10y AND is_industrial_zoning
ORDER BY acreage DESC;

-- Data-center: parcels within :radius_m of power infrastructure
SELECT p.pin, p.acreage, min(ST_Distance(p.geom, pw.geom)) AS dist_m
FROM parcels_enriched p, power_infra pw
GROUP BY p.pin, p.acreage HAVING dist_m <= :radius_m ORDER BY dist_m;

-- Regional / out-of-area owners
SELECT pin, owner_name, owner_city, owner_state FROM parcels_enriched WHERE owner_out_of_area;

-- No ownership exchange > 10 years
SELECT pin, owner_name, last_sale FROM parcels_enriched WHERE no_sale_over_10y;

-- Walking distance to transit (repeat for Starbucks with kind='starbucks')
SELECT p.pin, min(ST_Distance(p.geom, poi.geom)) AS dist_m
FROM parcels_enriched p, poi WHERE poi.kind='transit'
GROUP BY p.pin HAVING dist_m <= 800 ORDER BY dist_m;
```
Compound questions (e.g. "large + stable + near power") are just `AND`ed predicates / joins — the agent
composes them. Every row returned carries provenance (`source_system`, `retrieved_at`) for source-backed answers.

## Why this satisfies "no ongoing infra cost"
- Data lives as **Parquet files** (portable, cheap object storage) and eligible artifacts on **IPFS**.
- **DuckDB runs inside the query Lambda** over those Parquet files — analytical SQL with **no always-on
  database** to pay for. Neon (if used at all) is only a thin metadata/coverage store on its free tier.
- The **MCP** serves the published coverage/query-table so agents query by county key without a live DB.
