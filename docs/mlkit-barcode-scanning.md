# Native ML Kit barcode scanning

## Overview

| Environment | Engine |
|-------------|--------|
| **Capacitor Android / iOS** | [Google ML Kit](https://developers.google.com/ml-kit/vision/barcode-scanning) via [`@capacitor-mlkit/barcode-scanning`](https://www.npmjs.com/package/@capacitor-mlkit/barcode-scanning) **v6** |
| **Web / PWA** | Browser `BarcodeDetector` (throttled) + manual entry |

## Speed optimizations (current code)

| Technique | Effect |
|-----------|--------|
| **Format filter** | Default `fast` mode: **EAN-13 / EAN-8 / UPC-A / UPC-E only** (medicine retail packs) |
| **`prewarmMlKitBarcode()`** | On `/scan` mount: install Google Code Scanner module + early permission |
| **`scan()` UI** | Play Services code scanner when available (fast path) |
| **Web frame skip** | Detect every **3rd** animation frame; cap capture ~720p |

Use `scanBarcodeWithMlKit("all")` only when you need Code128 / QR.

## Install & sync

```bash
pnpm install
pnpm run build
npx cap sync
```

## Android

See [android-mlkit-setup.md](./android-mlkit-setup.md) for CAMERA + `barcode_ui` meta-data.

## iOS deployment target

**Minimum iOS 15.5** — see deployment target section in previous docs.

```ruby
# ios/App/Podfile
platform :ios, '15.5'
```

## Flow

1. `/scan` → prewarm ML Kit
2. Scan → `lookupBarcode()`
3. Optional **Gemma 4 brief** if `VITE_GOOGLE_AI_API_KEY` is set
