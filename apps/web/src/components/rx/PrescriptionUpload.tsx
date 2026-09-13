import { useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { ExecutionMethod, ID } from "appwrite";
import { account, functions, storage } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { OcrAiDisclaimer } from "@/components/ocr-ai-disclaimer";

const BUCKET = import.meta.env.VITE_APPWRITE_RX_BUCKET || "prescription-images";

export default function PrescriptionUpload() {
  const { t } = useLanguage();
  const [, nav] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      let user;
      try {
        user = await account.get();
      } catch {
        nav(`/patient-auth?next=${encodeURIComponent("/rx/upload")}`);
        return;
      }
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
        throw new Error(data.error || t("Parse failed", "فشل التحليل"));
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
      <h1 className="text-2xl font-bold text-teal-800">
        {t("Upload prescription", "رفع الروشتة")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Photograph or choose a prescription image. AI is assistive only — a licensed pharmacist must verify every item before you confirm an order.",
          "صوّر الروشتة أو اختر صورة. الذكاء الاصطناعي مساعد فقط — يجب أن يراجع صيدلي مرخّص كل بند قبل تأكيد الطلب.",
        )}
      </p>
      <OcrAiDisclaimer />
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-8 text-center">
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-teal-700" /> : <Camera className="h-8 w-8 text-teal-700" />}
        <span className="text-sm font-medium">
          {busy ? t("AI is reading your prescription…", "الذكاء الاصطناعي يقرأ الروشتة…") : t("Take photo or choose file", "التقط صورة أو اختر ملفًا")}
        </span>
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </label>
      <Button type="button" variant="outline" className="w-full rounded-full" disabled={busy} asChild>
        <label>
          <Upload className="mr-2 h-4 w-4" />
          {t("Upload from gallery", "رفع من المعرض")}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        </label>
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        <a href="/prescription-ocr" className="underline">{t("Or paste prescription text instead", "أو الصق نص الروشتة بدلًا من ذلك")}</a>
      </p>
    </section>
  );
}
