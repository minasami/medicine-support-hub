# Platform integration — connected medicine search

## User journeys (connected)

| Journey | Entry | System behavior |
|---------|--------|------------------|
| Egypt catalog | `/` → `/medicines` | Local Appwrite + static dataset |
| Monograph | `/catalog/:id` | Auto-enrich missing INN/class via OpenFDA/RxNorm |
| World search | `/world-search` | Federated APIs + Arabic + global link-outs |
| Barcode | `/scan` | Lookup local → open data fallbacks |
| Company data | `/industry` → `/account` | Verified manufacturer writes |
| Admin | `/admin` | Claims, enrichment, mapping |

## Automatic enrichment

On monograph load, if critical fields are missing (`scientific_name`, `drug_class`, `manufacturer`, price):

1. `autoEnrichIfNeeded()` runs once per product (30 min in-tab cache)
2. OpenFDA + RxNorm queried in parallel
3. Empty fields only; provenance retained in UI
4. User can **Refresh from the web** or open **World search**

## Arabic sources (link-out)

- Altibbi, WebTeb, Mawdoo3 health, Almaany medical
- Egyptian Drug Authority search, DrugEye
- Arabic Google medical query

## Global sources

OpenFDA, DailyMed, RxNorm, PubChem, DrugBank, EMA, WHO EML

## Rules

1. Local / MOH tariff / company-verified win over external
2. No silent overwrite of published company data
3. Prefer APIs; link-out for commercial encyclopedias
