# Appwrite user access map

## Helper

`apps/web/src/lib/map-appwrite-user-access.ts`

```ts
import { mapAppwriteUserToAccess } from "@/lib/map-appwrite-user-access";

const access = await mapAppwriteUserToAccess({
  userId: session.user.id,
  userEmail: session.user.email,
  profileRole: profile?.role,
  supabaseFetch,
  auth: {
    labels: accountLabels, // optional Appwrite Account labels
    prefs: accountPrefs,   // optional Account.getPrefs()
  },
});
```

## What it merges

| Source | Fields |
|--------|--------|
| Staff profile | `profileRole` → `staffRole` (`PLATFORM_ADMIN`, `PHARMACIST`, …) |
| Company claims | `resolveCompanyRepMembership` → `companyRep` |
| Appwrite Labels | `platform_admin`, `company:{slug}`, `company_rep` |
| Prefs | `role`, `company_slug` |

## Permission flags

| Flag | Meaning |
|------|---------|
| `canAccessAdmin` | Platform admin |
| `canReviewCompanyClaims` | Approve/reject manufacturer claims |
| `canSubmitCompanyProducts` | Draft / bulk upload for **own** claimed company (pending OK) |
| `canEditCompanyEncyclopedia` | Edit existing encyclopedia rows for **own** company (**approved** only) |
| `canManagePortfolioFor(slug)` | Portfolio UI scoped to matching slug |
| `canEditCompanySlug(slug)` | Encyclopedia write for matching slug when approved |

## Policy notes

- Company assignment still comes from `resolve-company-rep.ts` (no Eva default for unrelated emails).
- Labels are optional enhancers; claims remain source of truth for manufacturer reps until Labels are written on approve.
- Use `effectiveCompanySlug` when rendering `/account` portfolio and stock import.

## Related

- `resolve-company-rep.ts`
- `company-claims-data.ts`
- `role.tsx`
- `docs/PORTFOLIO_ISOLATION.md`
