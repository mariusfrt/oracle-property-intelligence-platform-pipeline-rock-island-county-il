# Oracle Rock Island — App Monorepo

Turborepo containing the query API, web UI, and shared types for the Oracle
Property Intelligence platform (Rock Island County, IL). The ingest and
enrichment pipeline lives in `pipeline/`.

## Packages

| Path | Purpose |
|------|---------|
| `packages/shared` | Zod schemas, filter types, shared response shapes |
| `apps/api` | tRPC on AWS Lambda + API Gateway (CDK, `us-east-2`). Native DuckDB (`@duckdb/node-api`) queries a Parquet file bundled into the function. Also serves the MCP endpoint and the Bedrock agent. |
| `apps/web` | Next.js on AWS Amplify: MapLibre explorer, data-center candidates, run summary, conversational agent, access-token gate |
| `pipeline/` | Ingest and enrichment CLI (ArcGIS + Overpass + HIFLD to DuckDB to Parquet) |

## Commands

```bash
pnpm install
pnpm typecheck                          # all packages
pnpm test                               # Vitest
pnpm --filter @oracle/api dev           # local API on :3001 (AWS creds needed for the agent)
pnpm --filter @oracle/web dev           # local UI (set NEXT_PUBLIC_API_URL, ACCESS_TOKEN)
pnpm --filter @oracle/api cdk deploy    # deploy the API stack
```

## Runtime data model

The enriched Parquet is bundled into the Lambda; native DuckDB opens it in process
and queries it on demand. There is no always-on database and no object storage at
query time. Geometry is pre-serialized to GeoJSON text (`geom_geojson`) at export,
so the runtime needs no spatial extension. The map receives geometry only for the
current result page, never all 65,956 parcels at once.

## Environment

**API (Lambda):** `PARQUET_PATH` resolves to the bundled file automatically. The
agent calls Amazon Bedrock through the Lambda execution role (no keys).

**Web (Amplify):**
- `NEXT_PUBLIC_API_URL` — the API Gateway URL
- `ACCESS_TOKEN` — server-side login-gate secret (never `NEXT_PUBLIC_*`)

## Interfaces

- **tRPC:** `parcels.summary`, `searchParcels`, `parcel`, `dataCenterCandidates`,
  `presetQuery`; `agent.ask`; `artifacts.list`. Every parcel response carries
  provenance (`source_system`, `source_url`, `retrieved_at`).
- **MCP:** `POST /mcp`, Streamable HTTP over the same query layer (see `docs/mcp.md`).
