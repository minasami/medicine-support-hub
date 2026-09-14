import { useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { isNativePlatform } from "@/lib/native-mlkit-barcode";

type Props = {
  title: string;
  hint: string;
  busy?: boolean;
  accept?: string;
  onFile: (file: File) => void;
};

export function DocumentCapture({ title, hint, busy, accept = "image/*", onFile }: Props) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] max-h-[min(62dvh,520px)] w-full max-w-md overflow-hidden rounded-2xl border bg-slate-950">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-200">
            <Camera className="h-10 w-10 text-teal-400" />
            <p className="text-sm font-medium">{title}</p>
            <p className="max-w-xs text-xs text-slate-400">{hint}</p>
            {isNativePlatform() ? (
              <p className="text-[11px] text-teal-300/90">
                {t("Camera uses the device scanner when available.", "الكاميرا تستخدم ماسح الجهاز عند التوفر.")}
              </p>
            ) : null}
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button asChild className="min-h-11 rounded-xl bg-teal-700" disabled={busy}>
          <label>
            <Camera className="mr-2 h-4 w-4" />
            {t("Take photo", "التقط صورة")}
            <input type="file" accept={accept} capture="environment" className="hidden" disabled={busy}
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl" disabled={busy}>
          <label>
            <ImageIcon className="mr-2 h-4 w-4" />
            {t("Choose file", "اختر ملفًا")}
            <input type="file" accept={accept} className="hidden" disabled={busy}
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </Button>
      </div>
    </div>
  );
}
