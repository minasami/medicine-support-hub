# Appwrite expanded feature preview

This branch exists only to test the expanded Medicine Support Hub feature set on Appwrite Sites without changing the working `deploy/appwrite-sites-preview` deployment or Vercel production.

## Branch

`deploy/appwrite-feature-preview`

## Required browser-safe variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_SITE_URL`

Do not expose service-role, Stripe, cron, OCR, Firecrawl, Google service-account, or AI secrets in the static Appwrite Site.

## Acceptance checks

- `/medicines` is the installed PWA start page.
- Medicine search controls remain sticky while scrolling.
- Advanced medicine filters start collapsed.
- Product pages show a separate Trademark Owner field, including `SOUL PHARMA` for `SMARTEC FOR COSMETIC > SOUL PHARMA`.
- `/clinics`, `/pharmacies`, `/labs`, and `/radiology` load as public directories.
- `/clinics/emr`, `/pharmacies/pms`, `/labs/lms`, `/radiology/rms`, and `/profiles/{patientID}` remain private and must not be indexed.

Keep Vercel production active until authentication, direct-route refreshes, Supabase redirects, browser console behavior, and clinical authorization boundaries are verified.