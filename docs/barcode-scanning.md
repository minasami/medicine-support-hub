# Barcode scanning (mobile / PWA)

Medicine Support Hub does not currently ship a separate native iOS/Android binary. The **mobile experience is the responsive web app** at [https://medicinesupport.app](https://medicinesupport.app) (installable as PWA where supported).

## Feature

| Route | Purpose |
|-------|--------|
| **`/scan`** | Camera + manual barcode → encyclopedia lookup |

### Stack

- **BarcodeDetector** (Chrome / Edge Android, Chromium desktop) + `getUserMedia` rear camera
- Manual numeric entry fallback (iOS Safari and unsupported browsers)
- Lookup: Appwrite `medicines.barcode` first, then static dataset

### Files

- `apps/web/src/pages/barcode-scan.tsx`
- `apps/web/src/components/barcode-scanner.tsx`
- `apps/web/src/lib/barcode-lookup.ts`

### Requirements

- **HTTPS** (or localhost) for camera permission
- User grants camera access
- Barcodes filled on medicine rows (pharmacy-prices enrichment helps)

### Hit rate

Lookup quality depends on how many encyclopedia rows have a real `barcode`. After running:

```bash
node scripts/enrich-appwrite-from-pharmacy-prices.mjs --write
```

more retail EAN codes will resolve to monographs.

### Future native apps

If a Capacitor / React Native shell is added later, reuse the same `/scan` WebView or call platform barcode plugins and pass the string into `lookupBarcode()`.

## Barcode wiki (scan miss)

If lookup finds no match, `/scan` offers **Add to existing drug** or **Create new product**.
That writes a `drug_contributions` document (`status=pending`). `processContribution` auto-approves
when the contributor TrustScore is **> 50**. See [UPGRADE_BARCODE_WIKI_TRUSTSCORE.md](./UPGRADE_BARCODE_WIKI_TRUSTSCORE.md).
