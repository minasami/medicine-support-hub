import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for Medicine Support Hub.
 * Web build output: apps/web/dist/public (after `pnpm run build`).
 *
 * Package id must match Android applicationId and the Appwrite Android platform:
 *   com.medicinesupporthub.app
 *
 * Commands:
 *   pnpm mobile:sync
 *   pnpm mobile:add:android
 *   pnpm mobile:add:ios
 *   pnpm mobile:build:android
 */
const config: CapacitorConfig = {
  appId: "com.medicinesupporthub.app",
  appName: "Medicine Support Hub",
  webDir: "apps/web/dist/public",
  server: {
    // Production loads the same origin as the PWA when packaged;
    // for live reload during dev, uncomment androidScheme + url:
    // url: "https://medicinesupport.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0f766e",
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
