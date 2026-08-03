# MCP server (Rock Island County)

Hosted, remote MCP façade over the same DuckDB/Parquet parcel query layer used by the UI and the Bedrock agent. Tool shape mirrors Elephant MCP (discoverable tools + schema/list/detail). The data model and query SQL are unchanged.

## Hosted endpoint

```
POST <ApiUrl>/mcp
```

`<ApiUrl>` is the API Gateway URL from CDK output `ApiUrl` (same base URL as tRPC). The endpoint is **open** (no API key), consistent with the existing query API.

Local development:

```
POST http://localhost:3001/mcp
```

## Transport

- **Stateless Streamable HTTP** via `@modelcontextprotocol/sdk`
- **JSON response mode** (`enableJsonResponse: true`)
- **No SSE** (API Gateway does not support reliable long-lived streaming)
- **No session store** (`sessionIdGenerator: undefined`)
- Supported JSON-RPC methods: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`
- `GET /mcp` returns **405 Method Not Allowed** in this mode

## Same data model

All tools call `apps/api/src/queries/parcels.ts` (and shared dataset summary) through `getSharedDuckDbClient()`. This is the same unchanged DuckDB/Parquet model as the Explorer UI and the Bedrock agent.

## Tools

| Tool | Input schema (shared zod) | Example |
|------|---------------------------|---------|
| `search_parcels` | `searchParcelsInputSchema` | `{ "industrial": true, "nearPower": true, "pageSize": 10 }` |
| `data_center_candidates` | `dataCenterCandidatesInputSchema` | `{ "minAcres": 20, "powerRadiusM": 1609, "pageSize": 10 }` |
| `preset_query` | `presetQueryInputSchema` | `{ "preset": "near_transit", "pageSize": 10 }` |
| `get_parcel` | `parcelIdSchema` | `{ "objectid": 12345 }` |
| `get_dataset_info` | `{}` | `{}` |
| `list_query_schema` | `{}` | `{}` |

`list_query_schema` returns each tool's JSON Schema plus `SEARCH_SELECT_COLUMNS` (the documented MCP-compatible query structure).

Row-returning tools cap `pageSize` at 25 and return a short text summary (for example `10 of 322 parcels`) plus JSON rows.

### Preset values

`roof_age_over_15y` · `water_view` · `no_recorded_sale_over_10y` · `regional_owner` · `near_transit` · `near_starbucks`

## MCP Inspector (copy-paste)

Start the API (if not already running):

```bash
pnpm --filter @oracle/api dev
```

Then:

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI, connect to:

```
http://localhost:3001/mcp
```

Transport: **Streamable HTTP**. Confirm `initialize`, `tools/list`, then `tools/call` with `data_center_candidates` and args `{ "minAcres": 20, "pageSize": 5 }`.

CLI-style smoke (optional):

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http --method tools/list
```

Call a tool:

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http --method tools/call --tool-name data_center_candidates --tool-arg minAcres=20 --tool-arg pageSize=5
```

## Remote MCP client config snippet

```json
{
  "mcpServers": {
    "oracle-rock-island": {
      "url": "https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/mcp"
    }
  }
}
```

Replace the URL with your deployed `ApiUrl` + `/mcp`. No auth headers are required.

## Local-only stdio (optional)

For Cursor on a developer machine only (not for grading demos):

```bash
pnpm --filter @oracle/api exec tsx src/mcp-stdio.ts
```

Cursor `mcp.json` example:

```json
{
  "mcpServers": {
    "oracle-rock-island-local": {
      "command": "pnpm",
      "args": ["--filter", "@oracle/api", "exec", "tsx", "src/mcp-stdio.ts"],
      "cwd": "/absolute/path/to/repo"
    }
  }
}
```

Prefer the hosted `POST /mcp` endpoint for demos. Localhost-only stdio is not the graded path.

## Pattern note

Tool naming and the schema/list/detail style follow the Elephant MCP consumer pattern (`use-elephant-mcp`), adapted as a thin hosted façade over this assignment's query layer. There is no kit MCP server scaffold; this uses the official SDK.
