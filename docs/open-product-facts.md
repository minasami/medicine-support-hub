# Open Product Facts integration

## What it is

[Open Product Facts](https://world.openproductsfacts.org) is part of the Open Food Facts ecosystem (with Open Beauty Facts and Open Food Facts). Public barcode APIs return product name, brand, category, and images when the code exists in their collaborative database.

**Not a substitute for the Egyptian medicines encyclopedia** — coverage is stronger for international food/beauty packs than for local Rx brands. Used as a **fallback** when Appwrite and the static dataset have no barcode hit.

## API (no key)

```
GET https://world.openproductsfacts.org/api/v2/product/{barcode}.json
GET https://world.openbeautyfacts.org/api/v2/product/{barcode}.json
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

`status: 1` → product found. User-Agent should identify the app.

## Code

| File | Role |
|------|------|
| `apps/web/src/lib/open-product-facts.ts` | Client |
| `apps/web/src/lib/barcode-lookup.ts` | Calls OPF after Appwrite + static miss |

Scan UI shows an Open Facts match with `source` badge and links to **name search** in `/medicines` (no fake `canonical_id`).

## Policy

- Attribution: data © Open Food Facts contributors, available under ODbL.
- Do not copy OPF rows wholesale into Appwrite as “verified” medicines without human/company review.
- Prefer pharmacy-prices enrichment for Egyptian retail barcodes.
