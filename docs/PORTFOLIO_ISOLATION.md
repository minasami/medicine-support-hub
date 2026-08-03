# Company portfolio isolation

## Problem

`repmedcare@gmail.com` (Med-Care) saw **Registered Portfolio Products (849)** belonging to **Eva Pharma** and could open Edit on them.

### Causes

1. **localStorage merge** loaded *all* `company_portfolio_updates_*` and `all_custom_medicine_updates` without filtering by company.
2. **Manufacturer filter** used loose `.includes(targetKey)` matching.
3. **Fallback** set empty company detection to **SOUL PHARMA** (and earlier bugs assigned Eva to unrelated emails).

## Fix

- `apps/web/src/lib/company-portfolio-scope.ts` — strict `productBelongsToCompany` + scoped localStorage read
- `CompanyMedicineAdditionForm` requires `companySlug`; portfolio empty without it
- Only merges `company_portfolio_updates_{slug}` for that slug
- Account passes `companyName` + `companySlug` from verified membership only

## Apply form wire (if needed)

```bash
node scripts/wire-portfolio-isolation.mjs
```

## Ops for affected users

On the Med-Care browser, clear:

- `all_custom_medicine_updates`
- `company_portfolio_updates_eva-pharma` (if present)
- any `medicine_update_*` keys that are not Med-Care products

Then hard-refresh `/account`.
