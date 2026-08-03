# Oracle Rock Island — App Monorepo

Turborepo scaffold for Phase 5 + 7 (API + Web). **Not deployed yet.**

## Packages

| Path | Purpose |
|------|---------|
| `packages/shared` | Zod schemas, filter types, `parcels_enriched_api` row shape |
| `apps/api` | tRPC on Lambda + CDK (`us-east-2`), DuckDB/httpfs stub |
| `apps/web` | Next.js (Amplify) — MapLibre explorer + access-token gate |
| `pipeline/` | Existing ingest/enrich CLI (unchanged) |

## Commands

```bash
pnpm install
pnpm typecheck          # all packages
pnpm test               # Vitest
pnpm --filter @oracle/api cdk:synth   # CDK synth only — do not deploy until review
pnpm --filter @oracle/web dev         # local UI (set ACCESS_TOKEN)
```

## Environment

**API (Lambda via CDK)**
- `PARQUET_S3_URI` — `s3://…/parcels_enriched_api.parquet` (set by CDK stack)
- Prerequisite: pipeline exports `data/parquet/parcels_enriched_api.parquet` (see `docs/app-plan.md`)

**Web (Amplify)**
- `NEXT_PUBLIC_API_URL` — API Gateway URL after deploy
- `ACCESS_TOKEN` — server-side gate secret (never `NEXT_PUBLIC_*`)

## Review checklist (before wiring queries)

- [ ] Confirm `packages/shared` parcel schema matches API Parquet export
- [ ] Implement DuckDB httpfs client in `apps/api/src/db/duckdb.ts`
- [ ] Wire tRPC procedures to SQL builders in `apps/api/src/routers/parcels.ts`
- [ ] Connect web pages to tRPC client (`apps/web/src/lib/trpc.ts`)
- [ ] Add pipeline `export-api-parquet` step for `geom_geojson` column
- [ ] `cdk deploy` + upload Parquet + Amplify connect

## tRPC router shape

```
parcels.summary
parcels.searchParcels
parcels.parcel
parcels.dataCenterCandidates
parcels.presetQuery
```

All responses include provenance fields per `docs/app-plan.md`.
