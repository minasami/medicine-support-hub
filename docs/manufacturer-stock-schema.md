# Manufacturer stock import schema (TablesDB)

Durable storage for periodic company stock/portfolio CSV uploads (e.g. Eva Pharma).

Database: `medicine_support_hub`

## Table: `manufacturer_stock_batches`

| Column | Type | Notes |
|--------|------|--------|
| company_slug | string | |
| company_name | string | |
| source_filename | string nullable | |
| row_count | integer | |
| matched_count | integer | Rows linked to canonical_id |
| unmatched_count | integer | |
| created_by | string nullable | User id |

## Table: `manufacturer_stock_lots`

| Column | Type | Notes |
|--------|------|--------|
| batch_id | string | FK batch |
| company_slug | string | indexed |
| item_code | string | SKU |
| item_desc | string | |
| lot_no | string | |
| list_price_egp | double nullable | |
| expiry_date | string / datetime | ISO or empty |
| po_category | string | Local / Export |
| quantity | integer nullable | |
| canonical_id | integer nullable | Encyclopedia link |
| match_method | string | exact_code, normalized_name, … |
| match_confidence | double | 0–1 |
| near_expire | boolean | |
| is_expired | boolean | |

### Indexes

- `company_slug` on both tables
- `canonical_id` on lots
- `item_code` on lots
- `batch_id` on lots

## Env overrides

```
VITE_APPWRITE_STOCK_BATCHES_ID=manufacturer_stock_batches
VITE_APPWRITE_STOCK_LOTS_ID=manufacturer_stock_lots
```

Until tables exist, the client falls back to `localStorage` (same pattern as donation exchange).

## SKU mapping

`apps/web/src/lib/sku-canonical-map.ts` resolves `item_code` / stripped trade name against the static encyclopedia dataset and optional Appwrite `medicines` collection.
