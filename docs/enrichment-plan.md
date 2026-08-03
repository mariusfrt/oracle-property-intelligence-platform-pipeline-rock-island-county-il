# Enrichment (power, POIs, and proximity)

Adds the external layers the data-center and general-property questions need, then builds the
`parcels_enriched` view. All sources verified live 2026-08-01. Bounding box used for every
fetch (Rock Island County + Quad Cities surroundings):

- ArcGIS envelope (xmin,ymin,xmax,ymax, EPSG:4326): `-91.0,41.2,-89.7,42.0`
- Overpass bbox (south,west,north,east): `41.2,-91.0,42.0,-89.7`

## Sources (verified)

| Layer | Source | Endpoint / query | Notes |
|---|---|---|---|
| **Transmission lines** | HIFLD (authoritative) | `https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0` — bbox query, `f=geojson` | **157 segments** in bbox. Fields: `VOLTAGE`, `VOLT_CLASS`, `OWNER` (e.g. MidAmerican Energy), `STATUS`, `TYPE`. |
| **Substations** | OpenStreetMap (Overpass) | `node/way["power"="substation"](bbox)` | HIFLD national substations layer wasn't openly queryable; OSM has them. |
| **Transit stops** | OpenStreetMap (Overpass) | `node["highway"="bus_stop"]`, `node["railway"="station"]`, `node["public_transport"="platform"]` (bbox) | For walking-distance-to-transit. |
| **Starbucks** | OpenStreetMap (Overpass) | `node["brand"="Starbucks"]`, plus `node["name"~"Starbucks",i]["amenity"="cafe"]` (bbox) | For walking-distance-to-Starbucks. |
| **Water** | OpenStreetMap (Overpass) | `way/relation["natural"="water"]`, `["waterway"="riverbank"]`, Mississippi River | For "view of water" (proximity proxy). |

Overpass endpoint: `https://overpass-api.de/api/interpreter` (POST `data=[out:json][timeout:120]; ( ... ); out geom;`).
OSM confirmed populated: power/Starbucks/bus-stops returned ~293 elements in the bbox.

## Target tables (DuckDB)
```sql
CREATE OR REPLACE TABLE power_lines       (id TEXT, owner TEXT, voltage DOUBLE, volt_class TEXT, status TEXT, geom GEOMETRY, source_url TEXT, retrieved_at TIMESTAMP);
CREATE OR REPLACE TABLE power_substations (osm_id TEXT, name TEXT, geom GEOMETRY, source_url TEXT, retrieved_at TIMESTAMP);
CREATE OR REPLACE TABLE poi               (osm_id TEXT, kind TEXT, name TEXT, geom GEOMETRY, source_url TEXT, retrieved_at TIMESTAMP); -- kind: transit | starbucks | water
```
Provenance (`source_url`, `retrieved_at`) on every row, same discipline as parcels. Raw responses
captured under `data/raw/enrichment/` before load.

## Distance model (meters, uniform)
Reproject everything to **EPSG:32615 (UTM 15N)** with `ST_Transform(..., always_xy := true)`, then use
`ST_Distance` (meters). The `always_xy` flag is REQUIRED: EPSG:4326 defaults to (lat, lon) axis order,
so without it DuckDB reads stored (lon, lat) geometries wrong and `ST_Transform` returns `POINT(Infinity Infinity)`,
collapsing all distances to 0/null.
This works for points, lines, and polygons uniformly. Use the **parcel centroid** (`ST_Point(lon,lat)`)
as the parcel location. For each parcel compute the **nearest** distance per layer and store as columns.

## `parcels_enriched` view (derived signals)
```sql
-- cleaning / derivations
zoning_norm          = upper(regexp_replace(zoning, '[?! ]', '', 'g'))   -- 'I2?' -> 'I2'
is_industrial        = zoning_norm LIKE 'I%'
acreage              = coalesce(gis_acres, gross_acres)
last_sale            = greatest(date_last_sale, date_of_sale)
years_since_sale     = date_diff('year', last_sale, current_date)
stable_ownership     = last_sale IS NULL OR years_since_sale > 10   -- NULL = "no RECORDED sale" (label as such, not proven)
owner_out_of_area    = owner_state IS NOT NULL AND upper(trim(owner_state)) <> 'IL'
roof_age_proxy_yrs   = year(current_date) - year_built             -- proxy; label as such

-- proximity (nearest, meters) + thresholds
dist_transmission_m, dist_substation_m, dist_transit_m, dist_starbucks_m, dist_water_m
near_transit   = dist_transit_m   <= 800     -- ~0.5 mi walkshed
near_starbucks = dist_starbucks_m <= 800
near_water     = dist_water_m     <= 300     -- proximity proxy, NOT line-of-sight
near_power     = least(dist_transmission_m, dist_substation_m) <= :power_radius_m   -- default 1609 m (~1 mi), configurable

-- data-center suitability (the headline)
dc_candidate   = acreage >= :min_acres AND is_industrial AND stable_ownership AND near_power
```
Every proximity answer returns the **computed distance** so it is source-/evidence-backed. Keep the
raw county zoning faithful in `parcels`; `zoning_norm` lives only in the enriched view.

## Deliverables
- `power_lines`, `power_substations`, `poi` tables loaded + raw captured.
- `parcels_enriched` view (or materialized table) with the columns above.
- Parquet export of `parcels_enriched` for the query layer.
- A short run-record: counts per layer, bbox, timestamps, and the two labeled limitations
  (roof age = proxy; "no recorded sale" ≠ proven never-sold).
