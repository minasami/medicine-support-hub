# Medicine Support Hub — Grok / xAI plugin

Remote Streamable HTTP MCP for Egyptian medicine catalog search and indicative EGP estimates.

- MCP: `https://mcp.medicinesupport.app/mcp`
- Health: `https://mcp.medicinesupport.app/health`
- License: MIT
- Network: HTTPS to `mcp.medicinesupport.app` (and aliases `msh-mcp.vercel.app`, legacy `medicine-support-hub-mcp.vercel.app`)
- Auth: none for Phase 1 public catalog tools
- Credentials: none required; never send national IDs or policy numbers through these tools

## Install (from this repo marketplace)

```bash
grok plugin marketplace add minasami/medicine-support-hub
grok plugin install medicine-support-hub --trust
```

## Direct MCP (no plugin)

```bash
grok mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```
