# Medicine Support Hub — MCP 0.3.3 (catalog + OAuth account tools)

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

## Authenticated account tools (0.3.0)

Public catalog tools stay open. Account tools use **OAuth 2.1 + PKCE** with Appwrite/Google login on [medicinesupport.app/mcp-oauth/](https://medicinesupport.app/mcp-oauth/).

Protected: `whoami`, `submit_support_request`, `list_my_requests`, `submit_prescription_request`, `submit_drug_contribution`, `list_my_watchlist`, `add_watchlist_item`, `check_my_price_alerts`.

Discovery:

- `https://mcp.medicinesupport.app/.well-known/oauth-protected-resource`
- `https://mcp.medicinesupport.app/.well-known/oauth-authorization-server`

Full connect/login guide: [docs/OAUTH.md](./docs/OAUTH.md)

### Smoke (post-deploy)

```bash
# Expect AS + PRM metadata (not health JSON) and health version 0.3.3
pnpm --dir apps/mcp-server smoke:oauth
# or
MCP_BASE=https://mcp.medicinesupport.app EXPECT_VERSION=0.3.3 \
  node apps/mcp-server/scripts/smoke-oauth-wellknown.mjs
pnpm --dir apps/mcp-server test:oauth-ticket

curl -sS https://mcp.medicinesupport.app/.well-known/oauth-authorization-server | jq '{issuer,authorization_endpoint,token_endpoint}'
curl -sS https://mcp.medicinesupport.app/.well-known/oauth-protected-resource | jq '{resource,authorization_servers}'
curl -sS https://mcp.medicinesupport.app/health | jq '{version,oauth}'
```



- `search_medicines`, `get_medicine`, `estimate_cost`, `list_popular_medicines`, `get_disclaimer` (public)
- Insurance hints, INN compare, global catalog price alerts (public, read-only)
- OAuth account tools listed above (writes bound to Appwrite user id)

No TPA member eligibility with national IDs. Prescription **binary** upload remains on `/rx/upload` (MCP accepts text + optional storage file id/url).

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
