# Egyptian Ministry of Health / EDA official tariffs

## Context

In Egypt, **finished human medicine retail prices are set by the regulator** (historically MOHP ministerial decrees; today primarily the **Egyptian Drug Authority — EDA** under the Ministry of Health framework).

- Pricing framework: **Ministerial Decree 499/2012** (and subsequent EDA practice)
- Public UI label: **Official tariff price** (`current_price_egp` / `official_tariff_egp`)
- Market / pharmacy / EgyptDwa / DrugEye figures are **secondary observations**, not the legal ceiling by themselves

There is **no stable public bulk API** published by EDA for the full national price list. Integration therefore uses **operator-supplied tariff files** (CSV/XLSX exports) plus optional scheduled re-application against Appwrite.

---

## Field model (Appwrite `medicines`)

| Field | Meaning |
|-------|---------|
| `official_tariff_egp` | Latest known **MOH/EDA tariff** (EGP) |
| `current_price_egp` | Display price (prefer official tariff when present) |
| `price_source` | `moh_eda_tariff` \| `drugeye` \| `egyptdwa` \| `pharmacy_list` \| `company` |
| `tariff_updated_at` | ISO time of last official tariff write |
| `tariff_list_version` | Optional filename / circular id |
| `has_verified_dataset` | EDA-verified monograph / dataset (separate from price) |

**Rule:** when applying MOH/EDA tariffs, set both `official_tariff_egp` and `current_price_egp` (unless `--official-only`).

Optional columns to add in Appwrite Console if missing:

- `official_tariff_egp` (double)
- `price_source` (string, 64)
- `tariff_updated_at` (string/datetime)
- `tariff_list_version` (string, 128)

---

## Pipeline

```bash
# 1) Parse a tariff export (CSV)
node scripts/parse-moh-eda-tariff.mjs \
  --input /path/to/eda-tariff.csv \
  --out scripts/reports/moh-eda-tariff.json

# 2) Export live medicines (for $id matching)
export APPWRITE_API_KEY=...
node scripts/export-appwrite-medicines.mjs

# 3) Dry-run
node scripts/enrich-appwrite-from-moh-tariff.mjs --dry-run

# 4) Apply (authoritative prices)
node scripts/enrich-appwrite-from-moh-tariff.mjs --write --limit 500
```

### npm

```bash
pnpm run tariff:parse -- --input ./eda-tariff.csv
pnpm run tariff:enrich:dry
pnpm run tariff:enrich
```

---

## CSV column aliases accepted

English or Arabic headers, case-insensitive:

| Logical field | Example headers |
|---------------|-----------------|
| name_en | Trade Name, English Name, الاسم الانجليزي, Product Name |
| name_ar | Arabic Name, الاسم العربي, الاسم التجاري |
| scientific_name | Scientific Name, Generic, المادة الفعالة |
| price | Price, Tariff, السعر, السعر الرسمي, Public Price |
| manufacturer | Manufacturer, Company, الشركة |
| strength | Strength, التركيز |
| pack | Pack, العبوة |
| reg_no | Registration, Reg No, رقم التسجيل |

---

## Appwrite Function `eda-tariff-sync`

Path: `functions/eda-tariff-sync/`

| Mode | Body |
|------|------|
| Cron / schedule | `{}` or `{ "mode": "cron", "limit": 50 }` |
| Manual file URL | `{ "mode": "url", "url": "https://.../moh-eda-tariff.json" }` |
| Single product | `{ "name_en": "Panadol", "price_egp": 32.5 }` |

**Env:** `APPWRITE_API_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`, `APPWRITE_MEDICINES_COLLECTION_ID`, optional `TARIFF_JSON_URL`, `TARIFF_CRON_LIMIT`.

Suggested schedule: `0 3 * * *` (daily 03:00 UTC) after you publish a refreshed `moh-eda-tariff.json` to a URL or Appwrite Storage.

---

## Priority vs other enrichers

| Source | Authority |
|--------|-----------|
| MOH/EDA tariff file | **Highest** for `official_tariff_egp` / display tariff |
| Company-verified update | High (company portal) |
| DrugEye | Medium (observed) |
| EgyptDwa / pharmacy lists | Medium–low (retail snapshots) |

EgyptDwa and pharmacy scripts should **not** overwrite `official_tariff_egp`. They may fill `current_price_egp` only when official tariff is empty (already the pattern for empty-only fills).

---

## Legal / ops notes

- Tariff circulars change; re-run parse + enrich after each official list release.
- Do not scrape EDA portals aggressively; use official downloads or licensed data feeds when available.
- `has_verified_dataset` remains independent (monograph quality), not automatic from price alone.
