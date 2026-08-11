import { Link } from "wouter";
import { Globe2, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { WorldMissPreview } from "@/components/world-miss-preview";

export function CatalogEmptyState({
  query,
  medCareOnly,
}: {
  query?: string;
  medCareOnly?: boolean;
}) {
  const { t } = useLanguage();
  const q = (query || "").trim();

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
        `We could not find “${q}” with the current filters. Below: open-web results (OpenFDA, RxNorm, PubChem, WHO) while local Egypt data stays primary when present.`,
        `لم نجد “${q}” بالفلاتر الحالية. بالأسفل: نتائج من الشبكة المفتوحة (OpenFDA و RxNorm و PubChem و WHO) مع بقاء البيانات المصرية أولوية عند التوفر.`,
      )
    : t(
        "Search by trade name, active ingredient, barcode, or company.",
        "ابحث باسم الدواء أو المادة الفعالة أو الباركود أو الشركة.",
      );

  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href={q ? `/world-search?q=${encodeURIComponent(q)}` : "/world-search"}>
          <Button className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Globe2 className="h-4 w-4" />
            {t("World search", "بحث عالمي")}
          </Button>
        </Link>
        <Link href="/scan">
          <Button variant="outline" className="rounded-xl gap-2">
            <ScanLine className="h-4 w-4" />
            {t("Scan barcode", "مسح باركود")}
          </Button>
        </Link>
        <Link href="/medicines">
          <Button variant="ghost" className="rounded-xl">
            {t("Clear filters", "مسح الفلاتر")}
          </Button>
        </Link>
      </div>

      {q.length >= 2 && (
        <div className="mx-auto mt-2 max-w-3xl">
          <WorldMissPreview query={q} />
        </div>
      )}
    </div>
  );
}
