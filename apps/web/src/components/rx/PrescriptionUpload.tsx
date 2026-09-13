import { useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { ExecutionMethod, ID } from "appwrite";
import { account, functions, storage } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const BUCKET = import.meta.env.VITE_APPWRITE_RX_BUCKET || "prescription-images";

export default function PrescriptionUpload() {
  const [, nav] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const user = await account.get();
      const uploaded = await storage.createFile(BUCKET, ID.unique(), file);
      const exec = await functions.createExecution(
        "ocr-prescription-parser",
        JSON.stringify({ imageId: uploaded.$id, user_id: user.$id }),
        false,
        "/",
        ExecutionMethod.POST,
      );
      const data = JSON.parse(exec.responseBody || "{}");
      if (!data.success || !data.prescription_id) {
        throw new Error(data.error || "Parse failed");
      }
      nav(`/prescription/review/${data.prescription_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold text-teal-800">Upload prescription</h1>
      <p className="text-sm text-muted-foreground">
        AI assistive only. A licensed pharmacist must verify every item before you confirm an order.
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-8 text-center">
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-teal-700" /> : <Camera className="h-8 w-8 text-teal-700" />}
        <span className="text-sm font-medium">
          {busy ? "AI is reading your prescription..." : "Take photo or choose file"}
        </span>
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
