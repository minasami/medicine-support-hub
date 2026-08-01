# Appwrite Sites Deployment Status & Guide

## Deployment Pipeline

Appwrite Sites builds `apps/web` using:
```bash
pnpm run build:appwrite
```

Which executes:
1. `node scripts/prepare-static-dataset.mjs`
2. `node scripts/prepare-appwrite-native-deps.mjs`
3. `pnpm run validate` (`pnpm run typecheck && pnpm run build`)
4. `node scripts/prepare-appwrite-static.mjs`

## Latest Build Status

- **Commit**: [`d01f37a`](https://github.com/minasami/medicine-support-hub/commit/d01f37a36cd384383192b6688184939b8488f706)
- **TypeScript Typecheck**: Clean (0 errors across `lib/api-client-react` and `apps/web`)
- **Features Active**:
  - PWA Barcode Scanner (`/scan`)
  - Three-tier barcode lookup (Appwrite Cloud → Static dataset → Open Product Facts API)
  - Company Profile Claims table (`company_profile_claims`)
  - Egyptian Pharmacy Prices Enrichment script (`scripts/enrich-appwrite-from-pharmacy-prices.mjs`)
