# Prescription → pharmacy negotiation + RLAIF

Feature routes (not shown on `/medicines`):
- `/rx/upload`
- `/prescription/review/:id`
- `/order/:order_id`
- `/order/chat/:order_id`
- `/pharmacy/quote/:order_id`
- `/pharmacist/annotations`

Provision collections: `scripts/provision-rx-rlaif-collections.mjs` (see `docs/collections` pack).

Product Share on catalog detail uses `@capacitor/share` then `navigator.share` with the live product URL.
