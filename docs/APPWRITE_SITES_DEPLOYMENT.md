# Appwrite Sites deployment

## Live deployment links

| Environment | URL |
|-------------|-----|
| **Production (primary)** | [https://medicinesupport.app](https://medicinesupport.app) |
| Medicines encyclopedia | [https://medicinesupport.app/medicines](https://medicinesupport.app/medicines) |
| Industry rep registration | [https://medicinesupport.app/industry](https://medicinesupport.app/industry) |
| Account / company portal | [https://medicinesupport.app/account](https://medicinesupport.app/account) |
| Admin industry claims | [https://medicinesupport.app/admin/industry](https://medicinesupport.app/admin/industry) |
| NGO donations | [https://medicinesupport.app/ngo/donations](https://medicinesupport.app/ngo/donations) |
| Eva Pharma public page | [https://medicinesupport.app/companies/eva-pharma](https://medicinesupport.app/companies/eva-pharma) |
| Legacy Vercel (historical) | [https://medicine-support-hub.vercel.app](https://medicine-support-hub.vercel.app/) |

Set `VITE_PUBLIC_SITE_URL=https://medicinesupport.app` on the Appwrite Site and redeploy after domain changes.

After merging claim or data-layer work to `main`, confirm the Appwrite Site build finished so production serves the new commit (e.g. `882efcb` claims wiring).

---

## Site configuration

Create an Appwrite project, then create a Site by connecting the GitHub repository.

- Repository: `minasami/medicine-support-hub`
- Production branch: `main`
- Root directory: repository root (`.`)
- Framework: React, or Other JavaScript if React detection does not expose the required fields
- Rendering: Static
- Install command: `corepack enable && pnpm install --no-frozen-lockfile`
- Build command: `pnpm run build:appwrite`
- Output directory: `apps/web/dist/public` (confirm against current package scripts)
- Node.js: 22

Appwrite builds this site in a Linux musl environment. `--no-frozen-lockfile` may be required until the cross-libc lockfile is stable.

The Appwrite build command typically runs typecheck and production build, rewrites the public origin when `VITE_PUBLIC_SITE_URL` is set, creates static entry-point files for literal Wouter routes, and emits a client-rendered `404.html`.

## Site environment variables

Add only **browser-safe** values to the Appwrite Site:

```text
VITE_PUBLIC_SITE_URL=https://medicinesupport.app
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
VITE_APPWRITE_DATABASE_ID=medicine_support_hub
```

Optional collection overrides:

```text
VITE_APPWRITE_MEDICINES_COLLECTION_ID=medicines
VITE_APPWRITE_CLAIMS_COLLECTION_ID=company_profile_claims
```

Do **not** add server secrets (API keys, service role keys, cron secrets) to a static site. Marking a value “secret” in a dashboard does not make it safe in browser bundles.

## Auth redirect URLs

Allowlist production callbacks for Appwrite Auth (and any remaining Supabase Auth if still used):

```text
https://medicinesupport.app/portal
https://medicinesupport.app/account
https://medicinesupport.app/patient-auth
https://medicinesupport.app/industry
```

## Verification checklist (production)

1. Landing page and public navigation.
2. Direct load of `/medicines`, `/industry`, `/account`, `/admin/industry`, `/ngo/donations`.
3. Login and company representative claim submit → row in Appwrite `company_profile_claims`.
4. Admin approve claim → `/account` shows verified portal.
5. PWA manifest / installability if enabled.
6. Arabic and English layouts.
7. Browser console and failed network requests (especially Appwrite 401/403 on claims).

## Known SPA routing note

Hosting may redirect `/medicines?q=…` to `/medicines/` and drop the query string. Portfolio links use hash `#q=…` where needed (see `catalog-links.ts`). Prefer fixing server rewrite rules to **preserve query strings** on trailing-slash redirects.

## Security

- Never commit `APPWRITE_API_KEY` into the frontend.
- Tighten `company_profile_claims` update permissions to admin/team after bootstrap.
