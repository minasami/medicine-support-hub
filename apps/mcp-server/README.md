# Medicine Support Hub — MCP Phase 1

Remote Model Context Protocol server so Grok, ChatGPT, Gemini, Claude, and Cursor can search the Egyptian catalog and produce indicative medicine cost estimates.

Local endpoint: `http://localhost:8787/mcp`  
Suggested production: `https://mcp.medicinesupport.app/mcp`

## Tools

- `search_medicines`
- `get_medicine`
- `estimate_cost`
- `list_popular_medicines`
- `get_disclaimer`

Read-only. No TPA, writes, or prescription OCR in Phase 1.

## Run

```bash
cd apps/mcp-server
cp .env.example .env
node src/server.mjs
```

If Appwrite search requires a server key, set `APPWRITE_API_KEY`.

```bash
bash test-mcp.sh http://localhost:8787
```

## Connect

- Grok website: Connectors → Custom MCP → `https://YOUR_HOST/mcp`
- Grok CLI: `grok mcp add --transport http msh https://YOUR_HOST/mcp`
- xAI API: `tools: [{ type: "mcp", server_url: "https://YOUR_HOST/mcp" }]`
- ChatGPT: Developer Mode → custom MCP URL
- Gemini CLI: `mcpServers.medicine-support-hub.url`

See [docs/MCP_PHASE1.md](../../docs/MCP_PHASE1.md).
