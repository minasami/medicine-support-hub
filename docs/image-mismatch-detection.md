# Bulk image mismatch detection

## Goal

Flag encyclopedia products whose `image_url` is likely **wrong or generic** (e.g. ACTI-COLLA sachets showing a stock blister-pack photo).

This is **heuristic**, not full ML vision. Output is a review queue and optional clear list.

## Signals

| Reason | Severity | Meaning |
|--------|----------|--------|
| `generic_stock_host` | high | Unsplash/Pexels/placeholder hosts |
| `placeholder_pattern` | high | URL contains placeholder/stock markers |
| `shared_stock_url` | high | Same URL reused by many products (default ≥ 8) |
| `form_vs_image_keyword_conflict` | high | e.g. SACHET in name but pill/blister in URL |
| `name_tokens_absent_from_url` | medium | Trade-name tokens never appear in image URL |
| `low_authenticity_score` / `low_match_score` | medium | Stored scores &lt; 40 |
| `unverified_bulk_image` | low | `image_source_kind` suggests bulk/scrape |
| `missing_image` | low | No URL (informational) |

Verified / company images are treated more leniently unless scores are very low.

## Usage

```bash
# Static public dataset
node scripts/detect-image-mismatches.mjs --source=static --min=medium

# After Appwrite export
node scripts/export-appwrite-medicines.mjs
node scripts/detect-image-mismatches.mjs --source=export --min=high --write-clear-list
```

Outputs:

- `scripts/reports/image-mismatch-report.json`
- `scripts/reports/image-clear-candidates.json` (with `--write-clear-list`)

## Recommended follow-up

1. Review **high** severity rows (especially `shared_stock_url` and form conflicts).
2. Clear `image_url` for `suggest_clear_image` candidates so the UI shows the neutral placeholder instead of a misleading photo.
3. Prefer **company-uploaded packshots** from verified reps for hero images.
4. Optionally wire `detectImageMismatch` into admin enrichment UI.

## Do not

- Auto-download random web images without license review.
- Treat absence of name tokens in CDN hashes as definitive (many CDNs use opaque paths — combine with shared-URL and form signals).
