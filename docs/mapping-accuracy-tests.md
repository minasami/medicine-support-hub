# Automated mapping accuracy tests

## Run

```bash
node scripts/test-mapping-accuracy.mjs
# or
pnpm test:mapping-accuracy
```

Exit code **0** = pass, **1** = fail.

## What is covered

| Suite | Checks |
|-------|--------|
| Normalization | `normName`, `normMfr`, Jaccard |
| Fixture cases | barcode, code, name, manufacturer disambiguation, ambiguous, unmatched |
| Confidence table | 0.99 / 0.97 / 0.92 / 0.85 scores |
| Audit formula | high/medium weighted `accuracy_score_percent` |
| Collision guard | ARMOWAKE must never map to Dabur |
| Client rules | duplicate names excluded from `name_to_live` |

## Files

- `scripts/lib/mapping-match.mjs` — pure match logic
- `scripts/fixtures/mapping-accuracy-cases.json` — golden cases
- `scripts/test-mapping-accuracy.mjs` — runner

## CI suggestion

Add to your pipeline after typecheck:

```bash
pnpm test:mapping-accuracy
```

Optional live gate (needs Appwrite export):

```bash
node scripts/map-static-to-live-ids.mjs --dry-run --strict
```
