# Canonical ID unification

## Problem

Two independent sequences both use the field name `canonical_id`:

| Source | Typical assignment | Safe for `/catalog/:id`? |
|--------|--------------------|---------------------------|
| Static JSON `egyptian-medicines-dataset.json` | Unify script ~10001+ | **No** |
| Live Appwrite `medicines` | Import scripts ~1000+ | **Yes** |

Example failure: portfolio card **ACTI-COLLA** used static `10187` → live `/catalog/10187` showed **Clearasil**.

## Link policy (until fully unified)

Use `encyclopediaProductUrl()` in `apps/web/src/lib/catalog-links.ts`:

- `idSource: "live_db"` → `/catalog/{id}`
- `idSource: "static_dataset"` | `unknown` → `/medicines?q={name}`

## CDN / browser cache note

After deploying the routing fix, **hard-refresh** the site (or purge CDN cache).

Old JS bundles still contain `/catalog/{staticId}` links. Symptoms:

- ACTI-COLLA still opens Clearasil after `main` was fixed
- Different behavior in incognito vs normal window

Checklist:

1. Confirm deploy includes commit with `encyclopediaProductUrl` / Eva portfolio fix
2. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
3. If using Vercel/Cloudflare: purge cache for `/assets/*` and HTML routes
4. Verify network tab: JS chunk hash changed vs previous deploy
5. Confirm link target is `/medicines?q=…` not `/catalog/10187` for static portfolio cards

## Unification workflow

### 1. Export live medicines from Appwrite

```bash
export APPWRITE_API_KEY=standard_...
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_DATABASE_ID=medicine_support_hub
export APPWRITE_MEDICINES_COLLECTION_ID=medicines

node scripts/export-appwrite-medicines.mjs
# → scripts/reports/appwrite-medicines-export.json
```

### 2. Map static → live (dry-run)

```bash
node scripts/map-static-to-live-ids.mjs --dry-run
# → scripts/reports/static-to-live-id-map.json
# → console summary: exact / code / unmatched
```

### 3. Rewrite static dataset with live ids

```bash
node scripts/map-static-to-live-ids.mjs --write
# Updates apps/web/public/data/egyptian-medicines-dataset.json
# Sets canonical_id = live id when matched; keeps legacy_static_id
```

### 4. Ongoing imports

- Do **not** mint a second `nextCanonicalId` / `idx++` sequence for the same products
- New products: allocate id only in Appwrite, then refresh export + map
- Stock CSV fuzzy match should store **live** `canonical_id` only

## Match priority in the mapper

1. Exact normalized `name_en`
2. Exact normalized `name_ar` (when both sides have Arabic)
3. Exact barcode / product code
4. Otherwise **unmatched** (no fuzzy auto-write — avoids ACTI-COLLA↔Clearasil class errors)

Fuzzy matching stays in **stock SKU → live encyclopedia** flows (`sku-canonical-map.ts`), with confidence caps and human review for low scores — not in bulk static rewrite by default.
