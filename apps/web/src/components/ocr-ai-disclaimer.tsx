import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";

/** Required disclaimer on all OCR / MedGemma prescription parse results. */
export function OcrAiDisclaimer() {
  const { t } = useLanguage();
  return (
    <Alert className="border-amber-500/40 bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("AI assistive only", "مساعدة بالذكاء الاصطناعي فقط")}</AlertTitle>
      <AlertDescription>
        {t(
          "AI assistive only. Licensed pharmacist must verify.",
          "مساعدة بالذكاء الاصطناعي فقط. يجب أن يتحقق صيدلي مرخّص.",
        )}
      </AlertDescription>
    </Alert>
  );
}
