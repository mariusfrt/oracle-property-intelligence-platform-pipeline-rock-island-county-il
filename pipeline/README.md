# Rock Island County Ingest Pipeline

Lightweight TypeScript CLI that pulls Rock Island County parcel GeoJSON from ArcGIS, normalizes into DuckDB, and exports Parquet.

## Prerequisites

- Node.js 20 LTS (recommended; prebuilt DuckDB binaries; Node 21 may compile from source)
- pnpm 9+

## Install

From the repository root:

```bash
pnpm install
```

## Commands

```bash
# Pull raw GeoJSON pages (pilot: 200 parcels)
pnpm --filter @oracle/pipeline ingest pull --pilot

# Pull full county (~33 pages, ~65,956 parcels)
pnpm --filter @oracle/pipeline ingest pull --full

# Load raw pages into DuckDB (idempotent INSERT OR REPLACE on pin)
pnpm --filter @oracle/pipeline ingest normalize

# Export DuckDB parcels table to Parquet
pnpm --filter @oracle/pipeline ingest export

# End-to-end (pilot or full)
pnpm --filter @oracle/pipeline ingest run --pilot
pnpm --filter @oracle/pipeline ingest run --full
```

## Outputs

| Path | Description |
|------|-------------|
| `data/raw/parcels/page-<offset>.geojson` | Raw paged GeoJSON with provenance metadata |
| `data/rock-island.duckdb` | Normalized `parcels` table |
| `data/parquet/parcels.parquet` | Exported Parquet for downstream query layer |

## Idempotency

- Pull writes stable keys: `page-0.geojson`, `page-2000.geojson`, …
- Re-running pull overwrites the same page files.
- Normalize uses `INSERT OR REPLACE` keyed on `pin`.

## Tests

```bash
pnpm --filter @oracle/pipeline test
```
