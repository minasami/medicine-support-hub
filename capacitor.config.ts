import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for Medicine Support Hub.
 * Web build output: apps/web/dist (after `pnpm run build`).
 *
 * Commands:
 *   pnpm mobile:sync
 *   pnpm mobile:add:android
 *   pnpm mobile:add:ios
 *   pnpm mobile:build:android
 */
const config: CapacitorConfig = {
  appId: "app.medicinesupport.hub",
  appName: "Medicine Support Hub",
  webDir: "apps/web/dist",
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
