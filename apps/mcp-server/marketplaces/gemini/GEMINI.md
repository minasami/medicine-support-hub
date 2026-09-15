# Medicine Support Hub

Use the `medicine-support-hub` MCP tools for Egyptian pharmacy catalog work.

## Tools
- `search_medicines` — brand / Arabic / scientific name search
- `get_medicine` — one product by id
- `estimate_cost` — indicative EGP totals (always show disclaimer)
- `list_popular_medicines` — starter brands
- `get_disclaimer` — price + insurance-hint disclaimers
- Additional Phase 1+ tools may include insurance hints, INN compare, and price alerts

## Rules
1. Always surface tool disclaimers for prices and coverage.
2. Never invent prices when fields are null.
3. Never treat insurance hints as eligibility, pre-auth, or a claim decision.
4. Never send national IDs, policy numbers, or card numbers.
5. Prefer confirming pack/strength when multiple matches exist.

## Endpoint
Preferred: `https://mcp.medicinesupport.app/mcp`
