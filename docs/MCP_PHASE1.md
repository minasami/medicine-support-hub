# MCP Phase 1+

Medicine Support Hub exposes a remote MCP server so AI clients can search the catalog, estimate indicative EGP costs, and use generic insurance hints.

## Live host

Custom domain (use this):

- MCP: `https://mcp.medicinesupport.app/mcp`
- Health: `https://mcp.medicinesupport.app/health`

Vercel project `msh-mcp` (same app):

- `https://msh-mcp.vercel.app/mcp`

DNS: name.com CNAME `mcp` → `cname.vercel-dns.com`. Apex `medicinesupport.app` stays on Appwrite.

Legacy file-deploy (catalog-only 0.1.1): `https://medicine-support-hub-mcp.vercel.app/mcp`

## Scope

In:
- catalog search / product fetch / cost estimate
- local insurance hints
- env-gated partner TPA probe (product fields only)

Out:
- live member eligibility with national IDs
- support-request writes
- prescription OCR
- admin or donation mutations
