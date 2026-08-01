# Capacitor shell (Android / iOS)

Medicine Support Hub ships primarily as a **web / PWA**. Capacitor wraps the same Vite build into native store binaries so camera, offline, and home-screen install behave like a native app.

## Already in the monorepo

| Item | Status |
|------|--------|
| `@capacitor/core` / `android` / `ios` / `cli` | In root `package.json` |
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

Requirements: **JDK 17+**, Android SDK, and for iOS: Xcode on macOS.

## Barcode scanning in the shell

1. In-app route **`/scan`** uses the WebView camera (`getUserMedia` + `BarcodeDetector` on Chromium WebView).
2. Optional later: `@capacitor-community/barcode-scanner` or ML Kit plugin for wider device support; still call `lookupBarcode()` from `barcode-lookup.ts`.
3. Camera permissions must be declared in `AndroidManifest.xml` / `Info.plist` after `cap add` (Capacitor templates usually include them when using camera plugins).

## Production tip

For store builds that always hit production data, set in `capacitor.config.ts`:

```ts
server: { url: "https://medicinesupport.app", androidScheme: "https" }
```

Or keep the bundled `webDir` so the app works offline with the last built static assets.

## Do not commit secrets

`scripts/build-android-bundle.mjs` may generate a local keystore for release signing. Treat passwords as **dev-only**; rotate before Play Store production and keep keystores out of git.
