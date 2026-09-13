# Prescription → Pharmacy Negotiation + RLAIF

End-to-end path for photographing a prescription, AI-assisted parse (MedGemma stub when GCP missing), patient review, pharmacy selection/negotiation (versioned quotes + chat), and pharmacist RLAIF annotation voting that feeds a weekly retrain export.

> **Disclaimer:** AI is assistive only. A licensed pharmacist must verify every item before fulfillment.

## Feature routes

| Route | Page | Role |
| --- | --- | --- |
| `/rx/upload` | Cap camera / gallery → Storage + `ocr-prescription-parser` | Patient |
| `/prescription/review/:id` | Edit AI items, add/remove, choose pharmacy | Patient |
| `/order/:order_id` | Tracking + Accept/Reject quote | Patient |
| `/order/chat/:order_id` | Realtime `order_messages` chat | Patient / Pharmacy |
| `/pharmacy/quote/:order_id` | Versioned quote editor | Pharmacy |
| `/pharmacist/annotations` | RLAIF queue + gamification | Verified pharmacist |

Deep links for Android App Links / custom scheme already map these paths (see Capacitor + `android` intent filters from prior deep-link work).

## Collections (IDs = names)

Provisioned by `scripts/provision-rx-rlaif-collections.mjs` into database `medicine_support_hub`:

| Collection ID | Purpose |
| --- | --- |
| `prescriptions` | Rx header (image_id, ai_parsed_json, confidence_score, status) |
| `prescription_items` | Line items (drug_name, dose, confidence, user_edited) |
| `orders` | Negotiation order (status, current_quote_id, quote_price) |
| `order_quotes` | Versioned quotes (`version`, lock after confirm) |
| `order_messages` | Chat + system messages (Realtime) |
| `pharmacies` | Active pharmacies with lat/lng for nearest sort |
| `annotations` | RLAIF queue (ai/ground_truth JSON, votes, assigned_pharmacists) |
| `user_profiles` | role, trust_score, is_verified_pharmacist, gamification |
| `user_trust` | TrustScore ledger (shared with barcode wiki) |

Bucket: `prescription-images` (`VITE_APPWRITE_RX_BUCKET` / `APPWRITE_RX_BUCKET`).

### Order status machine

`sent` → `pharmacy_reviewing` → `quoted` → `confirmed` → `preparing` → `ready` → `delivered`  
(or `cancelled` from patient Reject / pharmacy).

Quotes lock when status ∈ `confirmed|preparing|ready|delivered`.

## Functions

| Function ID | Trigger | Notes |
| --- | --- | --- |
| `ocr-prescription-parser` | HTTP (users) | `{ imageId, user_id }` → creates prescriptions/items; low confidence → annotations + assign 3 pharmacists trust>50 |
| `pharmacy-update-quote` | HTTP (users) | Zod input; versioned quote; Messaging notify patient |
| `submit-annotation` | HTTP (users) | 3-vote majority; trust +5 / −2 |
| `order-status-webhook` | `orders.*.update` event | Messaging notify user + pharmacy |
| `retrainModel` | cron `0 4 * * 0` | Export approved annotations; GCS/Vertex stub if no creds |
| `sendPush` | HTTP (users) | **Appwrite Messaging only** — no `FIREBASE_SERVICE_ACCOUNT` |

Deploy:

```bash
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_API_KEY=...
node scripts/provision-rx-rlaif-collections.mjs
node scripts/deploy-appwrite-functions.mjs --ensure \
  --only ocr-prescription-parser,pharmacy-update-quote,submit-annotation,order-status-webhook,retrainModel,sendPush
```

If deploy tooling cannot create functions, create them in Appwrite Console from `appwrite.json` entries and upload the `functions/<id>` folders. Event for `order-status-webhook`:

`databases.medicine_support_hub.collections.orders.documents.*.update`

## Environment variables

### App / Vite

| Var | Purpose |
| --- | --- |
| `VITE_APPWRITE_ENDPOINT` | Appwrite endpoint |
| `VITE_APPWRITE_PROJECT_ID` | Project id |
| `VITE_APPWRITE_DATABASE_ID` | `medicine_support_hub` |
| `VITE_APPWRITE_RX_BUCKET` | `prescription-images` |

### Functions (Console secrets)

| Var | Required? | Purpose |
| --- | --- | --- |
| `APPWRITE_ENDPOINT` / function API endpoint | yes | SDK |
| `APPWRITE_PROJECT_ID` | yes | SDK |
| `APPWRITE_API_KEY` | yes | DB + Messaging scopes |
| `APPWRITE_DATABASE_ID` | no | default `medicine_support_hub` |
| `APPWRITE_MESSAGING_PROVIDER_ID` | optional | FCM provider id in Console |
| `APPWRITE_MESSAGING_TOPIC` | optional | default topic |
| `VERTEX_ACCESS_TOKEN` / `GOOGLE_CLOUD_*` / `VERTEX_*` | optional | MedGemma parse + retrain upload |
| `GCS_BUCKET` | optional | weekly annotation JSONL upload |
| `GOOGLE_DOCUMENT_AI_*` | optional | server OCR when only imageId |
| `OCR_CONFIDENCE_THRESHOLD` | optional | default `0.8` |
| `RLAIF_ASSIGN_COUNT` / `RLAIF_TRUST_MIN` | optional | default 3 / 50 |
| `RLAIF_VOTES_NEEDED` | optional | default 3 |
| `RLAIF_TRUST_REWARD` / `RLAIF_TRUST_PENALTY` | optional | +5 / 2 |

**Do not set `FIREBASE_SERVICE_ACCOUNT` for push.** Configure FCM/APNs under Appwrite Console → Messaging → Providers; `sendPush` calls `Messaging.createPush`.

## Frontend wiring

- Components under `apps/web/src/components/rx/` use live Appwrite SDK (`databases`, `functions`, `storage`, `client.subscribe`) — no mocks.
- Upload uses Capacitor-friendly `<input capture="environment">`.
- `PharmacyPicker` uses Geolocation + haversine nearest sort.
- `OrderChat` subscribes to Realtime on `order_messages`.
- `AnnotationDashboard` shows trust/points/streak gamification and calls `submit-annotation`.
- Zod validation lives on function inputs (`pharmacy-update-quote`, `submit-annotation`, `order-status-webhook`, OCR payload).

## Test plan

1. **Provision** collections/bucket; confirm demo pharmacies exist.
2. **Patient upload:** sign in → `/rx/upload` → photo → lands on `/prescription/review/:id` with items (stub parse OK without Vertex).
3. **Review:** edit dose, add manual item, delete one → Choose pharmacy (nearest or search).
4. **Order:** `/order/:id` shows `sent`; open `/pharmacy/quote/:id` as pharmacy → set prices → Send quote → patient sees `quoted` + Accept/Reject.
5. **Chat:** `/order/chat/:id` realtime messages both sides.
6. **Accept:** status → `confirmed`; further quotes return 409 locked.
7. **RLAIF:** force low-confidence stub item → annotation appears → three verified pharmacist profiles vote via `/pharmacist/annotations` → status `approved`, trust ±.
8. **Retrain:** execute `retrainModel` → export count > 0; without GCS/Vertex returns `stub: true`.
9. **Push:** with Messaging provider configured, quote/status updates create push messages (skip if provider missing).

## Demo script (stubs OK)

1. Ensure at least one `user_profiles` row with `role=pharmacist`, `is_verified_pharmacist=true`, `trust_score=60`.
2. Patient uploads any Rx photo (no MedGemma needed).
3. Select **Demo Nile Pharmacy**.
4. Open quote desk, price lines, send v1 then v2.
5. Patient Accept → chat “ready in 20m”.
6. Open annotations queue, submit corrections until majority.

## Deferred

- Real Vertex MedGemma inference + fine-tune job without GCP secrets.
- Full Document AI OCR bytes path for `imageId`.
- Console-only Messaging provider credentials (FCM) — not stored in repo.

## Product share note

Catalog Product Share continues to use `@capacitor/share` then `navigator.share` with the live product URL (unchanged).
