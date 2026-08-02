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

## iOS deployment target (required for ML Kit)

**Minimum iOS version: 15.5**

`@capacitor-mlkit/barcode-scanning` depends on Google ML Kit, which requires **iOS 15.5+**. Builds fail or pods refuse to install if the project still targets 13.x / 14.x (common Capacitor defaults).

### 1. Podfile (`ios/App/Podfile`)

Set the platform at the top of the file:

```ruby
platform :ios, '15.5'
```

Then reinstall pods:

```bash
cd ios/App && pod install && cd ../..
```

### 2. Xcode project

1. Open `ios/App/App.xcworkspace` (not `.xcodeproj`).
2. Select the **App** target → **General** → **Minimum Deployments** → **iOS 15.5** (or higher).
3. Optionally set the same under **Build Settings** → `IPHONEOS_DEPLOYMENT_TARGET` = `15.5` for all configs (Debug/Release).

### 3. Camera usage string (`ios/App/App/Info.plist`)

```xml
<key>NSCameraUsageDescription</key>
<string>Scan medicine pack barcodes to open encyclopedia entries.</string>
```

### 4. CocoaPods only

ML Kit **does not support Swift Package Manager**. Use CocoaPods for the iOS Capacitor project.

### Verify

```bash
pnpm mobile:sync
npx cap open ios
# Product → Destination → a device or simulator on iOS 15.5+
```

## Flow

1. User opens `/scan` in the native shell.
2. Tap **Scan with ML Kit** → `scanBarcodeWithMlKit()`.
3. Raw value → existing `lookupBarcode()` (Appwrite → static → Open Product Facts).

## Upgrade note

Plugin **8.x** requires Capacitor **≥ 8**. Stay on **6.x** until the monorepo upgrades `@capacitor/*` majors.
