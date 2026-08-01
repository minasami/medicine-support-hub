# Egyptian pharmacy prices list → encyclopedia enrichment

## Source file

`EgyptianmedicinesPrices.xlsx - Items.csv` (pharmacy / wholesaler price dump)

| Column (AR) | Meaning |
|-------------|--------|
| السعر | Price (EGP) |
| الباركود | Barcode (EAN / internal) |
| الأسم باللغة العربية | Arabic name |
| الأسم باللغة الانجليزية | English name |
| الكود | Line code (`M…` medicine, `C…` cosmetic, `A…` accessory/device) |
| الكود المخصص للمنتج | Optional custom code |

### Scale (measured)

| Metric | Approx. |
|--------|--------|
| Raw rows | **~86,100** |
| Unique products (barcode or name) | **~69,700** |
| Medicine-class candidates | **~18,300** |
| Cosmetic | **~32,500** |
| Medical device / accessory | **~16,700** |
| Fragrance | **~2,300** |
| Rows with multiple price observations | **~9,100** products |

This is **not** a clean EDA register. It mixes Rx, OTC, cosmetics, devices, offers, and **historical price snapshots** (same product, many prices/codes).

---

## Enrichment strategy (recommended)

### Phase A — Parse & dedupe (offline)

```bash
node scripts/parse-egyptian-pharmacy-prices.mjs \
  --input "/path/to/EgyptianmedicinesPrices.xlsx - Items.csv" \
  --out scripts/reports/egyptian-pharmacy-deduped.json \
  --medicines-only scripts/reports/egyptian-pharmacy-medicines.json
```

Rules:

1. **Identity key**: valid barcode (≥8 digits, not dummy like `1000`) → `bc:{barcode}`; else `n:{NORMALIZED_EN_NAME}`.
2. **Name cleanup**: strip `$`, `% OFF`, `1+1`, Arabic/English offer noise.
3. **Prices**: collect all observations → `min_price_egp`, `max_price_egp`, `median_price_egp`, `current_price_egp` (last seen), `price_obs`.
4. **Type**: code prefix `M/C/A` + name heuristics → `medicine` | `cosmetic` | `medical_device` | `fragrance` | `unknown`.

### Phase B — Match existing encyclopedia

For each medicine candidate:

1. Exact **barcode** match on Appwrite `medicines.barcode`
2. Exact / normalized **name_en**
3. Fuzzy brand-token (same engine as stock import)

Outcomes:

| Match | Action |
|-------|--------|
| Found | **PATCH** price fields, fill empty barcode/code/name_ar; set `product_type` if empty |
| Not found + type medicine | Optional **CREATE** new `canonical_id` in a reserved high range |
| Cosmetic / device / fragrance | Do **not** auto-create as medicines; optional separate catalog later |

### Phase C — Appwrite write (rate-limit aware)

Browser **createDocument** limit ≈ **120 / minute / user**. Server API key is better for bulk.

- Prefer **PATCH existing** (far fewer writes than 18k creates)
- Throttle ≤ **100 writes/min**
- Or Appwrite **Bulk API** if available on the project
- Never upload all 70k rows as medicines

### Phase D — Quality gates

- Do not set `has_verified_dataset` / EDA badge from this file alone (retail prices ≠ regulatory verification)
- Clear offer-contaminated names before public display
- Prefer **median** or **max** of recent obs for `current_price_egp` (document the choice)

---

## What this file is good for

1. **Price enrichment** on known products (barcode/name hit)
2. **Barcode fill** when encyclopedia row lacks barcode
3. **Arabic name** fill when empty
4. **Candidate list** of medicines missing from the encyclopedia

## What this file is bad for

1. Sole source of scientific name / ATC / EDA status
2. Treating every `C`/`A` row as a medicine
3. One row = one product (many are price history duplicates)

---

## Suggested next implementation steps

1. Run the parser → review `egyptian-pharmacy-medicines.json` counts
2. Script `enrich-appwrite-from-pharmacy-prices.mjs` with `APPWRITE_API_KEY`:
   - load existing medicines (paginated)
   - match barcode/name
   - PATCH matches only first (safe)
3. Report: matched / unmatched / patched
4. Only then decide on creating new medicine documents for high-confidence unmatched `M*` rows
