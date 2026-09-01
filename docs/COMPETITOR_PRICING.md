# Competitor / alternative pricing

Do not scrape pharmacy apps or price portals unless the owner grants a feed.

## What ships now

MCP tools on `https://mcp.medicinesupport.app/mcp`:

- `list_price_sources` — which sources are live
- `compare_inn_prices` — same scientific name, other manufacturers in the hub catalog

That is brand-vs-brand list-price comparison inside our catalog, not Chefaa shelf prices.

## Allowed sources later

| Source | How |
|---|---|
| Hub catalog `current_price_egp` | live now |
| Licensed EDA / CAPA dumps | import dated CSV |
| CC0 public dumps (e.g. karem505/egyptian-drug-database) | snapshot file + `observed_at` + license |
| Partner pharmacy quote API | contract + env key |
| Manual field checks | `price-observations.json` |

## File format for snapshots

`apps/mcp-server/src/data/price-observations.json`

```json
[
  {
    "query": "Zurcal 20",
    "scientific_name": "pantoprazole",
    "source": "manual_field",
    "price_egp": 0,
    "observed_at": "2026-09-01",
    "license": "internal",
    "url": null,
    "note": "pack must be specified"
  }
]
```
