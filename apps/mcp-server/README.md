# Medicine Support Hub — MCP Phase 1+

Remote Model Context Protocol server so Grok, ChatGPT, Gemini, Claude, Codex, and Cursor can search the Egyptian catalog and produce indicative medicine cost estimates.

## Live endpoints

| Transport | URL | Clients |
|---|---|---|
| Streamable HTTP (preferred) | `https://mcp.medicinesupport.app/mcp` | Grok, ChatGPT, Codex, xAI API, Gemini, Claude |
| Streamable HTTP (Vercel) | `https://msh-mcp.vercel.app/mcp` | same |
| Streamable HTTP (legacy) | `https://medicine-support-hub-mcp.vercel.app/mcp` | catalog-only older deploy |
| SSE (legacy) | `https://mcp.medicinesupport.app/sse` | older Claude / Cursor SSE connectors |
| stdio (local) | `node apps/mcp-server/src/stdio.mjs` | Claude Desktop, Cursor |

Health: `https://mcp.medicinesupport.app/health`  
OpenAI domain challenge: `https://mcp.medicinesupport.app/.well-known/openai-apps-challenge` (env `OPENAI_APPS_CHALLENGE`)

## Tools

- `search_medicines`
- `get_medicine`
- `estimate_cost`
- `list_popular_medicines`
- `get_disclaimer`

Plus Phase 1+ insurance hints, INN compare, and price alerts (read-only). No TPA member eligibility with national IDs, support-request writes, or prescription OCR in Phase 1.

## Install snippets

### Grok / xAI

```bash
# Plugin marketplace (this repo)
grok plugin marketplace add minasami/medicine-support-hub
grok plugin install medicine-support-hub --trust

# Direct MCP
grok mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

Grok website: Custom MCP → Streamable HTTP → `https://mcp.medicinesupport.app/mcp`  
xAI API: `tools: [{ type: "mcp", server_url: "https://mcp.medicinesupport.app/mcp" }]`

### Claude Code

```bash
claude plugin marketplace add minasami/medicine-support-hub
claude plugin install medicine-support-hub@medicine-support-hub
```

### Codex / ChatGPT

```bash
codex plugin marketplace add minasami/medicine-support-hub
```

ChatGPT Developer Mode: Plugins → + → MCP URL `https://mcp.medicinesupport.app/mcp`  
ChatGPT desktop: Plugins Directory → marketplace **Medicine Support Hub** (repo `.agents/plugins/marketplace.json`).

Public universal directory: submit via OpenAI plugin portal (see publish doc).

### Gemini CLI

```bash
gemini extensions link /path/to/medicine-support-hub/apps/mcp-server/marketplaces/gemini
# or
gemini mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

## Marketplace packaging

Cross-ecosystem manifests:

- `apps/mcp-server/marketplaces/` — Grok, OpenAI/Codex, Claude, Gemini packages
- `.grok-plugin/marketplace.json` · `.agents/plugins/marketplace.json` · `.claude-plugin/marketplace.json`
- Publish runbook: [docs/MCP_MARKETPLACE_PUBLISH.md](../../docs/MCP_MARKETPLACE_PUBLISH.md)
- Client configs: [clients/mcp.json](./clients/mcp.json)

## Run locally

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

See [docs/MCP_PHASE1.md](../../docs/MCP_PHASE1.md).
