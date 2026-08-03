# Appwrite-only platform

Medicine Support Hub production uses **Appwrite Auth + Appwrite Database** only.

Supabase is **not** used at runtime for auth, roles, claims, medicines, donations, or stock.

## Source of truth

| Concern | Appwrite resource |
|---------|------------------|
| Login / session | Appwrite Auth (Account) |
| Medicines encyclopedia | DB `medicine_support_hub` → table `medicines` |
| Company rep claims | table `company_profile_claims` |
| Manufacturer stock | `manufacturer_stock_batches` / `manufacturer_stock_lots` |
| Donation exchange | `donation_listings` / `donation_lots` / `donation_requests` |
| Access snapshot | `mapAppwriteUserToAccess()` → claims + optional Labels |

## Code notes

- `company-claims-data.ts` talks to Appwrite SDK only.
- `resolve-company-rep.ts` does **not** call PostgREST / Supabase.
- `mapAppwriteUserToAccess` does **not** require `supabaseFetch`.
- `patient-auth.tsx` may still expose a symbol named `supabaseFetch` as a **legacy compatibility shim** that intercepts old `/rest/v1/...` paths and maps them to Appwrite or static data. Prefer Appwrite modules (`company-claims-data`, stock data, donation-data) for new code.

## Legacy folders (not production runtime)

- `supabase/` migrations and edge functions — historical; do not deploy for live sites.
- `scripts/sync-supabase-to-appwrite-db.mjs` — one-time migration tool only.
- `.agents/skills/supabase*` — agent docs, not app code.

## Env (Appwrite)

```
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=...
VITE_APPWRITE_DATABASE_ID=medicine_support_hub
```

Do not require `VITE_SUPABASE_*` for production builds.
