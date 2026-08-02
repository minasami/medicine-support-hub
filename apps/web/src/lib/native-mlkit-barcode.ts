/**
 * Native Google ML Kit barcode scanning (Capacitor shell only).
 * Speed optimizations:
 * - Restrict formats to retail medicine packs (EAN/UPC) by default
 * - Pre-warm Google Code Scanner module once per session
 * - Prefer scan() UI path; skip redundant work when module is ready
 */

import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Retail pack formats only — fewer detectors = faster ML Kit decode. */
export const MEDICINE_PACK_FORMATS = [
  "Ean13",
  "Ean8",
  "UpcA",
  "UpcE",
] as const;

let prewarmPromise: Promise<void> | null = null;
let moduleReady = false;

async function getScanner() {
  return import("@capacitor-mlkit/barcode-scanning");
}

/** Call on /scan mount to hide first-scan latency (module download). */
export async function prewarmMlKitBarcode(): Promise<void> {
  if (!isNativePlatform()) return;
  if (moduleReady) return;
  if (prewarmPromise) return prewarmPromise;

  prewarmPromise = (async () => {
    try {
      const { BarcodeScanner } = await getScanner();
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) return;
      try {
        const { available } =
          await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
        moduleReady = true;
      } catch {
        // iOS: no Google module API
        moduleReady = true;
      }
      // Request permission early so scan() is not blocked by dialog
      try {
        const perm = await BarcodeScanner.checkPermissions();
        if (perm.camera !== "granted") {
          await BarcodeScanner.requestPermissions();
        }
      } catch {
        /* optional on Play Code Scanner path */
      }
    } catch {
      prewarmPromise = null;
    }
  })();

  return prewarmPromise;
}

export async function isMlKitBarcodeSupported(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { BarcodeScanner } = await getScanner();
    const { supported } = await BarcodeScanner.isSupported();
    return !!supported;
  } catch {
    return false;
  }
}

export type ScanSpeedMode = "fast" | "all";

/**
 * Open native ML Kit scan UI and return the first raw barcode value, or null.
 * @param mode `fast` = EAN/UPC only (default); `all` adds Code128/39/QR
 */
export async function scanBarcodeWithMlKit(
  mode: ScanSpeedMode = "fast",
): Promise<string | null> {
  if (!isNativePlatform()) return null;

  const { BarcodeScanner, BarcodeFormat } = await getScanner();

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new Error("ML Kit barcode scanning is not supported on this device.");
  }

  // Ensure module warm (no-op if already done)
  await prewarmMlKitBarcode();

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
  }

  const formats =
    mode === "fast"
      ? [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
        ]
      : [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.QrCode,
        ];

  const { barcodes } = await BarcodeScanner.scan({
    formats,
  });

  const raw = barcodes?.[0]?.rawValue?.trim();
  return raw || null;
}
