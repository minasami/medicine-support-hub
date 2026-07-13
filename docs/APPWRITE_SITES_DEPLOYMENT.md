# Appwrite Sites deployment

This deployment is intentionally introduced as a parallel preview before any production-domain cutover.

## Site configuration

Create an Appwrite project, then create a Site by connecting the GitHub repository.

- Repository: `minasami/medicine-support-hub`
- Production branch for the first test: `deploy/appwrite-sites-preview`
- Root directory: repository root (`.`)
- Framework: React, or Other JavaScript if React detection does not expose the required fields
- Rendering: Static
- Install command: `corepack enable && pnpm install --frozen-lockfile`
- Build command: `pnpm run build:appwrite`
- Output directory: `apps/web/dist/public`
- Node.js: 22

The Appwrite build command runs the existing typecheck and production build, then creates static entry-point files for all literal Wouter routes found in `apps/web/src/App.tsx`. It also emits a client-rendered `404.html` for hosts that support that convention.

## Site environment variables

Add only the browser-safe Supabase values to the Appwrite Site:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

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

After Appwrite creates the site domain, add the exact callback URL below to Supabase Auth > URL Configuration > Redirect URLs:

```text
https://YOUR-APPWRITE-SITE-DOMAIN/portal
```

Keep the existing Vercel redirect URLs until production migration is complete.

## Verification checklist

Test the Appwrite-generated domain before connecting a custom domain:

1. Landing page and public navigation.
2. Direct loading of `/manifesto`, `/search`, `/portal`, `/ngo/dashboard`, and `/admin`.
3. Password login and Google login.
4. Medicine search and request submission through Supabase.
5. PWA manifest, service worker, icons, and installability.
6. Arabic and English layouts.
7. Browser console and failed network requests.

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
