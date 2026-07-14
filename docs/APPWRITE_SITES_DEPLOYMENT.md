# Appwrite Sites deployment

This deployment is intentionally introduced as a parallel preview before any production-domain cutover.

## Site configuration

Create an Appwrite project, then create a Site by connecting the GitHub repository.

- Repository: `minasami/medicine-support-hub`
- Production branch for the first test: `deploy/appwrite-sites-preview`
- Root directory: repository root (`.`)
- Framework: React, or Other JavaScript if React detection does not expose the required fields
- Rendering: Static
- Install command: `corepack enable && pnpm install --no-frozen-lockfile`
- Build command: `pnpm run build:appwrite`
- Output directory: `apps/web/dist/public`
- Node.js: 22

Appwrite currently builds this site in a Linux musl environment. The preview branch therefore permits the x64-musl native packages used by Rollup, Tailwind CSS Oxide, and Lightning CSS. `--no-frozen-lockfile` is required on this preview branch until the cross-libc lockfile update is committed.

The Appwrite build command runs the existing typecheck and production build, rewrites the public origin when `VITE_PUBLIC_SITE_URL` is configured, creates static entry-point files for all literal Wouter routes found in `apps/web/src/App.tsx`, and emits a client-rendered `404.html`.

## Site environment variables

Add only these browser-safe values to the Appwrite Site:

```text
VITE_PUBLIC_SITE_URL=https://ms.appwrite.network
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

`VITE_PUBLIC_SITE_URL` controls canonical links, sitemap origins, structured data, AI-readable files, and bundled public links in the Appwrite output. When a branded domain is connected, change it to that exact HTTPS origin and redeploy.

Do not add any server credential to a static site. In particular, do not add:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
FIRECRAWL_API_KEY
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
BING_IMAGE_SEARCH_KEY
AI_INTEGRATIONS_OPENAI_API_KEY
```

Static Vite variables can be compiled into browser assets. Marking a value secret in a hosting dashboard does not make it safe for browser use.

## Supabase authentication

Add every active frontend callback to Supabase Auth > URL Configuration > Redirect URLs.

Current Appwrite preview:

```text
https://ms.appwrite.network/portal
https://ms.appwrite.network/account
```

For a branded preview domain:

```text
https://preview.medicinesupport.app/portal
https://preview.medicinesupport.app/account
```

Keep the existing Vercel redirect URLs until production migration is complete.

## Branded-domain sequence

1. Register `medicinesupport.app` and confirm the renewal price, ownership, and transfer rights.
2. Keep `medicinesupport.app` on the stable production deployment until Appwrite reaches backend parity.
3. Connect `preview.medicinesupport.app` to the Appwrite Site.
4. Set `VITE_PUBLIC_SITE_URL=https://preview.medicinesupport.app` in Appwrite and redeploy.
5. Add both `/portal` and `/account` callbacks for the preview domain to Supabase.
6. Test canonical tags, sitemap URLs, direct routes, authentication, request submission, and PWA installation.
7. Move the apex domain to Appwrite only after server functions, cron work, dynamic metadata, and security headers have equivalents.

## Verification checklist

Test the Appwrite-generated domain before connecting a production domain:

1. Landing page and public navigation.
2. Direct loading of `/manifesto`, `/search`, `/portal`, `/ngo/dashboard`, and `/admin`.
3. Password login and Google login.
4. Medicine search and request submission through Supabase.
5. PWA manifest, service worker, icons, and installability.
6. Arabic and English layouts.
7. Browser console and failed network requests.
8. Canonical tags and sitemap entries use the configured public domain.

## Known migration boundary

Appwrite Sites will host the Vite frontend, but it does not automatically translate `vercel.json` into Appwrite behavior.

The current Vercel deployment still provides:

- standalone handlers in `/api`;
- the scheduled Firecrawl cron;
- dynamic HTML metadata for medicines, companies, generics, diseases, and public pages;
- Vercel-specific response headers and path rewrites.

Therefore, do not move the production domain or remove Vercel after the first Appwrite build. Full cutover requires migrating those handlers to Appwrite Functions or Supabase Edge Functions, replacing the cron schedule, and restoring equivalent routing and security-header behavior.

## Promotion sequence

1. Deploy this branch to an Appwrite preview site.
2. Add the generated domain to the Supabase redirect allowlist.
3. Complete the verification checklist.
4. Migrate server functions and scheduled work.
5. Re-test SEO responses, protected routes, and admin automation.
6. Merge the branch and switch the production domain only after parity is confirmed.

