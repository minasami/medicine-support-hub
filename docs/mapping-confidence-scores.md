# Mapping confidence score calculation

Confidence is a **0–1 score** assigned when a static row is linked to a live Appwrite medicine. Higher = safer to use as `/catalog/{liveId}`.

## Base scores (unique match)

| Match method | Confidence | Rationale |
|--------------|------------|-----------|
| `exact_barcode` | **0.99** | Barcode uniquely identifies a SKU |
| `exact_code` | **0.97** | Registration / item code |
| `exact_name_en` | **0.92** | Normalized English trade name, single live row |
| `exact_name_ar` | **0.90** | Normalized Arabic name, single live row |

## Duplicate-name disambiguation

When several live rows share the same normalized name, confidence is lower and depends on the tie-breaker:

| Method | Confidence | When used |
|--------|------------|-----------|
| `dup_barcode` | **0.98** | Barcode matches one candidate |
| `dup_code` | **0.95** | Registration code matches one candidate |
| `dup_manufacturer` | **0.85** | Manufacturer (normalized) matches one candidate |
| `dup_mfr_similarity` | **0.50 + 0.30 × Jaccard** (capped at **0.80**) | Manufacturer narrows set; name token Jaccard finishes |
| `ambiguous_duplicate` | **0.00** | No safe pick → **not mapped** |

### Manufacturer normalization

Lowercase, strip legal suffixes (`pharma`, `ltd`, `s.a.e.`, …), collapse punctuation/spaces, then equality or substring containment.

### Name similarity (Jaccard)

```
norm(s) = lowercase, keep letters/digits/Arabic, collapse spaces
tokens = unique words in norm(s)
Jaccard(a,b) = |A ∩ B| / |A ∪ B|
```

Used only for audit flags and `dup_mfr_similarity`, **not** for primary auto-match.

## Aggregate accuracy score

After all rows are scored:

```
matched = rows with live_canonical_id
high   = confidence ≥ 0.9
medium = 0.7 ≤ confidence < 0.9
low    = 0 < confidence < 0.7

accuracy_score_percent =
  round( 1000 * (high + 0.7*medium + 0.4*low) / matched ) / 10
```

**Pass** (for `--strict`):

- `accuracy_score_percent ≥ 70`
- weak name-match rate &lt; 5% of matched  
  (name match where Jaccard(static, live) &lt; 0.5 and method is not barcode/code)

## Client behavior

| Confidence / status | Link behavior |
|---------------------|---------------|
| Mapped via static id | `/catalog/{liveId}` |
| Unique name in `name_to_live` | `/catalog/{liveId}` |
| Name in `ambiguous_names` | No id resolve → `/catalog/n~{name}` |
| Unmatched / map load error | Name-keyed or search fallback |
