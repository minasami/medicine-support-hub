# MCP Phase 1

Medicine Support Hub exposes a remote MCP server so AI clients can search the catalog and estimate indicative EGP costs.

## Scope

In:
- search by Arabic/English/scientific name
- fetch one product
- cost estimate from catalog `current_price_egp`
- popular Egypt brands seed list
- bilingual price disclaimer

Out:
- insurance / TPA
- support-request writes
- prescription OCR
- admin or donation mutations

## Run and deploy

Code: `apps/mcp-server`

```bash
cd apps/mcp-server
node src/server.mjs
```

Docker:

```bash
docker build -t msh-mcp apps/mcp-server
docker run -p 8787:8787 --env-file apps/mcp-server/.env msh-mcp
```

Host on any Node 18+ HTTPS service. Path must be `POST /mcp`.

## Client configuration

- Grok website connectors: custom MCP URL
- Grok CLI: `grok mcp add --transport http msh https://HOST/mcp`
- xAI API remote MCP tools: `{ "type": "mcp", "server_url": "https://HOST/mcp" }`
- ChatGPT Developer Mode custom app/plugin
- Gemini CLI `mcpServers.medicine-support-hub.url`
- Claude / Cursor mcp.json url field

## Safety

Tool results include `disclaimer_en` and `disclaimer_ar`. Prices are catalog snapshots, not pharmacy quotes.
