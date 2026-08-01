# Rock Island County, IL — Source Discovery Findings

Discovery output for the Oracle pipeline (equivalent to the `county-discovery` stage).
Documents the sources, their access characteristics, provenance model, and constraints.
Everything below was verified live on 2026-08-01.

## System of record: County parcel fabric (free, public, complete)

**Primary source — Rock Island County GIS "Parcels" hosted feature layer.**

- ArcGIS Online: `https://services9.arcgis.com/6FnscPPlUa9DXXOk/arcgis/rest/services/Parcels/FeatureServer/0`
- County mirror: `https://gis.rockislandcountyil.gov/arcgis/rest/services/Hosted/Parcels/FeatureServer/0`
- Owner: **Rock Island County GIS** (org `ricogis`, id `6FnscPPlUa9DXXOk`).

| Property | Value |
|---|---|
| Coverage | **65,956 parcels** (whole county) |
| Geometry | MultiPolygon (parcel boundaries) |
| Fields | 82 |
| Auth | none (public) |
| Anti-bot / geo-block | none observed — public ArcGIS Online service; **no US VPN required** |
| Page size (`maxRecordCount`) | 2,000 |
| Pagination | supported (`resultOffset`) → ~33 requests for the full county |
| Output formats | JSON, **geoJSON**, PBF |
| Object id field | `OBJECTID` |

This single source covers most of the required data model — parcels, ownership, mailing
addresses, acreage, zoning, assessed values, sale history, and coordinates — as authoritative
county data, which is why we treat it as the system of record rather than scraping the
per-parcel assessment portal.

### Field inventory (grouped by what they power)
- **Identity / geometry:** `PIN`, `parcel_number`, `alternate_parcel_number`, `RICO_PARCE`, geometry, `X_longitude`, `Y_latitude`
- **Location:** `site_address`, `Site_City`, `Site_State`, `Site_Zip`, `township`, `municipality`, `Jurisdiction`, `mass_transit`, `legal`
- **Size:** `GIS_acres_num` (GIS-computed), `gross_acres` (assessed)
- **Zoning / class:** `Zoning` (e.g. `I2` industrial), `class`
- **Owner:** `owner1_name`, `owner1_address1/2`, `Owner_city`, `Owner_state`, `Owner_Zip`, `owner1_csz`
- **Tax billing contact:** `taxbill_name`, `taxbill_addr`, `taxbill_csz`, `taxbill_year`, `tax_code`
- **Value:** `EMV` (est. market value), `EAV` (assessed value), `farm_land`, `farm_building`, `non_farm_land`, `non_farm_building`
- **Ownership tenure:** `date_last_sale`, `date_of_sale`, `gross_sale_price`, `net_sale_price`
- **Building:** `YRBuilt`, `GarSQFT`, `TOTSQFT`, `MODLNAME`, `assessed_last`
- **Taxing districts (context):** school/fire/library/park/etc. district fields

### Requirement → field mapping (how the source answers the assignment)
| Acceptance-criteria question | Field basis |
|---|---|
| Parcels above an **acreage threshold** (data-center) | `GIS_acres_num`, `gross_acres` |
| **Industrial / zoning** signals (data-center) | `Zoning` (`I1`/`I2`…), `class` |
| **Proximity to power** (data-center) | `X_longitude`/`Y_latitude` → join HIFLD (external) |
| **No ownership exchange > 10y** / stability | `date_last_sale`, `date_of_sale` |
| **Regional / out-of-area owners** | `Owner_state`, `Owner_city` vs Rock Island |
| **Roofs older than 15 years** | `YRBuilt` (proxy) — permit-based preferred if permits are loaded |
| **View of water** | centroid vs OSM water (external) |
| **Walking distance to transit / Starbucks** | `X_longitude`/`Y_latitude` → OSM/GTFS (external) |
| Assessed values / owner contact (Story 2 CRM) | `EMV`/`EAV`, `owner1_*`, `taxbill_*` |
| Map + combined acreage (Story 2) | geometry + acreage |

## Secondary / external sources
| Source | Purpose | Status |
|---|---|---|
| **HIFLD** (electric substations + transmission lines) | Data-center "proximity to power" | Free GeoJSON, national; filter to Rock Island bbox |
| **OpenStreetMap / Overpass** | Transit stops, Starbucks, water features | Free; query by bbox |
| **US Census geocoder** | Backfill any missing coordinates | Free; parcels already carry X/Y so likely minimal |
| Municipal permit portals (Rock Island city, Moline, county) | Permit records | Not in the parcel fabric — **candidate limitation**, sample or document if constrained |
| IL Secretary of State business search | Business records | Secondary; `owner1_name` companies give partial coverage |
| BBB | Contractor reputation | Secondary/national |

## Provenance model
Every ingested parcel record carries: `source_url` (the FeatureServer query URL), `source_system`
= `RICO_GIS_Parcels_FeatureServer_0`, `retrieved_at` (UTC timestamp of the paged pull), and the
`OBJECTID` for traceability. Raw per-page GeoJSON is captured before normalization so any field can
be re-derived. Unmapped fields are preserved verbatim in a `source_payload` JSON column (no data
dropped), per the pipeline ground rules.

## Constraints & limitations (documented, per acceptance criteria)
- **Permits, business, contractor data are not in the county parcel fabric.** They require separate
  municipal/state/BBB sources; where a source is slow or blocked, it is loaded as a sample and the
  limitation recorded here rather than faked, per the acceptance criterion to document source constraints.
- **Roof age is proxied** by `YRBuilt` unless re-roof permits are loaded; labeled as a proxy in query results.
- **Water view is a proximity proxy** (centroid within N metres of an OSM water feature), not line-of-sight.
- **Owner data is already public** on the county's public parcel viewer, so it is public record; even
  so, PII handling for IPFS publication is addressed in `docs/decisions/ipfs-publication.md`.
- No portal throttling observed at 2,000 records/request; the full pull completes in minutes.
