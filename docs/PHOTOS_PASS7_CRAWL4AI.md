# Pass-7 packshot enrichment (Crawl4AI)

Complements passes 1–6 (CSV / EgyptDwa AJAX / Shopify / OpenCart HTTP scrapers) with
**Crawl4AI** — an open-source Playwright crawler — for JS-rendered Egyptian pharmacy
and pharma listing pages, then high-confidence matching into empty Appwrite `image_url`
fields.

## Install (box / CI worker — not in the Capacitor app bundle)

```bash
python3 -m venv /workspace/crawl4ai-venv
/workspace/crawl4ai-venv/bin/pip install -U pip
/workspace/crawl4ai-venv/bin/pip install -r scripts/requirements-crawl4ai.txt
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright \
  /workspace/crawl4ai-venv/bin/crawl4ai-setup
```

Override the interpreter with `CRAWL4AI_PYTHON` or `--python`.

If Crawl4AI install or runtime fails, the scraper falls back to HTTP expansion of
`dwaprices.com/routing-new.php` (trigraph + brand stems) and still produces pass-7
artifacts — see scrape summary `crawl4ai_used` / `notes`.

## Crawl targets

| Source | Method | Notes |
|--------|--------|-------|
| egyptdwa.com `/m/{id}` | Crawl4AI | Sitemap IDs missing from pass-6 AJAX + related `/dwa/` cards |
| dwaprices.com `med.php` | Crawl4AI | Gap-sample IDs + related-product BFS |
| dwaprices.com `routing-new.php` | HTTP | Digraph→trigraph + empty-brand stems (volume / fallback) |

Polite concurrency (default 6 browser tabs), soft-fail on blocks, skips default
placeholders (`medefault`, `circlemedhome`, logos).

Chat4Data login is **not** required; CSV is Chat4Data-shaped for interoperability only.

## npm scripts

```bash
pnpm run photos:enrich:pass7:scrape   # Crawl4AI + HTTP → artifacts/photos-pass7/
pnpm run photos:enrich:pass7:dry     # match only (dry-run)
pnpm run photos:enrich:pass7         # match + PATCH Appwrite (needs APPWRITE_API_KEY)
pnpm run photos:enrich:pass7:all     # scrape + write
```

## Matching / safety

Reuses pass-5/6 gates: min score 88, strength + dosage-form compatibility, HEAD/GET
image verify, live empty re-check before PATCH, never overwrite a good `image_url`.
Server API key only (never client).

## Artifacts

Under `artifacts/photos-pass7/`:

- `*-products.json` per source
- `pass7-scraped-products.json` combined
- `pass7-chat4data.csv`
- `pass7-enrichment-report.json` / `pass7-summary.json`
- `empty-image-estimate.json`
