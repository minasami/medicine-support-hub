# Name-based product links (not `/catalog/:id`)

## Why

Static dataset `canonical_id` values and live Appwrite `canonical_id` values **are not the same space**. Linking cards with `/catalog/11539` made **ARMOWAKE** open **Dabur shampoo**.

## Policy

| Link builder | Behaviour |
|--------------|-----------|
| `encyclopediaProductUrl({ nameEn })` | → `/medicines#q=NAME` |
| `forceCatalogId: true` + `idSource: "live_db"` | → `/catalog/:id` only when intentionally deep-linking a verified live row |

Hash (`#q=`) survives redirects that strip `?q=`.

## Updated call sites

- `medicines-encyclopedia.tsx` (Monograph →)
- `global-medicine-search.tsx`
- `barcode-lookup.ts` → `medicineUrlForHit`
- Company portfolios / entity detail (already using helper)

## Still using `/catalog/:id`

- Direct URL entry by users/admins
- `MedicineDetail` route itself (`/catalog/:id` page)
- Auth `next=` return to a page already opened by ID

Those are fine when the user is already on a correct live document.
