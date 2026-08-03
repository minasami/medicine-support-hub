import { isNativePlatform } from "./capacitor";

/** Supported 1D + 2D formats matching native ML Kit defaults. */
export const MLKIT_FORMATS = [
  "EAN_13",
  "EAN_8",
  "CODE_128",
  "CODE_39",
  "QR_CODE",
  "DATA_MATRIX",
] as const;

let prewarmPromise: Promise<void> | null = null;
let moduleReady = false;

async function getScanner() {
  // @ts-ignore
  return import("@capacitor-mlkit/barcode-scanning");
}

/** Call on /scan mount to hide first-scan latency (module download). */
export async function prewarmMlKitBarcode(): Promise<void> {
  if (!isNativePlatform()) return;
  if (moduleReady) return;
  if (prewarmPromise) return prewarmPromise;

  prewarmPromise = (async () => {
    try {
      await getScanner();
      moduleReady = true;
    } catch (err) {
      console.warn("[mlkit-barcode] prewarm failed", err);
    } finally {
      prewarmPromise = null;
    }
  })();

  return prewarmPromise;
}

export type ScanResult = {
  rawValue: string;
  format: string;
} | null;

/** Single-shot camera scan using native Capacitor ML Kit dialog. */
export async function scanBarcodeNative(): Promise<ScanResult> {
  if (!isNativePlatform()) return null;

  try {
    const { BarcodeScanner } = await getScanner();

    // Check / request permission
    const perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== "granted") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted") {
        throw new Error("Camera permission denied");
      }
    }

    const { barcodes } = await BarcodeScanner.scan();
    if (!barcodes || barcodes.length === 0) return null;

    const hit = barcodes[0];
    return {
      rawValue: hit.rawValue || hit.displayValue || "",
      format: hit.format || "UNKNOWN",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("cancel")) {
      return null; // User tapped back / close
    }
    console.warn("[mlkit-barcode] scan error", err);
    throw err;
  }
}
