# MCP Phase 1

Medicine Support Hub exposes a remote MCP server so AI clients can search the catalog and estimate indicative EGP costs.

## Live host

Separate Vercel project `medicine-support-hub-mcp` (do not reuse the Appwrite/website project):

- MCP: `https://medicine-support-hub-mcp.vercel.app/mcp`
- Health: `https://medicine-support-hub-mcp.vercel.app/health`
- Suggested custom domain: `mcp.medicinesupport.app` (DNS not attached yet)

Vercel Firewall may `403` bot-like IPs (`x-vercel-mitigated: deny`). Browser and official AI clients should work. Turn off Attack Challenge Mode on that project if clients are blocked.

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

## Run locally

```bash
cd apps/mcp-server
cp .env.example .env
node src/server.mjs
bash test-mcp.sh http://localhost:8787
```

## Deploy (separate service from the public website)

Do **not** point the main `medicinesupport.app` site root at `apps/mcp-server`.

The live service was deployed as Vercel project `medicine-support-hub-mcp`.

After deploy, clients use:

`https://medicine-support-hub-mcp.vercel.app/mcp`

## Client configuration

- Grok website connectors: custom MCP URL above
- Grok CLI: `grok mcp add --transport http msh https://medicine-support-hub-mcp.vercel.app/mcp`
- xAI API: `{ "type": "mcp", "server_url": "https://medicine-support-hub-mcp.vercel.app/mcp" }`
- ChatGPT Developer Mode custom app/plugin
- Gemini CLI `mcpServers.medicine-support-hub.url`
- Claude / Cursor mcp.json `url` field

## Safety

Tool results include `disclaimer_en` and `disclaimer_ar`. Prices are catalog snapshots, not pharmacy quotes.
