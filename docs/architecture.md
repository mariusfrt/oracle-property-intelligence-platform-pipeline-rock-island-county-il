# Architecture

How the Oracle Property Intelligence platform for Rock Island County is built.
The design goal is a queryable, agent-accessible property dataset with no
always-on infrastructure cost.

## Overview

```
ArcGIS + Overpass + HIFLD ──► pipeline (DuckDB) ──► parcels_enriched_api.parquet
                                                          │
                                     ┌────────────────────┼───────────────────────┐
                                     │ bundled into the Lambda                     │ eligible, PII-stripped copy
                                     ▼                                             ▼
                             native DuckDB query layer                     published to IPFS (Pinata)
                                     │
             ┌───────────────────────┼───────────────────────────┐
             ▼                       ▼                            ▼
        tRPC API ─► Web UI     Bedrock agent (tool loop)     MCP server (/mcp)
```

## Pipeline

A TypeScript CLI ingests parcels from the Rock Island County ArcGIS parcel
service, normalizes them into DuckDB, and enriches each parcel with proximity
signals: distance to transmission lines and substations (HIFLD), and to transit,
Starbucks, and water (OpenStreetMap via Overpass). All county-specific settings
(source URLs, bounding box, UTM zone) live in `pipeline/src/county.ts`. The
enriched table is exported to Parquet, with geometry pre-serialized to GeoJSON
text (`geom_geojson`) so the query runtime needs no spatial extension.

## Query engine

The API Lambda uses native DuckDB (`@duckdb/node-api`) to open the enriched
Parquet, which is bundled directly into the function asset, and query it in
process on demand. There is no hosted database and no object storage at query
time, so the platform costs nothing when idle. A single shared query layer
(`apps/api/src/queries/parcels.ts`) is the one source of truth for parcel
queries; the tRPC API, the Bedrock agent, and the MCP server all call it, so the
data model never changes per consumer.

## API

tRPC on AWS Lambda + API Gateway (CDK, `us-east-2`):
- `summary` — record counts by source, collection timestamps, source URLs.
- `searchParcels(filters, page)` — acreage, industrial zoning, ownership
  stability, out-of-area ownership, proximity signals, and free-text.
- `parcel(id)` — one parcel with attributes, distances, provenance, geometry.
- `dataCenterCandidates({ minAcres, powerRadiusM })` — large, industrial, stably
  owned parcels within a configurable power radius, ranked by distance to power.
- `presetQuery(preset)` — the standard question set (roof age, water view, no
  recent sale, regional owner, near transit, near Starbucks).
- `agent.ask` — the conversational agent (below); `artifacts.list` — the IPFS manifest.

Every parcel response carries provenance (`source_system`, `source_url`,
`retrieved_at`).

## Agent

A Bedrock (Claude) tool-loop agent (Vercel AI SDK) answers natural-language
property-intelligence and data-center suitability questions. Its tools are the
shared query functions, so answers are grounded in the same data as the UI, with
source-backed evidence.

## MCP

A hosted Model Context Protocol server at `POST /mcp` (stateless Streamable HTTP)
exposes the query layer as tools for any MCP client. See `docs/mcp.md`.

## Storage and privacy

Eligible, non-personal dataset artifacts (a PII-stripped parcel dataset and the
enrichment run record) are published to IPFS for decentralized storage and
independent verification. Owner names, mailing and tax-bill addresses, and
financial values are deliberately excluded from public IPFS and served only
through the access-gated app. See `docs/decisions/ipfs-publication.md`.

## Web

Next.js on AWS Amplify: a run summary, a MapLibre explorer with filters, an
embedded agent, and a data-center candidate finder. Access is behind a single
server-side access-token gate (constant-time comparison; no secret in the client
bundle). The map is served geometry only for the current result page.
