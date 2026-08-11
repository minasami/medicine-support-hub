# Appwrite “Edge” Functions (Medicine Support Hub)

## Important clarification

Appwrite **does not** ship a separate product named *Edge Functions* (unlike Supabase Deno Edge Functions or Cloudflare Workers).

What you get on Appwrite Cloud:

| Capability | Appwrite name |
|------------|----------------|
| Serverless HTTP / event / cron code | **Appwrite Functions** |
| Regional execution (e.g. `fra`) | Function region = project region |
| Public HTTPS URL | Function execution domain |
| Auto-deploy from Git | Functions ← Git integration |

Cold starts in FRA were improved significantly (Appwrite 2025 performance work). Treat **Functions** as your edge/API layer.

## Functions in this repo

| ID | Role |
|----|------|
| `edge-api` | Public health, catalog ping, query expand |
| `adaptive-signal-aggregator` | Anonymized search signals + human-gated aliases |
| `firecrawl-image-enricher` | Image enrichment |
| `ocr-prescription-parser` | Prescription OCR |
| `eda-tariff-sync` | Tariff sync (scheduled) |
| `drugeye-refresh` | Catalog refresh helper |

## Deploy

```bash
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_API_KEY=…   # functions.write + create

pnpm run deploy:functions
# or one function:
node scripts/deploy-appwrite-functions.mjs --only edge-api --ensure
```

GitHub: **Actions → Deploy Appwrite Functions**.

## Runtime contract (Node)

```js
export default async ({ req, res, log, error }) => {
  return res.json({ ok: true });
};
```

Env available at runtime includes `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID`, `APPWRITE_REGION`, etc.

## Function settings (Console)

For each function after first create:

1. **Execute access**
   - Public HTTP (`edge-api`, adaptive ingest): role `any` or `users` as appropriate
   - Admin-only actions: check `ADAPTIVE_ADMIN_KEY` in code
2. **Variables**
   - `APPWRITE_API_KEY` (server key scoped tightly)
   - `APPWRITE_DATABASE_ID=medicine_support_hub`
   - optional `ADAPTIVE_ADMIN_KEY`
3. **Build**
   - Commands: `npm install`
   - Entrypoint: `src/main.js`
   - Runtime: `node-18.0` or `node-21.0` if available

## Call edge-api

After deploy, Console → **edge-api** → **Execute** or use the execution URL:

```bash
# Health (via Appwrite execution API)
curl -X POST "https://fra.cloud.appwrite.io/v1/functions/edge-api/executions" \
  -H "X-Appwrite-Project: 6a54ac3a00272c02d6e0" \
  -H "Content-Type: application/json" \
  -d '{"path":"/health"}'
```

Or enable a **function domain** in Console for direct HTTPS.

## Site ↔ Function

Set on the **Site** (not GitHub secret):

```env
VITE_ADAPTIVE_FUNCTION_URL=https://<your-function-domain-or-execution-url>
```

Client beacon posts anonymized events only — no names, emails, or full IPs.
