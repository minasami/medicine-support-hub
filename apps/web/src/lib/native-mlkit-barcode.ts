/**
 * Native Google ML Kit barcode scanning (Capacitor shell only).
 * Uses @capacitor-mlkit/barcode-scanning — Capawesome wrapper around ML Kit.
 *
 * On Android, `scan()` prefers the Google Play Code Scanner UI when available
 * (no continuous camera permission for that path on many devices).
 * Web / PWA falls through to BarcodeDetector in barcode-scanner.tsx.
 */

import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function isMlKitBarcodeSupported(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { BarcodeScanner } = await import(
      "@capacitor-mlkit/barcode-scanning"
    );
    const { supported } = await BarcodeScanner.isSupported();
    return !!supported;
  } catch {
    return false;
  }
}

/**
 * Open native ML Kit scan UI and return the first raw barcode value, or null.
 */
export async function scanBarcodeWithMlKit(): Promise<string | null> {
  if (!isNativePlatform()) return null;

  const { BarcodeScanner, BarcodeFormat } = await import(
    "@capacitor-mlkit/barcode-scanning"
  );

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new Error("ML Kit barcode scanning is not supported on this device.");
  }

  // Google Code Scanner module (Android) — install if missing
  try {
    const { available } =
      await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  } catch {
    // iOS or older plugin path — ignore
  }

  // Camera permission for continuous / non–Play-Services path
  try {
    const perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== "granted") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted") {
        throw new Error("Camera permission is required to scan barcodes.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("permission")) throw e;
    // scan() on Android with Play Services may not need this
  }

  const { barcodes } = await BarcodeScanner.scan({
    formats: [
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.UpcA,
      BarcodeFormat.UpcE,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.QrCode,
    ],
  });

  const raw = barcodes?.[0]?.rawValue?.trim();
  return raw || null;
}
