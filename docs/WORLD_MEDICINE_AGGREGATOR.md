# World medicine aggregator

Medicine Support Hub aims to be the **best place to start** a medicine search:
Egypt-complete where we can, and **connected to every major open encyclopedia** when data is missing.

## Product promise

1. **Local first** — Appwrite encyclopedia, MOH/EDA tariffs, company-verified fields, DrugEye prices.
2. **Federate on miss** — OpenFDA, RxNorm, DailyMed, EMA, PubChem, DrugBank (link-out), DrugEye.
3. **Provenance always** — every filled field carries source + confidence.
4. **Never silent overwrite** — official tariff and company-verified data win over scrapes.

## User surfaces

| Surface | Path | Behavior |
|---------|------|----------|
| Local encyclopedia | `/medicines` | Primary Egypt catalog |
| Monograph | `/catalog/:id` | **Complete data from the web** panel |
| World search | `/world-search` | Parallel OpenFDA + RxNorm + engine links |
| Admin DrugEye | enrichment admin / function | Egypt price refresh |

## CLI

```bash
node scripts/aggregator/federated-search.mjs cosentyx --sources=openfda,rxnorm
node scripts/aggregator/federated-search.mjs panadol --sources=openfda,rxnorm,drugeye
```

## Field fill order

| Field | Preferred sources |
|-------|-------------------|
| `scientific_name` | RxNorm → OpenFDA |
| `drug_class` | OpenFDA |
| `manufacturer` | OpenFDA → local |
| `current_price_egp` | MOH tariff → DrugEye → local |
| Label / indications | OpenFDA / DailyMed (summary + link) |
| Image | Company upload → reviewed barcode DB (not random web) |

## Legal

Use official APIs and attributed links. Do not bulk-scrape commercial sites into the DB.
