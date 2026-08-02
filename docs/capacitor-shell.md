# Capacitor shell (Android / iOS)

Medicine Support Hub ships primarily as a **web / PWA**. Capacitor wraps the same Vite build into native store binaries so camera, offline, and home-screen install behave like a native app.

## Already in the monorepo

| Item | Status |
|------|--------|
| `@capacitor/core` / `android` / `ios` / `cli` | In root `package.json` |
| `@capacitor-mlkit/barcode-scanning` ^6 | Native ML Kit barcodes |
| `pnpm mobile:sync` | `build` + `cap sync` |
| `pnpm mobile:add:android` / `ios` | Platform add |
| `pnpm mobile:build:android` | AAB via `scripts/build-android-bundle.mjs` |
| `capacitor.config.ts` | App id `app.medicinesupport.hub`, `webDir: apps/web/dist` |

## First-time local setup

```bash
pnpm install
pnpm run build
npx cap add android   # once
# npx cap add ios     # macOS only
pnpm mobile:sync
npx cap open android  # Android Studio
```

Requirements: **JDK 17+**, Android SDK, and for iOS: **Xcode on macOS**.

### iOS deployment target note

Native ML Kit barcode scanning requires **iOS 15.5 or newer**.

After `npx cap add ios`:

1. In `ios/App/Podfile`: `platform :ios, '15.5'`
2. In Xcode (App target → Minimum Deployments): **15.5**
3. Add `NSCameraUsageDescription` to `Info.plist`

Full steps: **[mlkit-barcode-scanning.md](./mlkit-barcode-scanning.md#ios-deployment-target-required-for-ml-kit)**.

## Barcode scanning in the shell

1. Route **`/scan`** prefers **Google ML Kit** when running inside Capacitor (`native-mlkit-barcode.ts`).
2. WebView fallback: `BarcodeDetector` + manual entry.
3. See **[mlkit-barcode-scanning.md](./mlkit-barcode-scanning.md)** for Android/iOS permissions.

## Production tip

For store builds that always hit production data, set in `capacitor.config.ts`:

```ts
server: { url: "https://medicinesupport.app", androidScheme: "https" }
```

Or keep the bundled `webDir` so the app works offline with the last built static assets.

## Do not commit secrets

`scripts/build-android-bundle.mjs` may generate a local keystore for release signing. Treat passwords as **dev-only**; rotate before Play Store production and keep keystores out of git.
