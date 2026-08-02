# Native ML Kit barcode scanning

## Overview

| Environment | Engine |
|-------------|--------|
| **Capacitor Android / iOS** | [Google ML Kit](https://developers.google.com/ml-kit/vision/barcode-scanning) via [`@capacitor-mlkit/barcode-scanning`](https://www.npmjs.com/package/@capacitor-mlkit/barcode-scanning) **v6** (matches Capacitor 6) |
| **Web / PWA** | Browser `BarcodeDetector` + manual entry |

Code:

- `apps/web/src/lib/native-mlkit-barcode.ts` — native scan helper
- `apps/web/src/components/barcode-scanner.tsx` — prefers ML Kit when `Capacitor.isNativePlatform()`

On Android, `BarcodeScanner.scan()` uses the **Google Play Code Scanner** UI when the module is installed (fast, product barcodes including EAN-13 / UPC).

## Install & sync

```bash
pnpm install
pnpm run build
npx cap sync
```

## Android (`android/app/src/main/AndroidManifest.xml`)

Before `<application>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Inside `<application>`:

```xml
<meta-data
  android:name="com.google.mlkit.vision.DEPENDENCIES"
  android:value="barcode_ui" />
```

## iOS

- Deployment target **≥ 15.5** in Podfile
- `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Scan medicine pack barcodes to open encyclopedia entries.</string>
```

CocoaPods only (ML Kit does not support SPM).

## Flow

1. User opens `/scan` in the native shell.
2. Tap **Scan with ML Kit** → `scanBarcodeWithMlKit()`.
3. Raw value → existing `lookupBarcode()` (Appwrite → static → Open Product Facts).

## Upgrade note

Plugin **8.x** requires Capacitor **≥ 8**. Stay on **6.x** until the monorepo upgrades `@capacitor/*` majors.
