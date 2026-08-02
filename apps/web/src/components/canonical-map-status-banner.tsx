import { useEffect, useState } from "react";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import {
  getCanonicalIdMapError,
  getCanonicalIdMapStatus,
  loadCanonicalIdMap,
  resetCanonicalIdMapCache,
  subscribeCanonicalIdMapStatus,
  type CanonicalIdMapStatus,
} from "@/lib/canonical-id-map";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Non-blocking banner when the static→live ID map fails or is empty.
 * Product links still work via name-keyed URLs.
 */
export function CanonicalMapStatusBanner({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<CanonicalIdMapStatus>(
    getCanonicalIdMapStatus(),
  );
  const [error, setError] = useState<string | null>(getCanonicalIdMapError());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    return subscribeCanonicalIdMapStatus((s, err) => {
      setStatus(s);
      setError(err);
    });
  }, []);

  if (status === "ready" || status === "idle" || status === "loading") {
    return null;
  }

  const isError = status === "error";
  const title = isError
    ? t("Product ID map unavailable", "خريطة معرّفات المنتجات غير متاحة")
    : t("Product ID map not generated yet", "لم يتم إنشاء خريطة المعرّفات بعد");

  const body = isError
    ? t(
        "Links fall back to name search so you still reach the correct product. Details: ",
        "الروابط تستخدم البحث بالاسم للوصول للمنتج الصحيح. التفاصيل: ",
      ) + (error || "unknown")
    : t(
        "Run export-appwrite-medicines.mjs then map-static-to-live-ids.mjs and deploy the public map file.",
        "شغّل سكربت التصدير ثم map-static-to-live-ids.mjs وانشر ملف الخريطة.",
      );

  async function onRetry() {
    setRetrying(true);
    try {
      resetCanonicalIdMapCache();
      await loadCanonicalIdMap();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      role="status"
      className={`mb-4 flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
        isError
          ? "border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-slate-300/60 bg-slate-50 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        {isError ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {!compact && <p className="mt-0.5 text-xs opacity-90">{body}</p>}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1"
        disabled={retrying}
        onClick={() => void onRetry()}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
        {t("Retry", "إعادة المحاولة")}
      </Button>
    </div>
  );
}
