# Appwrite Functions deployment automation

## How it works

```text
functions/<id>/  +  appwrite.json
        │
        ▼
scripts/deploy-appwrite-functions.mjs
  1. Optional --ensure → create missing function resources
  2. tar.gz package of function folder
  3. POST /v1/functions/{id}/deployments  (multipart, activate=true)
```

## Triggers

| Workflow | When |
|----------|------|
| **Deploy Appwrite Functions** | Push to `main` touching `functions/**` or `appwrite.json`; also manual |
| **CD Deploy** | Every push to `main` (after build gate) |

## Secrets

Same as Site CD:

- `APPWRITE_API_KEY` — needs **functions.write** (and create if using `--ensure`)
- `APPWRITE_PROJECT_ID`
- Optional var: `APPWRITE_ENDPOINT` (default `https://fra.cloud.appwrite.io/v1`)

## Local deploy

```bash
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=…
export APPWRITE_API_KEY=…

# Dry run
node scripts/deploy-appwrite-functions.mjs --dry-run

# Create missing + deploy all
node scripts/deploy-appwrite-functions.mjs --ensure

# One function
node scripts/deploy-appwrite-functions.mjs --only adaptive-signal-aggregator --ensure
```

## Functions in this repo

| ID | Path |
|----|------|
| `firecrawl-image-enricher` | `functions/firecrawl-image-enricher` |
| `ocr-prescription-parser` | `functions/ocr-prescription-parser` |
| `eda-tariff-sync` | `functions/eda-tariff-sync` |
| `adaptive-signal-aggregator` | `functions/adaptive-signal-aggregator` |
| `drugeye-refresh` | `functions/drugeye-refresh` (auto-discovered if present) |

Register new functions in `appwrite.json` (preferred) or drop a folder under `functions/<id>/` with `src/main.js`.

## Manual GitHub Action

**Actions → Deploy Appwrite Functions → Run workflow**

- `only`: single function id  
- `ensure`: create if missing  

## Verify in Console

**Functions → [function] → Deployments** — latest should be **active** after build finishes.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 / 403 | API key scopes: functions.read/write |
| 404 function | Run with `--ensure` or create in Console with matching `$id` |
| Build failed | Open deployment **Logs**; check `package.json` + entrypoint `src/main.js` |
| Deploy skipped in CI | Confirm `APPWRITE_API_KEY` and `APPWRITE_PROJECT_ID` repository secrets |
