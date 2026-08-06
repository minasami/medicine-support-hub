# World medicine aggregator

Medicine Support Hub aims to be the **best place to start** a medicine search on the internet:
Egypt-complete where we can, and **connected to every major open encyclopedia** when data is missing.

## Product promise

1. **Local first** — Appwrite encyclopedia, MOH/EDA tariffs, company-verified fields, DrugEye prices.
2. **Federate on miss** — OpenFDA, DailyMed, RxNorm, EMA, PubChem, WHO EML, Drugs.com (link-out), DrugEye.
3. **Provenance always** — every filled field carries source + confidence.
4. **Never silent overwrite** — official tariff and company-verified data win over scrapes.
5. **Images** — company packshot → barcode Open Product Facts → PubChem structure diagram (labeled as structure, not packshot).

## User surfaces

| Surface | Path | Behavior |
|---------|------|----------|
| Local encyclopedia | `/medicines` | Primary Egypt catalog; empty results offer **World search** |
| Monograph | `/catalog/:id` | **Federated enrichment** panel fills missing fields |
| World search | `/world-search` | Parallel OpenFDA + RxNorm + PubChem + WHO + engine links |
| Barcode scan | `/scan` | Appwrite → static → Open Product Facts |
| Admin DrugEye | enrichment admin | Egypt price refresh |

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
| Image | Company upload → barcode OPF → PubChem structure |

## Engines linked from every result

Local encyclopedia · WHO EML · OpenFDA · DailyMed · RxNav · PubChem · EMA · Drugs.com · DrugEye (Egypt)

## Legal

Use official APIs and attributed links. Do not bulk-scrape commercial sites into the DB.
Structure images from PubChem are scientific diagrams, not product packshots.
