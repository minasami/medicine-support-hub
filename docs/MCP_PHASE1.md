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

## Run locally

```bash
cd apps/mcp-server
cp .env.example .env
node src/server.mjs
bash test-mcp.sh http://localhost:8787
```

## Deploy (separate service from the public website)

Do **not** point the main `medicinesupport.app` Vercel/Appwrite site root at `apps/mcp-server`.
Create a second service whose root is `apps/mcp-server`.

### Fly.io

```bash
cd apps/mcp-server
fly launch --no-deploy
fly deploy
```

### Render

Use `apps/mcp-server/render.yaml` or a Node web service with start command `node src/server.mjs` and health `/health`.

### Vercel (separate project)

Create a project named `medicine-support-hub-mcp` with **Root Directory** `apps/mcp-server`. Do not change the existing website project.

After deploy, clients use:

`https://YOUR_HOST/mcp`

Suggested custom domain: `mcp.medicinesupport.app`

## Client configuration

- Grok website connectors: custom MCP URL
- Grok CLI: `grok mcp add --transport http msh https://HOST/mcp`
- xAI API: `{ "type": "mcp", "server_url": "https://HOST/mcp" }`
- ChatGPT Developer Mode custom app/plugin
- Gemini CLI `mcpServers.medicine-support-hub.url`
- Claude / Cursor mcp.json `url` field

## Safety

Tool results include `disclaimer_en` and `disclaimer_ar`. Prices are catalog snapshots, not pharmacy quotes.
