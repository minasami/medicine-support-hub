# Appwrite expanded deployment

The expanded Medicine Support Hub feature set is deployed through the branch used by the public Appwrite preview domain while Vercel remains the production fallback.

## Branch

`deploy/appwrite-sites-preview`

## Public Appwrite domain

`https://ms.appwrite.network/`

## Required browser-safe variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_SITE_URL=https://ms.appwrite.network`

Do not expose service-role, Stripe, cron, OCR, Firecrawl, Google service-account, or AI secrets in the static Appwrite Site.

## Acceptance checks

- `/medicines` is the installed PWA start page.
- Medicine search controls remain sticky while scrolling.
- Advanced medicine filters start collapsed.
- Product pages show a separate Trademark Owner field, including `SOUL PHARMA` for `SMARTEC FOR COSMETIC > SOUL PHARMA`.
- `/clinics`, `/pharmacies`, `/labs`, and `/radiology` load as public directories.
- `/clinics/emr`, `/pharmacies/pms`, `/labs/lms`, `/radiology/rms`, and `/profiles/{patientID}` remain private and must not be indexed.
- Direct route refreshes, account login, portal login, and the static admin integration status remain functional.

The previous Appwrite branch tip is preserved at `backup/appwrite-sites-preview-20260714` for rollback. Keep Vercel production active until authentication, browser behavior, and clinical authorization boundaries are fully verified.