# Canonical ID unification & mapping

## Problem

Two independent sequences both use the field name `canonical_id`:

| Source | Typical assignment | Safe for `/catalog/:id`? |
|--------|--------------------|---------------------------|
| Static JSON `egyptian-medicines-dataset.json` | Unify script ~10001+ | **No** (until mapped) |
| Live Appwrite `medicines` | Import scripts | **Yes** |

Example: card **ARMOWAKE** used static-ish id **11539** → live `/catalog/11539` showed **Dabur shampoo**.

## Runtime mapping (implemented)

| Piece | Role |
|-------|------|
| `scripts/map-static-to-live-ids.mjs` | Match static → live by name / barcode / code |
| `apps/web/public/data/static-to-live-id-map.json` | Compact map served to the browser |
| `apps/web/src/lib/canonical-id-map.ts` | Load + resolve live id |
| `encyclopediaProductUrl()` | Use mapped live id when available, else `/catalog/n~NAME` |

Match priority in the script: **exact name_en → name_ar → barcode → code**. No fuzzy auto-write.

## Generate the map

```bash
export APPWRITE_API_KEY=standard_...
node scripts/export-appwrite-medicines.mjs
node scripts/map-static-to-live-ids.mjs --dry-run   # writes public map + audit report
node scripts/map-static-to-live-ids.mjs --write     # also rewrites static dataset IDs
```

Outputs:

- `scripts/reports/static-to-live-id-map.json` — full audit
- `apps/web/public/data/static-to-live-id-map.json` — client map (`static_to_live`, `name_to_live`)

Commit the public map after a successful run so production gets correct `/catalog/{liveId}` links.

## Link policy

1. **Mapped or `idSource: live_db`** → `/catalog/{liveId}` (true monograph)
2. **Unmapped name** → `/catalog/n~{name}` (detail page looks up by trade name, then rewrites to live id)
3. **Directory search** → `/medicines#q=…`

Prefetch the map on encyclopedia mount via `prefetchCanonicalIdMap()` so card links can use numeric live IDs without waiting.

## Hosting note

`?q=` may be stripped on trailing-slash redirects; use `#q=` for search. Hard-refresh after deploy.
