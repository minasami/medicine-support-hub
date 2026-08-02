# Canonical ID mapping ops

## Commands

```bash
# 1. Export live Appwrite medicines
export APPWRITE_API_KEY=standard_...
node scripts/export-appwrite-medicines.mjs

# 2. Map + accuracy audit (always writes audit JSON)
node scripts/map-static-to-live-ids.mjs --dry-run

# 3. Optional: rewrite static dataset IDs where safely matched
node scripts/map-static-to-live-ids.mjs --write

# 4. Audit only (no public map rewrite)
node scripts/map-static-to-live-ids.mjs --audit-only

# 5. CI gate
node scripts/map-static-to-live-ids.mjs --dry-run --strict
```

## Outputs

| File | Purpose |
|------|---------|
| `scripts/reports/mapping-accuracy-audit.json` | Confidence buckets, weak matches, multi-claim lives |
| `scripts/reports/static-to-live-id-map.json` | Full row-level mapping |
| `apps/web/public/data/static-to-live-id-map.json` | Client map + `ambiguous_names` |

## Duplicate names

When several live rows share the same normalized trade name:

1. Try **barcode** among candidates  
2. Try **registration code**  
3. Try **manufacturer** (normalized)  
4. Else mark **ambiguous** — not written to `name_to_live`  

Client `resolveLiveCanonicalIdSync` returns `null` for ambiguous names so the UI uses `/catalog/n~NAME` (detail page) instead of guessing.

## Accuracy audit

`accuracy_score_percent` weights high/medium/low confidence matches.  
`--strict` exits **4** if score &lt; 70% or weak name-match rate ≥ 5%.

## Error codes

| Exit | Meaning |
|------|---------|
| 0 | OK |
| 1 | Unexpected exception |
| 2 | Missing/empty/invalid input |
| 3 | Write failure |
| 4 | `--strict` audit failed |
