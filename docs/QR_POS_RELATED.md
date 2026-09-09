# QR scan, POS lookup, similars and alternatives

## Scan

`/scan` and `/barcode` accept EAN/UPC **and** QR / Data Matrix.

QR payloads are parsed in `apps/web/src/lib/scan-payload.ts`:

- digits 8–14 → barcode lookup
- GS1 `01` + GTIN → barcode lookup
- `https://…/catalog/…` → open that monograph
- other text → name search

ML Kit default mode includes QR. Web `BarcodeDetector` formats include `qr_code` and `data_matrix`.

## Collections

| Button / field | Route | Filter |
|---|---|---|
| Active / generic name | `/similars/:inn` | `scientific_name` |
| Similars | `/similars/:inn` | same INN |
| Alternatives | `/alternatives/:class` | `drug_class` |
| Company name | `/company-products/:name` and `/companies/:slug` | `manufacturer` |

These are encyclopedia collections, not substitution or dispensing instructions.
