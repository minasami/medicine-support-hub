# Arabic fuzzy matching & WHO Essential Medicines List

## Goals

1. **Arabic drug-name fuzzy matching** — reliable search and catalog resolution when users type Arabic trade names with alef/taa/yeh variants, missing diacritics, or mixed Latin–Arabic queries.
2. **WHO EML integration** — flag essential medicines, enrich sparse monographs with INN + therapeutic section, always link out to the official list.
3. **Arabic source table clarity** — enrichment panel shows Arabic encyclopedias in a structured table (source / type / description / open), never silent overwrite.

## Files

| Path | Role |
|------|------|
| `apps/web/src/lib/arabic-fuzzy-match.ts` | `normalizeArabicDrugName`, `arabicFuzzyScore` (0–100), `bestArabicFuzzyMatch`, `rankArabicFuzzyMatches` |
| `apps/web/src/lib/who-eml.ts` | `WHO_EML_CORE` (~153), `searchWhoEmlLocal`, `isLikelyWhoEssential` |
| `apps/web/src/lib/medicine-aggregator.ts` | Calls `searchWhoEmlLocal` inside `suggestExternalEnrichment`; re-exports WHO helpers; WHO link in `buildWorldSourceLinks` |
| `apps/web/src/components/medicine-web-enrichment-panel.tsx` | Arabic source **table** + WHO EML badge |
| `apps/web/src/pages/medicine-world-search.tsx` | Dedicated WHO EML card + section on world search |
| `apps/web/src/pages/medicine-detail-page.tsx` | Monograph header “WHO Essential” badge + EML section line |

## Arabic normalization rules

- Strip tashkeel + tatweel
- Alef family → `ا`
- `ى` → `ي`
- `ة` → `ه`
- Drop `ؤ ئ ء`
- Arabic-Indic digits → Western
- Collapse punctuation / spaces; lowercase Latin

Score = hybrid of token Jaccard (50%) + character similarity via Levenshtein (40%) + first-token boost, with dose-token stripping and Arabic↔Arabic bonus. Default accept threshold **55**.

## WHO EML integration map

| Surface | Behaviour |
|---------|-----------|
| Aggregator auto-enrich | `searchWhoEmlLocal` runs with OpenFDA/RxNorm; fills empty `scientific_name` / `drug_class` only |
| World search `/world-search` | Dedicated emerald WHO card (INN, section, official link) above OpenFDA/RxNorm hits |
| Monograph header | Green “WHO Essential” badge when INN/name matches ≥ 85; shows EML section |
| Enrichment panel | Emerald WHO EML source badge when hit used |
| World source links | Always includes `list.essentialmeds.org` link-out |

- Local curated core (~153 high-value INNs, Egypt/MENA-weighted) — **no network**
- Matched via Arabic-aware scorer (minScore 70 for list hits, 85 for UI badge)
- Hit shape compatible with `AggregatorHit` (`source: "who_eml"`)
- Official verification: https://list.essentialmeds.org/

## Provenance policy (unchanged)

- Local / company / MOH data is never silently overwritten.
- External fills only empty fields via `fillMissingFromMerged`.
- Every applied field records `source:confidence` in provenance.
- WHO EML is identity + educational flag only — not a pricing or regulatory authority for Egypt.
