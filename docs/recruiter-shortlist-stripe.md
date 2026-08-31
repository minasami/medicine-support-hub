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

## Reuse — do not duplicate

Existing files:

- `api/billing.js` — checkout, portal, webhook
- `api/_billing-server.js` — Stripe client + service role REST
- `platform_payment_requests` — purpose already includes `company_service`

Payment request row:

```text
purpose        = company_service
target_type    = job
target_id      = professional job post UUID
mode           = payment
amount_minor   = 2900
currency       = usd
stripe_price_id = null          # required by the ledger check for one-time payments
metadata.sku   = shortlist_unlock
```

Then `POST /api/billing?action=checkout` with `{ payment_request_id }`.
Webhook already marks the request `paid` on `checkout.session.completed`.

Gate applicant contacts when:

1. viewer is a verified member of the posting organization, and
2. a `platform_payment_requests` row exists with that `target_id`, `purpose=company_service`, `status=paid`.

## Deploy constraint

`vercel.json` still forwards `/api/*` to Vercel functions, so this path works on Vercel.
Production README points at Appwrite Sites (`medicinesupport.app`). Confirm `/api/billing` is reachable there before shipping a checkout button, or the button will 404.

If Appwrite Sites cannot run `api/billing.js`, reuse one Appwrite Function that calls the same Stripe session + webhook logic. Do not add a third payment handler.
