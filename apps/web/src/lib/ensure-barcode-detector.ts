// @ts-nocheck
import { isNativePlatform } from "./capacitor";

let loading: Promise<boolean> | null = null;

function hasNativeBarcodeDetector(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "BarcodeDetector" in globalThis &&
    typeof (globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector ===
      "function"
  );
}

/**
 * Polyfill Shape (ZXing-wasm based).
 * Side-effect: defines `window.BarcodeDetector` / `globalThis.BarcodeDetector`
 * if missing.
 */
export async function ensureBarcodeDetectorLoaded(): Promise<boolean> {
  if (hasNativeBarcodeDetector()) return true;
  if (loading) return loading;

  loading = (async () => {
    try {
      // @ts-ignore
      await import("barcode-detector/polyfill");
      return hasNativeBarcodeDetector();
    } catch (err) {
      console.warn("[barcode] polyfill failed", err);
      return false;
    } finally {
      // Allow retry if first load failed
      if (!hasNativeBarcodeDetector()) loading = null;
    }
  })();

  return loading;
}
