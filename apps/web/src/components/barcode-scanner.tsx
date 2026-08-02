import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Keyboard,
  Loader2,
  ScanLine,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  isMlKitBarcodeSupported,
  isNativePlatform,
  prewarmMlKitBarcode,
  scanBarcodeWithMlKit,
} from "@/lib/native-mlkit-barcode";

type Props = {
  onDetected: (code: string) => void;
  active?: boolean;
};

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

/** Medicine retail packs — narrower set improves web detector speed. */
const FAST_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export function BarcodeScanner({ onDetected, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const frameSkipRef = useRef(0);
  const lastCodeRef = useRef("");
  const detectingRef = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [nativeMlKit, setNativeMlKit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startNativeMlKit = useCallback(async () => {
    setError(null);
    setNativeBusy(true);
    try {
      const code = await scanBarcodeWithMlKit("fast");
      if (code) onDetected(code);
      else setError("No barcode detected. Try again or enter digits manually.");
    } catch (e: any) {
      setError(e?.message || "Native ML Kit scan failed.");
    } finally {
      setNativeBusy(false);
    }
  }, [onDetected]);

  const startCamera = useCallback(async () => {
    setError(null);

    if (isNativePlatform()) {
      const ok = await isMlKitBarcodeSupported();
      if (ok) {
        await startNativeMlKit();
        return;
      }
    }

    if (!window.BarcodeDetector) {
      setSupported(false);
      setError(
        "Camera barcode detection is not supported in this browser. Enter the number manually, use Chrome / Edge on Android, or the native app (ML Kit).",
      );
      return;
    }
    setSupported(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          // Lower resolution = faster CPU detect on mid-range phones
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const detector = new window.BarcodeDetector!({ formats: FAST_FORMATS });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        // Process every 3rd frame to cut CPU without hurting UX much
        frameSkipRef.current = (frameSkipRef.current + 1) % 3;
        if (frameSkipRef.current !== 0 || detectingRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        detectingRef.current = true;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            const value = String(codes[0].rawValue || "").trim();
            if (value && value !== lastCodeRef.current) {
              lastCodeRef.current = value;
              onDetected(value);
            }
          }
        } catch {
          /* frame skip */
        } finally {
          detectingRef.current = false;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access or type the barcode."
          : e?.message || "Could not open camera.",
      );
      setCameraOn(false);
    }
  }, [onDetected, startNativeMlKit]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
    void isMlKitBarcodeSupported().then(setNativeMlKit);
    // Hide first native scan latency
    void prewarmMlKitBarcode();
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!active) stopCamera();
  }, [active, stopCamera]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border bg-black aspect-[3/4] max-h-[60vh] mx-auto w-full max-w-md">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-white p-6 text-center">
            <ScanLine className="h-12 w-12 text-teal-400" />
            <p className="text-sm text-slate-200">
              Point the camera at an EAN-13 / UPC medicine barcode
            </p>
            {nativeMlKit && (
              <p className="text-xs text-teal-300/90 flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5" />
                Native ML Kit (fast EAN/UPC mode)
              </p>
            )}
            <Button
              type="button"
              onClick={() => void startCamera()}
              disabled={nativeBusy}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {nativeBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening scanner…
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  {nativeMlKit ? "Scan with ML Kit" : "Start camera"}
                </>
              )}
            </Button>
          </div>
        )}
        {cameraOn && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-[80%] max-w-xs rounded-xl border-2 border-teal-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute top-3 right-3"
              onClick={stopCamera}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {supported === false && !nativeMlKit && (
        <p className="text-xs text-muted-foreground text-center">
          Tip: Chrome on Android supports live scan. The Capacitor app uses
          Google ML Kit for reliable native scanning.
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = manual.trim();
          if (v) onDetected(v);
        }}
      >
        <div className="relative flex-1">
          <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or type barcode digits…"
            className="pl-9 rounded-xl"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="rounded-xl bg-teal-700 hover:bg-teal-800">
          Look up
        </Button>
      </form>
    </div>
  );
}

export function BarcodeLookupBusy() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Searching encyclopedia…
    </div>
  );
}
