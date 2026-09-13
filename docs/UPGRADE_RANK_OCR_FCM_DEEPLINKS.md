# Upgrade slice: Ranking + OCR + FCM + Deep Links

**Branch / PR:** `feat/rank-ocr-fcm-deeplinks-1.0.23`  
**App version:** Android `1.0.23` (versionCode `24`)  
**Appwrite project:** `6a54ac3a00272c02d6e0`  
**Database:** `medicine_support_hub`  
**Endpoint:** `https://appwrite.medicinesupport.app/v1` (Cloud alias `https://fra.cloud.appwrite.io/v1` also works)

**Push architecture:** Appwrite Messaging is the send path. FCM/APNs are transport providers configured in the Appwrite Console — app code never uses Firebase Admin.

## Collections created

| Collection ID   | Purpose |
|-----------------|--------|
| `search_logs`   | Click/search instrumentation (`user_id`, `query`, `drug_id` / `medicine_id`, `canonical_id`, `timestamp`, `source`) |
| `annotations`   | Low-confidence OCR queue for RLAIF (`image_crop_id`, `user_id`, `label_json`, `votes[]`, `status`, `created_at`, `confidence`, `drug_name`) |
| `fcm_tokens`    | Device push tokens (`user_id`, `token`, `platform`, `updated_at`) |

### Medicines attributes added

- `search_score` (double) — composite ranking score  
- `search_count_30d` (integer)  
- `order_count_30d` (integer)  
- `completeness_score` (double, 0–1)  
- `description` (string, optional)  
- `ingredients` (string, optional)  

Indexes: `idx_key_search_score`, `idx_key_search_count_30d`, `idx_key_completeness_score`

Re-run provisioning: `node scripts/provision-upgrade-collections.mjs`

## Functions

| ID | Runtime | Schedule | Notes |
|----|---------|----------|-------|
| `rankDrugs` | node-20 | `0 3 * * *` daily | CF + completeness + popularity + quality → writes `search_score` |
| `ocr-prescription-parser` | node-20 | — | Accepts `{ text }` / `{ image }`; MedGemma hook; annotations if confidence &lt; 0.8 |
| `sendPush` | node-20 | — (wire `orders` update event in Console) | **Appwrite Messaging** `createPush` (not Firebase Admin) |
| `retrainModel` | node-20 | `0 4 * * 0` weekly | RLAIF stub only |

Deploy: `APPWRITE_API_KEY=… pnpm run deploy:functions` (ensure endpoint/project match).

### `rankDrugs` formula

```
search_score =
  0.40 * log1p(search_count_30d + order_count_30d) / log1p(maxPop)
+ 0.30 * completeness   // (image*20 + description*15 + price*10 + barcode*5 + ingredients*10) / 60
+ 0.20 * item-item CF cosine from search_logs   // cold start → CF mass redistributed to pop+completeness
+ 0.10 * quality        // verified + company + recency
```

Cold start (no logs / no CF): still ranks by completeness + popularity + quality.

## Env vars needed

### Always (functions)

- `APPWRITE_ENDPOINT` / `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY` (databases read/write)
- `APPWRITE_DATABASE_ID=medicine_support_hub`

### Vertex / MedGemma (OCR)

- `VERTEX_ACCESS_TOKEN` or `GOOGLE_CLOUD_ACCESS_TOKEN`
- `GOOGLE_CLOUD_PROJECT` / `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION` (default `us-central1`)
- `VERTEX_MEDGEMMA_MODEL` / `VERTEX_MODEL`
- Optional Document AI: `GOOGLE_DOCUMENT_AI_PROJECT_ID`, `GOOGLE_DOCUMENT_AI_LOCATION`, `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`

**Without Vertex:** function returns parseable stub JSON and logs `MedGemma not configured`.

### Appwrite Messaging + FCM transport

**Primary path = Appwrite Messaging** (not Firebase Admin in app/functions).

1. **Console:** Appwrite → Messaging → Providers → create **FCM** provider (paste Firebase service account JSON) and/or **APNs**.
2. **Android transport:** place real `android/app/google-services.json` from the **same** Firebase project (do **not** invent a project). See `android/app/google-services.json.EXAMPLE`.
3. Set `VITE_REMOTE_PUSH_ENABLED=true` after the file is present; optional `VITE_APPWRITE_MESSAGING_PROVIDER_ID=<providerId>`.
4. **Client:** Capacitor `PushNotifications.register()` → `account.createPushTarget(token)` (`apps/web/src/lib/appwrite-push.ts`); optional mirror to `fcm_tokens`.
5. **Function `sendPush`:** `Messaging.createPush(...)` with `users` / `targets` / `topics`. Needs API key scopes `messaging.write`, `users.read`.
6. **Web:** keep existing VAPID / PushManager in `pwa-experience.tsx`; prefer Appwrite Messaging web push when a web provider is configured in Console.
7. iOS: APNs provider in Console + Associated Domains; replace `TEAMID` in `apple-app-site-association`.

**Without Messaging provider / google-services.json:** local notifications still work; `tryRegisterNativePush` defers; `sendPush` fails with a clear Console hint (no Firebase Admin fallback).

## Frontend

- `/medicines` default sort `search_score DESC`; chips: Best match / Most Complete / Trending / A–Z  
- Completeness badge when `completeness_score > 0.8`  
- Search click → `search_logs` (best-effort) from encyclopedia + global search  
- Deep links: `/drug/:id`, `/rx/:id`, `/invite?ref=` + Capacitor `appUrlOpen`  
- Public: `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association`  
- Share helpers: `apps/web/src/lib/share-links.ts`  
- OCR UI: `/prescription-ocr` (disclaimer always shown)  
- OG meta: existing `RouteSeo` + product paths; drug shares use `/drug/:canonicalId`

## What works without secrets vs with secrets

| Feature | Without secrets | With secrets |
|---------|-----------------|--------------|
| Encyclopedia sort UI + cold-start scores after first `rankDrugs` run | Yes (scores 0 until cron/manual run) | Same |
| `search_logs` writes | Yes (public create; anonymous ok) | Same |
| OCR parse | Stub heuristic JSON + annotations for low confidence | MedGemma JSON via Vertex |
| Deep links / App Link files | Yes | Same (Play signing SHA may need App signing cert added) |
| Push token sync | Local notif only; register deferred | `createPushTarget` + optional `fcm_tokens` mirror |
| `sendPush` | Errors until Messaging provider exists | Appwrite `Messaging.createPush` to users/targets/topics |

## Manual test plan

1. Open `/medicines` — sort chips appear; default Best match.  
2. Click a medicine card — confirm a `search_logs` document (Console).  
3. Execute `rankDrugs` once — medicines gain `search_score` / `completeness_score`.  
4. `/prescription-ocr` — paste sample lines; see disclaimer twice; low confidence creates `annotations`.  
5. Native: open `https://medicinesupport.app/drug/<canonicalId>` — lands in-app after App Links verified.  
6. Enable notifications — with Messaging + google-services configured, device becomes an Appwrite push target (and optionally `fcm_tokens`).

## Next slice recommendations

1. **TrustScore barcode wiki** — shipped in 1.0.24 (`docs/UPGRADE_BARCODE_WIKI_TRUSTSCORE.md`)  
2. **Full RLAIF loop** — 3-user voting UI + `retrainModel` → Vertex fine-tune  
3. **sendPush live** — Console event trigger on orders + Messaging topics for campaigns  
4. **SSR/prerender OG** for product shares beyond SPA `RouteSeo`
