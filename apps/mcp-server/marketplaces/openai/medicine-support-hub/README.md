# Medicine Support Hub — ChatGPT / Codex plugin

Portable Agent Plugins package + Codex compatibility overlay.

- MCP: `https://mcp.medicinesupport.app/mcp`
- Portable: root `plugin.json` + `mcp.json`
- Compat: `.codex-plugin/plugin.json` + `.mcp.json`

## Authentication

Catalog tools remain public. Signed-in support, prescription, and personal watchlist tools require OAuth 2.1;
ChatGPT/Codex should start the OAuth flow when a protected tool is called. The portable `mcp.json` and
`.mcp.json` intentionally keep only the MCP URL because OpenAI Agent Plugins manifests do not define an
OAuth auth-hint field; OAuth discovery is served by the MCP endpoint.

For the OpenAI public directory account-capable listing, set **Auth: OAuth**. A separate catalog-only listing
may remain anonymous (**Auth: none**). See the repository [submission checklist](../../../../../docs/MCP_MARKETPLACE_PUBLISH.md).

## Local marketplace test

Repo marketplace entry lives at `.agents/plugins/marketplace.json`.

```bash
codex plugin marketplace add minasami/medicine-support-hub
# or open ChatGPT desktop → Plugins Directory → this repo marketplace
```

## Public directory

Submit via OpenAI plugin submission portal (With MCP, Universal URL). See `docs/MCP_MARKETPLACE_PUBLISH.md`.
