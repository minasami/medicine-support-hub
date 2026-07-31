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
- `idSource: "static_dataset"` | `unknown` → `/medicines#q={name}` (**hash**, not `?q=`)

### Why `#q=` instead of `?q=`

Production host was observed to redirect:

```text
/medicines?q=ACTI-COLLA…  →  /medicines/
```

and **drop the query string**. Hash fragments are not sent to the server, so `#q=` survives trailing-slash redirects.

The medicines page reads both `?q=` and `#q=`.

### Hosting fix (recommended)

Configure the host so either:

1. `trailingSlash: false` (see root `vercel.json`), or
2. Trailing-slash redirects **preserve** the query string, or
3. No redirect from `/medicines` to `/medicines/`

CDN / browser cache note: after deploying link fixes, hard-refresh (Ctrl+Shift+R) and purge asset cache.

## Unification workflow

### 1. Export live medicines from Appwrite

```bash
export APPWRITE_API_KEY=standard_...
node scripts/export-appwrite-medicines.mjs
```

### 2. Map static → live (dry-run)

```bash
node scripts/map-static-to-live-ids.mjs --dry-run
node scripts/map-static-to-live-ids.mjs --write
```

Match priority: exact name_en → name_ar → barcode/code. No fuzzy auto-write.
