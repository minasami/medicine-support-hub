# Arabic fuzzy matching & WHO Essential Medicines List

## Arabic fuzzy matching

Module: `apps/web/src/lib/arabic-fuzzy-match.ts`

| Feature | Behavior |
|---------|----------|
| Normalization | Alef variants, ة→ه, ى→ي, strip tashkeel/tatweel, optional ال |
| Scoring | exact 100 · prefix 92 · substring 78 · token/edit blend · first-token ≥62 |
| Min accept | 55 (monograph name resolve) |

Used by:

- `normalizeTradeName` (catalog links)
- `normalizeSearchTerm` (search engine)
- Medicine detail name-keyed resolution

## WHO EML

Module: `apps/web/src/lib/who-eml.ts`

- Core INN subset for offline fuzzy match (not the full WHO list)
- Hits participate in `suggestExternalEnrichment` as source `who_eml`
- Official UI: https://list.essentialmeds.org/
- Badge **WHO EML candidate** on monograph when scientific name matches core set

Always treat WHO EML as **reference identity**, not Egypt pricing authority.
