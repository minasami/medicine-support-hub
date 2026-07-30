import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Clock3, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatProvenanceLine,
  formatProvenanceLineAr,
  listProvenanceForProduct,
  summarizeProvenance,
  type MedicineProvenanceEvent,
  type ProductProvenanceSummary,
} from "@/lib/medicine-provenance";
import { useLanguage } from "@/lib/i18n";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function MedicineProvenancePanel({
  canonicalId,
  hasCompanyVerifiedSource,
}: {
  canonicalId: number;
  hasCompanyVerifiedSource?: boolean;
}) {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState<ProductProvenanceSummary | null>(null);
  const [events, setEvents] = useState<MedicineProvenanceEvent[]>([]);

  useEffect(() => {
    setSummary(summarizeProvenance(canonicalId));
    setEvents(listProvenanceForProduct(canonicalId, 8));
  }, [canonicalId]);

  const line =
    summary &&
    (language === "ar"
      ? formatProvenanceLineAr(summary)
      : formatProvenanceLine(summary));

  const showVerified =
    hasCompanyVerifiedSource || summary?.has_company_verification;

  if (!line && !showVerified && events.length === 0) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="p-5 text-sm text-muted-foreground">
          {t(
            "No manufacturer verification events recorded for this product yet. Verified company representatives can update portfolio data from their account.",
            "لا توجد أحداث تحقق من الشركة المصنعة لهذا المنتج بعد. يمكن لممثلي الشركات الموثقين تحديث بيانات المحفظة من حساباتهم.",
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <BadgeCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          {t("Data provenance", "أصل البيانات")}
          {showVerified && (
            <Badge className="bg-emerald-600 text-white">
              <Building2 className="mr-1 h-3 w-3" />
              {t("Manufacturer verified", "موثق من الشركة")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {line && (
          <p className="flex items-start gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{line}</span>
          </p>
        )}
        {summary?.last_verified_by_company_slug && (
          <a
            href={`/directory/${encodeURIComponent(summary.last_verified_by_company_slug)}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("View company profile", "عرض ملف الشركة")} →
          </a>
        )}
        {events.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              {t("Recent verification events", "أحداث التحقق الأخيرة")}
            </div>
            <ul className="space-y-2">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border bg-background/80 px-3 py-2 text-xs"
                >
                  <div className="font-semibold">
                    {humanize(ev.event_type)}
                    {ev.company_name ? ` · ${ev.company_name}` : ""}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString()}
                    {ev.fields_changed?.length
                      ? ` · ${ev.fields_changed.slice(0, 5).join(", ")}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "Provenance records platform attribution only. It does not establish regulatory approval, clinical suitability, or batch quality.",
            "سجل الأصل يوضح الإسناد داخل المنصة فقط. ولا يثبت الموافقة التنظيمية أو الملاءمة السريرية أو جودة التشغيلة.",
          )}
        </p>
      </CardContent>
    </Card>
  );
}
