# EgyptDwa medicines enrichment

Enrich the live Appwrite `medicines` collection from an **EgyptDwa** export CSV (`medicines3.csv`).

## CSV columns

| Column | Use |
|--------|-----|
| Medicine Name | Match key (EN or AR) |
| Price | `current_price_egp` |
| Image | `image_url` |
| Category title | `category` (Arabic therapeutic class) |
| Medicine Name link | `egyptdwa_source_url` + EgyptDwa id |

Typical size: ~3,400 unique products, almost all with price + image.

## Pipeline

```bash
# 1) Parse CSV → JSON
node scripts/parse-egyptdwa-medicines.mjs \
  --input /path/to/medicines3.csv \
  --out scripts/reports/egyptdwa-medicines.json

# 2) Export live Appwrite medicines (recommended for correct $id)
export APPWRITE_API_KEY=...
node scripts/export-appwrite-medicines.mjs

# 3) Dry-run match report
node scripts/enrich-appwrite-from-egyptdwa.mjs --dry-run

# 4) Apply patches (empty price/image only by default)
node scripts/enrich-appwrite-from-egyptdwa.mjs --write --limit 200

# Optional: overwrite existing prices/images
node scripts/enrich-appwrite-from-egyptdwa.mjs --write --force-price --force-image
```

## Matching rules

1. Exact normalized `name_en` / `name_ar`
2. Fuzzy score ≥ 85 (strong) or ≥ 70 (weak, still patched in write mode)

Only **empty** fields are filled unless `--force-price` / `--force-image`.

## Report

`scripts/reports/egyptdwa-enrichment-report.json` — matched / unmatched samples and patch reasons.

## npm shortcuts

```bash
pnpm run egyptdwa:parse -- --input ./medicines3.csv
pnpm run egyptdwa:enrich:dry
pnpm run egyptdwa:enrich
```

## Notes

- Prices on EgyptDwa can include hospital / parallel-import figures; prefer official tariff when conflict is known.
- Illegal-import rows are kept as source data; filter in UI if needed.
- Attribute `egyptdwa_source_url` is optional — PATCH retries without it if the column is missing in Appwrite.
