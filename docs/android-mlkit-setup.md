# Android ML Kit setup investigation

## Current project state (investigated on `main`)

| Item | Finding |
|------|--------|
| `android/` shell | Present (Capacitor-generated) |
| `applicationId` | `com.medicinesupporthub.app` (`app/build.gradle`) |
| `minSdk` / `targetSdk` | **22** / **34** (`variables.gradle`) — OK for ML Kit |
| `AndroidManifest.xml` (before fix) | Only `INTERNET` — **missing camera + ML Kit meta-data** |
| `AndroidManifest.xml` (after fix) | `CAMERA`, `FLASHLIGHT`, optional camera features, `barcode_ui` meta-data |
| `capacitor.settings.gradle` | Only `:capacitor-android` until **`pnpm install` + `npx cap sync`** registers the ML Kit plugin |
| JS helper | `apps/web/src/lib/native-mlkit-barcode.ts` |
| Plugin | `@capacitor-mlkit/barcode-scanning` **^6** (Capacitor 6) |

## Why the previous manifest was insufficient

1. **No `CAMERA` permission** → runtime scan fails or permission prompt never maps correctly.
2. **No `com.google.mlkit.vision.DEPENDENCIES` / `barcode_ui`** → Google Play Services may not pre-fetch the barcode UI module used by `BarcodeScanner.scan()`.
3. **Plugin not synced** → until `cap sync` runs after installing the npm package, Gradle does not include `:capacitor-mlkit-barcode-scanning`.

## Required setup checklist

### 1. Install & sync

```bash
pnpm install
pnpm run build
npx cap sync android
```

Confirm `android/capacitor.settings.gradle` gains a line similar to:

```gradle
include ':capacitor-mlkit-barcode-scanning'
project(':capacitor-mlkit-barcode-scanning').projectDir = new File(
  '../node_modules/@capacitor-mlkit/barcode-scanning/android'
)
```

And `android/app/capacitor.build.gradle` lists the implementation dependency.

### 2. Manifest (already patched on `main`)

- `android.permission.CAMERA`
- `android.permission.FLASHLIGHT` (optional torch)
- `uses-feature` camera not required (tablets / install reach)
- Inside `<application>`:

```xml
<meta-data
  android:name="com.google.mlkit.vision.DEPENDENCIES"
  android:value="barcode_ui" />
```

### 3. Device / emulator requirements

| Path | Requirement |
|------|-------------|
| **`BarcodeScanner.scan()`** (Google Code Scanner UI) | Device with **Google Play Services**; module may download on first use |
| Continuous `startScan()` | Camera permission granted |
| Emulator | Use an image **with Play Store**; cold start may need network for model download |

Our app uses `scan()` first (see `native-mlkit-barcode.ts`), which on Android prefers the Play Code Scanner when available.

### 4. Runtime flow in the app

1. Open `/scan` in the Capacitor WebView.
2. Tap **Scan with ML Kit**.
3. Plugin checks support → optional install of Google barcode module → permissions → `scan()`.
4. Raw value → `lookupBarcode()` (Appwrite → static → Open Product Facts).

### 5. Build & run

```bash
npx cap open android
# Android Studio → Run on device/emulator with Google Play
```

Or:

```bash
cd android && ./gradlew assembleDebug
```

### 6. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| “ML Kit not supported” | Not a native build (opened in browser) or plugin not synced |
| Permission denied | User rejected camera; re-request or Settings |
| Scan UI never opens | No Play Services / module install failed — check logcat for `BarcodeScanner` |
| Typecheck / Vite fails resolving package | Ensure `@capacitor-mlkit/barcode-scanning` is in **root** and **`apps/web`** `package.json` |
| Gradle cannot find plugin project | Re-run `npx cap sync android` after `pnpm install` |

### 7. App id note

| Source | Id |
|--------|-----|
| `capacitor.config.ts` | `app.medicinesupport.hub` |
| Android `applicationId` | `com.medicinesupporthub.app` |

These can differ; Play Store listing uses **`applicationId`**. Align them before production release if you want a single id everywhere.

## Related docs

- [mlkit-barcode-scanning.md](./mlkit-barcode-scanning.md)
- [capacitor-shell.md](./capacitor-shell.md)
