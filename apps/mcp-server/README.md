# Medicine Support Hub — MCP Phase 1

Remote Model Context Protocol server so Grok, ChatGPT, Gemini, Claude, and Cursor can search the Egyptian catalog and produce indicative medicine cost estimates.

Local endpoint: `http://localhost:8787/mcp`

**Live (separate Vercel project, not the Appwrite website):**
`https://medicine-support-hub-mcp.vercel.app/mcp`

Health: `https://medicine-support-hub-mcp.vercel.app/health`

Suggested custom domain later: `https://mcp.medicinesupport.app/mcp`

Some datacenter `curl` calls get Vercel Firewall `403` (`x-vercel-mitigated: deny`). Test in a browser or from Grok/ChatGPT. If the browser is also blocked, disable Attack Challenge Mode on the Vercel project `medicine-support-hub-mcp`.

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

- Grok website: Connectors → Custom MCP → `https://medicine-support-hub-mcp.vercel.app/mcp`
- Grok CLI: `grok mcp add --transport http msh https://medicine-support-hub-mcp.vercel.app/mcp`
- xAI API: `tools: [{ type: "mcp", server_url: "https://medicine-support-hub-mcp.vercel.app/mcp" }]`
- ChatGPT: Developer Mode → custom MCP URL
- Gemini CLI: `mcpServers.medicine-support-hub.url`

See [docs/MCP_PHASE1.md](../../docs/MCP_PHASE1.md).
