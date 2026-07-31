# Product type classification

## Goal

The encyclopedia includes pharmaceuticals **and** cosmetics / cosmeceuticals / fragrances / nutrition. Public pages must not label a perfume as an **EDA Verified** oral **General Medicine**.

## Schema

| Field | Type | Notes |
|--------|------|--------|
| `product_type` | enum string | See values below |
| `has_verified_dataset` | boolean | **Only meaningful for `medicine`** |
| `scientific_name` | string \| null | Never store placeholders |
| `drug_class` | string \| null | Never store placeholders |
| `category` | string \| null | Use real category or type label |
| `route` | string \| null | Fragrances/cosmetics → Topical / External |

### `product_type` values

| Value | Meaning |
|--------|----------|
| `medicine` | Registered pharmaceutical / drug product |
| `cosmetic` | Cosmetic (cream, shampoo, makeup, etc.) |
| `cosmeceutical` | Borderline cosmetic with active claims |
| `fragrance` | EDT / EDP / perfume / cologne |
| `personal_care` | Intimate wash, toothpaste, etc. |
| `nutrition` | Supplements, vitamins, formulas |
| `medical_device` | Devices / consumables |
| `baby_formula` | Infant nutrition |
| `unknown` | Insufficient data — do not show as verified medicine |

## UI rules

1. **EDA Verified** badge only if `product_type === "medicine"` **and** `has_verified_dataset` **and** scientific name is not a placeholder.
2. Category badge uses `product_type` label when category is missing or is a placeholder.
3. Do not display placeholder strings (`Active Ingredient`, `Therapeutic Category`, `General Medicine`) in fact rows — show `—` instead.

## Classification source

Code: `apps/web/src/lib/product-type.ts`

Order:
1. Explicit `product_type`
2. Name heuristics (EDT, EDP, perfume, shampoo, …)
3. Category heuristics
4. Placeholder-heavy → `unknown`
5. Default → `medicine` (low confidence)

## Cleanup

```bash
# Report only
node scripts/cleanup-fragrance-cosmetic-products.mjs --dry-run

# Persist to static dataset
node scripts/cleanup-fragrance-cosmetic-products.mjs --write
```

Appwrite / live DB: run an equivalent update using the same heuristics (set `product_type`, clear placeholders, force `has_verified_dataset = false` for non-medicines).

## Import script rules (mandatory)

- **Never** default `scientific_name` to `"Active Ingredient"`.
- **Never** default `drug_class` to `"Therapeutic Category"` / `"Therapeutic Product"`.
- **Never** default `category` to `"General Medicine"` without evidence.
- **Never** default `route` to `"Oral"` when form is unknown.
- **Never** set `has_verified_dataset = true` unless the row comes from a verified medicine source (e.g. medicines5 / EDA-linked).
- Prefer `null` / omit over fake defaults.

## Known bad import sources (audited)

| Script | Issue |
|--------|--------|
| `scripts/import-all-86k-medicines-to-appwrite.py` | Defaults scientific_name, drug_class, route |
| `scripts/enrich-and-migrate-4-databases.py` | Defaults Active Ingredient, Oral, General Medicine |
| `scripts/unify-and-sync-databases.mjs` | medicines2 new rows → General Medicine / Tablet / Oral |
| `apps/web/src/lib/patient-auth.tsx` | Appwrite adapt defaults `has_verified_dataset ?? true` |

Example failure: `/catalog/11654` **DAVIDOFF EDT 50 ML** shown as General Medicine + EDA Verified + Oral + Active Ingredient.
