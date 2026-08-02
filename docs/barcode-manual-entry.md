# Manual barcode entry

On **laptops** and browsers without reliable camera barcode APIs, typing digits is the recommended path.

## Steps (user-facing)

1. Find the barcode on the medicine **box** or **blister** (black bars + numbers underneath).
2. Copy **digits only** — usually **8** (EAN-8) or **13** (EAN-13). No spaces or dashes.
3. Open [https://medicinesupport.app/scan](https://medicinesupport.app/scan).
4. Paste/type into **Type barcode digits…** and click **Look up**.
5. Open the monograph from a match card, or use **Search by name** if nothing matches yet.

## Alternatives

| Method | Best for |
|--------|----------|
| Manual digits | Laptop / desktop |
| Upload photo | Desk with a clear phone photo of the barcode |
| Start camera | Phone Chrome / native app (ML Kit) |

## Example

```text
6223001380146
```

## Notes

- Leading zeros matter; do not strip them.
- Internal pharmacy codes that are not EAN may not match the encyclopedia until enrichment fills barcodes.
- UI instructions are shown on `/scan` in English and Arabic.
