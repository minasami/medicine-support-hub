import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
 * Status banner for the static→live product ID map.
 *
 * Public site: silent when the map is empty (name-keyed links still work).
 * Errors: short user-facing note only.
 * Ops: pass showOpsHints on /admin/mapping-accuracy.
 */
export function CanonicalMapStatusBanner({
  compact = false,
  showOpsHints = false,
  showWhenEmpty = false,
}: {
  compact?: boolean;
  /** Show developer instructions (export/map scripts). */
  showOpsHints?: boolean;
  /** Force banner when map file has zero entries (admin only). */
  showWhenEmpty?: boolean;
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

  // Public: never surface "empty map" — that is a normal pre-generation state.
  if (status === "ready" || status === "idle" || status === "loading") {
    return null;
  }
  if (status === "empty" && !showWhenEmpty && !showOpsHints) {
    return null;
  }

  const isError = status === "error";
  const isEmpty = status === "empty";

  const title = isError
    ? t("Product links using name search", "الروابط تستخدم البحث بالاسم")
    : t("Product ID map not generated yet", "لم يتم إنشاء خريطة المعرّفات بعد");

  const body = isError
    ? t(
        "You can still open products by name. If something looks wrong, try again.",
        "ما زال بإمكانك فتح المنتجات بالاسم. إذا ظهرت مشكلة، أعد المحاولة.",
      ) + (showOpsHints && error ? ` (${error})` : "")
    : showOpsHints
      ? t(
          "Run export-appwrite-medicines.mjs then map-static-to-live-ids.mjs and deploy apps/web/public/data/static-to-live-id-map.json.",
          "شغّل سكربت التصدير ثم map-static-to-live-ids.mjs وانشر ملف الخريطة العام.",
        )
      : t(
          "Product pages still work via name search.",
          "صفحات المنتجات تعمل عبر البحث بالاسم.",
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

  // Only show empty state when explicitly requested (admin tools)
  if (isEmpty && !showOpsHints && !showWhenEmpty) return null;

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
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {!compact && <p className="mt-0.5 text-xs opacity-90">{body}</p>}
        </div>
      </div>
      {(isError || showOpsHints) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1"
          disabled={retrying}
          onClick={() => void onRetry()}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`}
          />
          {t("Retry", "إعادة المحاولة")}
        </Button>
      )}
    </div>
  );
}
