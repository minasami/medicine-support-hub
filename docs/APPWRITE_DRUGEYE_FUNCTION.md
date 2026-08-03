# Appwrite Function: `drugeye-refresh`

Port of the DrugEye admin price refresh to **Appwrite Functions** so it runs on Appwrite hosting (no Vercel `/api` required).

Source: `functions/drugeye-refresh/`

---

## What it does

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Single** | Manual execution / admin UI | Search DrugEye by trade name; optional PATCH to Appwrite medicine |
| **Cron** | Schedule (or `{ "mode": "cron" }`) | Batch-fill missing/zero `current_price_egp` (default 20 rows / run) |

Fields that may be updated: `current_price_egp`, `scientific_name`, `drug_class`, `manufacturer` (empty-only unless `force_price`).

---

## 1. Create the function (Console)

1. Open [Appwrite Console](https://cloud.appwrite.io) → Project `6a54ac3a00272c02d6e0` (or your project).
2. **Functions** → **Create function**
   - Name: `drugeye-refresh`
   - Runtime: **Node.js 18** or **Node.js 20**
   - Entrypoint: `src/main.js`
   - Root directory: `functions/drugeye-refresh` (if deploying from Git) **or** upload the folder as a deployment.
3. Enable **Execute access** for:
   - `users` (admin UI executions), and/or
   - `any` only if you protect with a secret header (not recommended public).

### Git deployment (recommended)

If the project is connected to GitHub `minasami/medicine-support-hub`:

1. Function settings → **Git** → path `functions/drugeye-refresh`
2. Production branch: `main`
3. Deploy latest commit

### CLI deployment

```bash
# Install Appwrite CLI if needed
npm i -g appwrite-cli

appwrite login
appwrite client --endpoint https://fra.cloud.appwrite.io/v1 --projectId 6a54ac3a00272c02d6e0

# Create function once (or use Console id)
appwrite functions create \
  --functionId drugeye-refresh \
  --name drugeye-refresh \
  --runtime node-18.0 \
  --execute users \
  --entrypoint src/main.js

# Deploy code from repo root
cd functions/drugeye-refresh
appwrite functions createDeployment \
  --functionId drugeye-refresh \
  --code . \
  --activate true \
  --entrypoint src/main.js
```

---

## 2. Function environment variables

In **Function → Settings → Environment variables** set:

| Variable | Required | Example |
|----------|----------|---------|
| `APPWRITE_API_KEY` | Yes (writes) | API key with `databases` read/write |
| `APPWRITE_ENDPOINT` | Yes | `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Yes | `6a54ac3a00272c02d6e0` |
| `APPWRITE_DATABASE_ID` | No | `medicine_support_hub` |
| `APPWRITE_MEDICINES_COLLECTION_ID` | No | `medicines` |
| `DRUGEYE_CRON_LIMIT` | No | `20` |
| `DRUGEYE_CRON_THROTTLE_MS` | No | `800` |
| `DRUGEYE_MIN_SCORE` | No | `40` |
| `DRUGEYE_SEARCH_URL` | No | default PharOrg search URL |

Redeploy or restart after changing variables.

---

## 3. Cron / schedule (refresh job)

1. Function → **Settings** → **Schedule** (or **Cron**)
2. Suggested expression (every 6 hours):

```text
0 */6 * * *
```

3. Optional body for schedule (if Console supports payload):

```json
{ "mode": "cron", "limit": 20, "throttle_ms": 800 }
```

Empty schedule trigger is treated as cron (batch missing prices).

**Manual cron test:**

```bash
curl -X POST "https://fra.cloud.appwrite.io/v1/functions/drugeye-refresh/executions" \
  -H "X-Appwrite-Project: 6a54ac3a00272c02d6e0" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": "{\"mode\":\"cron\",\"limit\":5}", "async": false}'
```

Or from Appwrite Console → Function → **Execute** with body:

```json
{ "mode": "cron", "limit": 5 }
```

---

## 4. Single-product execution (admin)

```json
{
  "name_en": "Panadol Advance 500",
  "document_id": "<appwrite-document-$id>",
  "apply": true,
  "force_price": false
}
```

### From the web app

1. Set in **Sites** / web env:

```bash
VITE_APPWRITE_FUNCTION_DRUGEYE_REFRESH=drugeye-refresh
```

(or the numeric/function ID shown in Console)

2. Open medicine enrichment admin → **Refresh price from DrugEye**  
   The UI prefers `/api/admin-drugeye-refresh` when available, then falls back to the Appwrite Function execution endpoint.

---

## 5. Permissions checklist

- [ ] Function deploy active (green)
- [ ] API key can **read/update** `medicines` in `medicine_support_hub`
- [ ] Schedule enabled (cron)
- [ ] Timeout ≥ **60s** (DrugEye + several sequential searches); for cron use **120–300s** if limit > 10
- [ ] Memory ≥ **256 MB**
- [ ] Execute permission: authenticated users (admin UI) + API key for schedule

---

## 6. Local / CLI batch (without Function)

Still available for large backfills:

```bash
export APPWRITE_API_KEY=...
node scripts/export-appwrite-medicines.mjs
node scripts/enrich-appwrite-from-drugeye.mjs --dry-run --limit 25
node scripts/enrich-appwrite-from-drugeye.mjs --write --limit 25
```

---

## 7. Safety notes

- **Do not** set cron limit very high — DrugEye is a third-party site; throttle stays on by default.
- Prefer filling **empty** prices; use `force_price` only when intentionally overwriting.
- Company-verified fields should remain authoritative when present (function only fills empties except force_price).
