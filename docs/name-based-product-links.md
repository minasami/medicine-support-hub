# How users open a product monograph

## Short answer

1. User sees a **card** (e.g. ARMOWAKE).
2. Clicks **Monograph →**.
3. Goes to **`/catalog/n~ARMOWAKE%2050%20MG%20…`** (name-keyed URL).
4. Detail page **looks up the live product by trade name**.
5. On a unique match, the browser URL becomes **`/catalog/{live_canonical_id}`** — that is the real monograph page (price, form, provenance, contribute, etc.).

If no live row matches the name, the user is sent to **`/medicines#q=…`** search results.

## Why not plain `/catalog/11539` from the card?

Static list IDs and Appwrite live IDs **collide**. Card ID 11539 was Armowake in one dataset and Dabur shampoo in live DB.

## Link helpers

| Helper | Result |
|--------|--------|
| `encyclopediaProductUrl({ nameEn })` | `/catalog/n~{name}` → resolves to monograph |
| `encyclopediaSearchUrl(q)` | `/medicines#q=…` directory search only |
| `forceCatalogId` + `live_db` | `/catalog/{id}` when you already trust the live id |

## User journeys

| Action | Outcome |
|--------|---------|
| Encyclopedia **Monograph →** | Name-keyed catalog → full monograph |
| Header search → pick suggestion | Same |
| Barcode match → Open monograph | Same |
| Share after open | Clean `/catalog/{live_id}` |
| Browse `/medicines` filters | List of cards, then monograph as above |
