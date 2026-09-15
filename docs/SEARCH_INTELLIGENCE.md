# Search intelligence (EN + AR fault-tolerant)

Unified Medicines page (`/medicines?q=`) owns search after PR #177. Catalog fetch is Appwrite; relevance is **client re-rank**.

## Pipeline

1. **Normalize** (`search-normalize.ts` / `normalizeFuzzy`): NFKC, strip tashkeel + tatweel, collapse alef/hamza/yaa/taa marbuta, unify Arabic-Indic digits, lower-case Latin, strip punctuation.
2. **Expand** (`expand-search-query.ts`): INN fixups, Egypt brand aliases (e.g. `congesta` → Congestal), Arabic dict/transliteration variants, prefix probes (len ≥ 6).
3. **Fetch** (`medicines-appwrite-page.ts`): Appwrite fulltext is not fuzzy. If primary hits are thin/empty, probe up to ~5 alternate forms across `name_en` / `name_ar` / `scientific_name`, merge ≤ 80 candidates, then client-rank.
4. **Rank** (`rank-medicine-results.ts` + adaptive): exact → barcode → compound (INN+company) → prefix → token → fuzzy (Levenshtein + pharma fold + Arabic scorer). Prefer short standalone names over long combo strings.
5. **UX**: optional **Did you mean…?** (`did-you-mean.ts`) when top fuzzy/alias differs from query. `search_logs`, `search_score` sort chips, `t(en,ar)` unchanged.

## Limits

| Knob | Value | Why |
|------|-------|-----|
| `EXPAND_MAX` | 10 | Cap variant list |
| Variant probes | ≤ 5 forms × 3 attrs | Mobile / Appwrite quota |
| `VARIANT_CANDIDATE_CAP` | 80 | Client fuzzy cost |
| Debounce | 280 ms | Already on encyclopedia page |

## Examples that should hit

| Typed | Expected |
|-------|----------|
| `congesta` / `congestol` | Congestal |
| `concoer` / `konkor` | Concor |
| `amoxycillin` | Amoxicillin |
| `أموكسيسيلين` (hamza alef) | اموكسيسيلين / Amoxicillin |
| `panadole` | Panadol |

## Tests

```bash
cd apps/web && npx tsx src/lib/search-intelligence.test.ts
cd apps/web && npx tsx src/lib/drug-name-edge-cases.test.ts
```

## Catalog governance (active learning)

- Public list/search **excludes** `medicines.is_hidden` (admins use `includeHidden`).
- Daily `rankDrugs` soft-downranks hidden/merged rows and open `catalog_quality_flags`.
- See `docs/CATALOG_ADMIN_QUALITY.md` for Merge / Hide / Edit and `detectCatalogQuality`.

