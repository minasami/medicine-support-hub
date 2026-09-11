import { Link } from "wouter";
import { Globe2, ScanLine, Search, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { WorldMissPreview } from "@/components/world-miss-preview";

export function CatalogEmptyState({
  query,
  medCareOnly,
  offline,
}: {
  query?: string;
  medCareOnly?: boolean;
  /** Connection / network failure rather than a zero-result search */
  offline?: boolean;
}) {
  const { t } = useLanguage();
  const q = (query || "").trim();

  if (offline) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/50 px-4 py-10 text-center dark:border-amber-400/30 dark:bg-amber-950/30">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200">
          <WifiOff className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t("Catalog needs a connection", "الكتالوج يحتاج اتصالاً")}
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
          {t(
            "We could not reach the medicine catalog. Check Wi‑Fi or mobile data, then try again. You can still open Scan if the camera is available.",
            "تعذر الوصول إلى كتالوج الأدوية. تحقق من الواي فاي أو بيانات الجوال ثم أعد المحاولة. ما زال بإمكانك فتح المسح إذا كانت الكاميرا متاحة.",
          )}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <Button
            className="min-h-11 rounded-xl gap-2 bg-emerald-600 px-6 hover:bg-emerald-700"
            onClick={() => window.location.reload()}
          >
            {t("Try again", "إعادة المحاولة")}
          </Button>
          <Link
            href="/scan"
            className="text-sm font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
          >
            {t("Or scan a barcode", "أو امسح باركودًا")}
          </Link>
        </div>
      </div>
    );
  }

  const title = medCareOnly
    ? t("No Med-Care products in this view", "لا توجد منتجات ميد كير في هذا العرض")
    : q
      ? t(
          "No exact match in the Egyptian catalog",
          "لا توجد نتيجة مطابقة في الموسوعة المصرية",
        )
      : t("No medicines to show yet", "لا توجد أدوية للعرض بعد");

  const body = q
    ? t(
        `No match for “${q}” with the current filters. Try world search below, or clear filters and search again.`,
        `لا تطابق لـ “${q}” بالفلاتر الحالية. جرّب البحث العالمي بالأسفل، أو امسح الفلاتر وابحث مجددًا.`,
      )
    : t(
        "Search by trade name, active ingredient, barcode, or company.",
        "ابحث باسم الدواء أو المادة الفعالة أو الباركود أو الشركة.",
      );

  return (
    <div className="rounded-2xl border border-dashed border-slate-300/70 bg-muted/25 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <Link href={q ? `/world-search?q=${encodeURIComponent(q)}` : "/world-search"}>
          <Button className="min-h-11 rounded-xl gap-2 bg-emerald-600 px-6 hover:bg-emerald-700">
            <Globe2 className="h-4 w-4" />
            {t("World search", "بحث عالمي")}
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/scan"
            className="inline-flex min-h-11 items-center gap-1.5 font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
          >
            <ScanLine className="h-4 w-4" />
            {t("Scan barcode", "مسح باركود")}
          </Link>
          <Link
            href="/medicines"
            className="inline-flex min-h-11 items-center font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("Clear filters", "مسح الفلاتر")}
          </Link>
        </div>
      </div>

      {q.length >= 2 && (
        <div className="mx-auto mt-2 max-w-3xl">
          <WorldMissPreview query={q} />
        </div>
      )}
    </div>
  );
}
