# Medicine Support Hub — MCP Phase 1

Remote Model Context Protocol server so Grok, ChatGPT, Gemini, Claude, and Cursor can search the Egyptian catalog and produce indicative medicine cost estimates.

## Live endpoints

| Transport | URL | Clients |
|---|---|---|
| Streamable HTTP (preferred) | `https://medicine-support-hub-mcp.vercel.app/mcp` | Grok, ChatGPT, xAI API, Gemini |
| SSE (legacy) | `https://medicine-support-hub-mcp.vercel.app/sse` | older Claude / Cursor SSE connectors |
| SSE message POST | `https://medicine-support-hub-mcp.vercel.app/messages?sessionId=` | paired with `/sse` |
| stdio (local) | `node apps/mcp-server/src/stdio.mjs` | Claude Desktop, Cursor |

Health: `https://medicine-support-hub-mcp.vercel.app/health`

Suggested custom domain later: `https://mcp.medicinesupport.app/mcp`

## Tools

- `search_medicines`
- `get_medicine`
- `estimate_cost`
- `list_popular_medicines`
- `get_disclaimer`

Read-only. No TPA, writes, or prescription OCR in Phase 1.

## Run

HTTP:
```bash
cd apps/mcp-server
cp .env.example .env
npm start
```

stdio:
```bash
cd apps/mcp-server
npm run start:stdio
```

```bash
bash test-mcp.sh http://localhost:8787
```

## Connect

- Grok website: Custom MCP → Streamable HTTP → `https://medicine-support-hub-mcp.vercel.app/mcp`
- Grok CLI: `grok mcp add --transport http msh https://medicine-support-hub-mcp.vercel.app/mcp`
- xAI API: `tools: [{ type: "mcp", server_url: "https://medicine-support-hub-mcp.vercel.app/mcp" }]`
- ChatGPT Developer Mode: same `/mcp` URL
- Claude Desktop / Cursor local: see `clients/mcp.json` (`command` + `stdio`)
- Older SSE clients: `/sse`

See [docs/MCP_PHASE1.md](../../docs/MCP_PHASE1.md).
