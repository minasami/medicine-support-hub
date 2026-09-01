# Catalog price alerts

Daily job compares the popular-brand watchlist against the last hub catalog snapshot.

This is **not** a competitor-pharmacy scrape.

## Run locally

```bash
cd apps/mcp-server
node src/price-alerts.mjs --write
```

Optional env:

- `PRICE_ALERT_THRESHOLD_PCT` (default 5)
- `PRICE_ALERT_WEBHOOK` POST JSON when alerts fire
- `APPWRITE_API_KEY` if the medicines collection is not public

## GitHub Action

`.github/workflows/price-alerts.yml` runs daily at 06:00 UTC and on demand.

- First run writes the baseline snapshot
- Later runs open or comment on issue **Catalog price alerts** when a watched brand moves ≥ threshold
- Snapshot is committed only when prices change

## MCP

- `list_price_watchlist`
- `check_price_alerts`
