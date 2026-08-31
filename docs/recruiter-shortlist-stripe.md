# Recruiter shortlist unlock (Stripe)

Charge verified companies $29 to see applicant contacts for one vacancy.
Candidates browse and apply for free. Do not add a second job table.

Tracked in issue #129.

## Live Stripe catalog (Medicine Support Hub, livemode)

| Object | ID |
|---|---|
| Product | `prod_V9DQOhLN25i5er` |
| Price | `price_1U8uzMH7W83CdGB2VkyYFIBv` |
| Amount | $29.00 USD one-time |
| metadata.sku | `shortlist_unlock` |

Whop stays on the personal candidate catalog. Do not sell this SKU there.

## Probe (2026-08-31)

| URL | Result |
|---|---|
| `POST https://medicinesupport.app/api/billing?action=checkout` | **200 HTML** — Appwrite Sites serves the SPA. No function. |
| `POST https://medicine-support-hub.vercel.app/api/billing?action=checkout` | **401 JSON** `Sign in before managing payments.` — handler is alive. |

So production cannot host checkout on the same origin. Keep **one** billing handler on Vercel. The live site should call that origin after CORS (see `applyCors` in `api/_platform-server.js`).

Do not fold billing into `functions/edge-api` (health/catalog only).

## Reuse — do not duplicate

- `api/billing.js` — checkout, portal, webhook
- `api/_billing-server.js` — Stripe client + service role REST
- `platform_payment_requests` — purpose already includes `company_service`

Payment request row:

```text
purpose         = company_service
target_type     = job
target_id       = professional job post UUID
mode            = payment
amount_minor    = 2900
currency        = usd
stripe_price_id = null
metadata.sku    = shortlist_unlock
```

Frontend on medicinesupport.app:

```text
POST https://medicine-support-hub.vercel.app/api/billing?action=checkout
Authorization: Bearer <session>
{ "payment_request_id": "<uuid>" }
```

Set `APP_URL=https://medicinesupport.app` on the Vercel project so Stripe success/cancel return to production, not the Vercel host.

Gate applicant contacts when the viewer is a verified org member **and** a paid `company_service` request exists for that job id.
