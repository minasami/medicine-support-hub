# Medicine Support Hub — Grok / xAI plugin

Remote Streamable HTTP MCP for Egyptian medicine catalog search, indicative EGP estimates, and OAuth account tools.

- MCP: `https://mcp.medicinesupport.app/mcp`
- Health: `https://mcp.medicinesupport.app/health`
- License: MIT
- Network: HTTPS to `mcp.medicinesupport.app` (and aliases `msh-mcp.vercel.app`, legacy `medicine-support-hub-mcp.vercel.app`)
- Auth: catalog tools are public; signed-in support, prescription, and personal watchlist tools use OAuth 2.1
- Credentials: never copy or expose OAuth tokens; never send national IDs or policy numbers unnecessarily

## Install (from this repo marketplace)

```bash
grok plugin marketplace add minasami/medicine-support-hub
grok plugin install medicine-support-hub --trust
```

## Direct MCP (no plugin)

```bash
grok mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```
