# MCP Phase 1+

Medicine Support Hub exposes a remote MCP server so AI clients can search the catalog, estimate indicative EGP costs, and use generic insurance hints.

## Live host

Preferred (Git-linked, current): Vercel project `msh-mcp`

- MCP: `https://msh-mcp.vercel.app/mcp`
- Health: `https://msh-mcp.vercel.app/health`

Legacy file-deploy (catalog-only 0.1.1): `https://medicine-support-hub-mcp.vercel.app/mcp`

Suggested custom domain: `mcp.medicinesupport.app` (DNS not attached yet).

Do not reuse the Appwrite website project.

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
