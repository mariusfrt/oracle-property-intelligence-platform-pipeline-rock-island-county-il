# Decision: what is eligible for IPFS publication

## Context

The platform publishes dataset artifacts to IPFS for decentralized storage. IPFS
content is public (anyone with the CID can retrieve it) and effectively permanent
(content-addressed, hard to unpublish). The enriched parcel dataset is derived
from Rock Island County public records, but it contains fields that identify
individuals: owner names, owner mailing addresses, and tax-bill name and address,
plus assessed values and sale prices.

Property records are legally public, but aggregating owner names and mailing
addresses into a single downloadable file and pinning it permanently to a public
network removes the practical obscurity of the county's per-parcel lookup. The
requirement asks to store *eligible* dataset artifacts on IPFS, and that word is
the guide: not all data is eligible for permanent public republication.

## Decision

Publish only a PII-stripped, non-personal subset to public IPFS. Keep the full
dataset, including owner identity and financials, out of IPFS entirely and serve
it only through the access-gated application.

The eligible export is built with an explicit **allowlist** of safe columns, not
a blocklist, so no additional personal field can leak by omission.

**Excluded from IPFS:** `owner_name`, `owner_addr`, `owner_city`, `owner_state`,
`owner_zip`, `taxbill_name`, `taxbill_addr`, `taxbill_csz`, `taxbill_year`, `emv`,
`eav`, `land_value`, `building_value`, `gross_sale_price`.

**Published to IPFS (public):**
- `parcels_enriched_public.parquet` — parcel identifiers, location, zoning,
  acreage, building attributes, sale dates, derived suitability signals
  (industrial, stable ownership, out-of-area owner, proximity), geometry, and
  provenance. No owner identity, contact, or financial values.
- `enrichment-run-record.json` — run metadata (layer counts, sources, timestamps).

## Consequences

- The decentralized-storage requirement is satisfied with artifacts that are safe
  to make permanent and public.
- The full owner and financial data remains available in the app behind the
  access-token gate, and is never on public infrastructure.
- Because the IPFS copy is a stripped derivative, it has a different content hash
  than the file bundled into the query runtime; they are intentionally different
  artifacts, produced in the same pipeline run.
- The published artifact is verified after each publish: its columns are checked
  to confirm none of the excluded fields are present.
