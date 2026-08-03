# Phase 5 + 7 — Query API & Web UI (deployed)

Turns the enriched data into a live, clickable product. This is the runtime-gate + functional-outcome
core of the grade. Stack follows the Golden Path (`apply-engineering-guidelines`).

## Stack
Turborepo monorepo:
- `apps/api` — tRPC on **AWS Lambda + API Gateway**, provisioned by **CDK** (region `us-east-2`).
- `apps/web` — **Next.js**, hosted on **AWS Amplify**.
- `packages/shared` — shared types / zod schemas / the tRPC client.
TypeScript throughout.

## Runtime data model (no always-on DB — the cost thesis)
- Enriched data lives as **Parquet in S3** (object storage, ~$0 idle). The API Lambda opens **DuckDB
  in-memory** and queries the Parquet **via `httpfs`** (read-only). No hosted database to pay for.
- **No DuckDB spatial extension at runtime.** Geometry is pre-serialized to **GeoJSON text**
  (`geom_geojson`) at export time; the exported API Parquet has NO `GEOMETRY` column. So the Lambda
  only filters/sorts plain columns + returns geojson text — no spatial functions, no extension to bundle.
- The map is served geometry **only for the filtered/paged result set**, never all 65,956 at once.

## Prerequisite (one small enrichment tweak, before deploy)
Add an **API-ready export** to the pipeline: `data/parquet/parcels_enriched_api.parquet` =
all attribute/signal columns + `ST_AsGeoJSON(geom) AS geom_geojson`, **dropping the `geom` GEOMETRY
column**. This is the file uploaded to S3 and read by the Lambda.

## API (tRPC) endpoints — every response carries provenance (`source_system`, `source_url`, `retrieved_at`)
- `summary` → run summary: record counts by source (parcels 65,956; transmission 157; substations 167;
  transit 123; starbucks 5; water 3,970), collection timestamps, source URLs. (Demo "pipeline run summary".)
- `searchParcels(filters, page)` → filter by: min/max acreage, industrial, owner_out_of_area,
  stable_ownership, near_power / near_water / near_transit / near_starbucks, free-text (owner/address).
  Returns paged rows + geom_geojson.
- `parcel(id)` → one parcel: all attributes, distances, provenance, geojson.
- `dataCenterCandidates({ minAcres = 20, powerRadiusM = 1609 })` → large + industrial + stable +
  near-power, ranked by acreage. **This is where the configurable acreage/power thresholds live** (README's
  "configurable acreage threshold"). The baked `dc_candidate` column is ignored; computed live from signals.
- Preset queries for the generic six: roof age > 15y (YRBuilt proxy, labeled), water view (near_water,
  proximity proxy), no recorded sale > 10y, regional owner, walking distance to transit, to Starbucks.

## UI (Next.js) screens
- **Run Summary** (home): counts by source + timestamps + a short "queried live via DuckDB over Parquet,
  no hosted DB" note (evidence for the infra thesis).
- **Explorer**: **MapLibre** map + results **table** + **filter panel** — data-center presets (min-acreage
  slider, near-power toggle, industrial, stable-ownership) and the six question presets. Click a parcel →
  **detail drawer** (attributes + distances + provenance).
- **Data-center candidates**: ranked list + map, with the acreage / power-radius sliders driving it live.

## Deploy
- API: `cdk deploy` → API Gateway + Lambda (`us-east-2`); enriched API Parquet uploaded to an S3 bucket the
  Lambda reads (bucket name via env/SSM).
- Web: AWS Amplify, `NEXT_PUBLIC_API_URL` = the API Gateway URL.
- Access: single **access-token gate** on the UI (satisfies the credentials gate, keeps the app behind a
  simple login). Token compared in constant time; no secrets in client bundle or logs.
- **Deploy an empty skeleton first** to lock the runtime gate, then iterate.

## AWS prerequisites (parallel track)
```bash
aws configure            # or: aws sso login  — profile with admin on the assignment account
export AWS_PROFILE=<profile>; export AWS_REGION=us-east-2
aws sts get-caller-identity          # note the account id
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-2
```
(Bedrock model access — for the Phase 8 agent — is separate and already being requested.)
