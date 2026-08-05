# Medicine data aggregator

Medicine Support Hub is **local-first** (Appwrite `medicines`) and **federated on miss**:
when a field or product is missing, adapters query external encyclopedias/search engines,
score matches, and optionally enrich Appwrite with **provenance**.

## Priority order (system of record)

| Rank | Source | Best for | Overwrite policy |
|------|--------|----------|------------------|
| 1 | Appwrite live `medicines` | Egypt trade names, EGP tariff, company data | Always prefer |
| 2 | Verified company rep updates | Packshots, portfolio truth | Prefer over scrape |
| 3 | MOH / EDA tariff imports | Official price | Prefer for `official_tariff_egp` |
| 4 | DrugEye (PharOrg) | Egypt retail price, local composition | Fill empty price/INN only |
| 5 | OpenFDA / DailyMed | US label, indications, warnings | Clinical text only; never EGP |
| 6 | RxNorm (NIH) | INN, RxCUI, dose forms | Identity / INN fill |
| 7 | PubChem | Structure / compound ids | Optional science panel |
| 8 | Open Product Facts / barcode DBs | GTIN packshots | Image candidates only |

## User experience

1. Search hits **local index** first (fast).
2. Monograph shows local fields + “Sources consulted” chips.
3. If critical fields empty (price, INN, class, image) → **Enrich from web** runs adapters in parallel (throttled).
4. Results merge with confidence scores; weak matches never auto-apply.
5. Admin/company can accept patches; provenance stored (`field_sources`, `last_enriched_at`).

## Legal / ops

- Prefer official APIs (OpenFDA, RxNorm) over HTML scrapers.
- DrugEye: **on-demand only**, never full-catalog crawl.
- Attribute external text; clinical decisions remain with professionals.
- Cache external responses (Appwrite `enrichment_cache` or filesystem reports) to respect rate limits.

## Code map

| Path | Role |
|------|------|
| `scripts/aggregator/openfda-client.mjs` | OpenFDA drug label search |
| `scripts/aggregator/rxnorm-client.mjs` | NIH RxNorm identity |
| `scripts/aggregator/federated-search.mjs` | Parallel fan-out + merge |
| `scripts/drugeye-client.mjs` | Existing Egypt search |
| `scripts/enrich-appwrite-from-*.mjs` | Batch writers |
| `apps/web/src/lib/medicine-aggregator.ts` | Browser-side orchestrator types + client calls |

## Missing-field triggers

| Missing | Adapters |
|---------|----------|
| `scientific_name` / INN | RxNorm → DrugEye → OpenFDA |
| `current_price_egp` | DrugEye → MOH tariff batch |
| `drug_class` | OpenFDA pharm class → DrugEye |
| `image_url` | Company upload → barcode DB → review queue |
| No local hit | Federated search → propose create draft |
