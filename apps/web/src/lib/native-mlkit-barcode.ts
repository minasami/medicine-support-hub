/**
 * Native Google ML Kit barcode scanning (Capacitor shell only).
 * Default formats cover retail EAN/UPC plus QR / Data Matrix used on packs.
 */

import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Pack identifiers: linear retail codes + 2D pharmacy codes. */
export const MEDICINE_PACK_FORMATS = [
  "Ean13",
  "Ean8",
  "UpcA",
  "UpcE",
  "QrCode",
  "DataMatrix",
] as const;

let prewarmPromise: Promise<void> | null = null;
let moduleReady = false;

async function getScanner() {
  // @ts-ignore
  return import("@capacitor-mlkit/barcode-scanning");
}

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
        moduleReady = true;
      }
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
 * Open native ML Kit scan UI and return the first raw value, or null.
 * `fast` includes EAN/UPC + QR + Data Matrix.
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
          BarcodeFormat.QrCode,
          BarcodeFormat.DataMatrix,
        ]
      : [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.QrCode,
          BarcodeFormat.DataMatrix,
        ];

  const { barcodes } = await BarcodeScanner.scan({
    formats,
  });

  const raw = barcodes?.[0]?.rawValue?.trim();
  return raw || null;
}
