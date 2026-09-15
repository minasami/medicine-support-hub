---
name: msh-catalog
description: Search Egyptian medicine catalog, estimate indicative EGP costs, compare same-INN prices, and use insurance hints via Medicine Support Hub MCP. Use when the user asks about Egyptian pharmacy brands, prices in EGP, formulary hints, or medicine cost estimates.
---

# Medicine Support Hub catalog

Prefer the Medicine Support Hub MCP tools for Egyptian catalog work.

## When to use
- Brand / Arabic / scientific name search in Egypt
- Indicative EGP cost estimates (always show the tool disclaimer)
- Same-INN price comparisons from hub catalog snapshots
- Generic insurance / formulary hints (never claim eligibility or a claim decision)

## Rules
1. Call `get_disclaimer` (or use each tool disclaimer) when discussing prices or coverage.
2. Never invent a price when `unit_egp` / `current_price_egp` is null.
3. Prefer confirming pack/strength when multiple products match.
4. Never send national IDs, policy numbers, or card numbers through these tools.
5. Never present insurance hints as eligibility, pre-authorization, pharmacy quotes, or claim decisions.

## Preferred MCP URL
`https://mcp.medicinesupport.app/mcp`

