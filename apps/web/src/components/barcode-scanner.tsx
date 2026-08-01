import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
];

export function BarcodeScanner({ onDetected, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!window.BarcodeDetector) {
      setSupported(false);
      setError(
        "Camera barcode detection is not supported in this browser. Enter the number manually or use Chrome / Edge on Android.",
      );
      return;
    }
    setSupported(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const detector = new window.BarcodeDetector!({ formats: FORMATS });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
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
  }, [onDetected]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
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
            <Button
              type="button"
              onClick={() => void startCamera()}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Start camera
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

      {supported === false && (
        <p className="text-xs text-muted-foreground text-center">
          Tip: Chrome on Android supports live scan. iOS Safari may require
          manual entry until WebKit ships BarcodeDetector.
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
