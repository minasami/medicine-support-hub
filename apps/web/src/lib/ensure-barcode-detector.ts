/**
 * Ensure window.BarcodeDetector exists on desktop browsers that lack it
 * (most laptop Chrome/Firefox/Safari builds).
 * Uses the `barcode-detector` package (ZXing-C++ WASM polyfill).
 */

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[];
    }) => BarcodeDetectorLike;
  }
}

let loading: Promise<boolean> | null = null;

export function hasNativeBarcodeDetector(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

/**
 * Returns true if a detector is available (native or polyfilled).
 */
export async function ensureBarcodeDetector(): Promise<boolean> {
  if (typeof window === "undefined") return false;
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

export async function detectBarcodeFromImageFile(
  file: File,
  formats: string[] = ["ean_13", "ean_8", "upc_a", "upc_e"],
): Promise<string | null> {
  const ok = await ensureBarcodeDetector();
  if (!ok || !window.BarcodeDetector) return null;

  const bitmap = await createImageBitmap(file);
  try {
    const detector = new window.BarcodeDetector({ formats });
    const codes = await detector.detect(bitmap);
    const value = codes[0]?.rawValue?.trim();
    return value || null;
  } finally {
    bitmap.close();
  }
}
