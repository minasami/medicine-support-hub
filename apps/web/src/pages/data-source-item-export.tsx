import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BookOpen, Database, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Coverage = {
  source_name: string;
  verified_records: number;
  records_with_price: number;
  records_with_barcode: number;
  latest_update: string | null;
};

export default function ItemExportDataSource() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [coverage, setCoverage] = useState<Coverage | null>(null);

  useEffect(() => {
    supabaseFetch<Coverage[]>("/rest/v1/medicine_enrichment_source_coverage?select=source_name,verified_records,records_with_price,records_with_barcode,latest_update&source_name=eq.Uploaded%20pharmacy%20item%20export%202026-05-01&limit=1")
      .then(rows => setCoverage(rows[0] ?? null))
      .catch(() => setCoverage(null));
  }, [supabaseFetch]);

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Database className="h-4 w-4" />{t("Data source", "مصدر بيانات")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("User-verified pharmacy item CSV · 2026-05-01", "ملف CSV لأصناف الصيدلية موثق من المستخدم · 2026-05-01")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("A user-verified pharmacy item CSV used to enrich the medicine encyclopedia with barcode, item-price, and product naming signals when a safe catalog match exists.", "ملف CSV لأصناف الصيدلية تم توثيقه من المستخدم ويُستخدم لإثراء موسوعة الأدوية بالباركود والسعر وبيانات التسمية عند وجود تطابق آمن مع الكتالوج.")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{t("User-verified CSV", "CSV موثق من المستخدم")}</Badge>
        <Badge variant="outline">{t("Price enrichment", "إثراء السعر")}</Badge>
        <Badge variant="outline">{t("Barcode enrichment", "إثراء الباركود")}</Badge>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-3">
      <Info icon={<BookOpen className="h-5 w-5" />} title={t("Original file", "الملف الأصلي")} value="ItemExport_20260501_172109.xlsx - Items.csv" />
      <Info icon={<Database className="h-5 w-5" />} title={t("Dataset type", "نوع البيانات")} value={t("User-verified pharmacy item catalog CSV", "ملف CSV موثق لكتالوج أصناف صيدلية")} />
      <Info icon={<ShieldCheck className="h-5 w-5" />} title={t("Use in encyclopedia", "الاستخدام في الموسوعة")} value={t("Exact matches publish directly; ambiguous rows enter review", "التطابقات الدقيقة تُنشر مباشرة والصفوف الغامضة تدخل المراجعة")} />
    </section>

    {coverage && <section className="mt-6 grid gap-4 md:grid-cols-3">
      <Metric label={t("Published verified records", "سجلات منشورة موثقة")} value={coverage.verified_records} />
      <Metric label={t("Records with price", "سجلات بها سعر")} value={coverage.records_with_price} />
      <Metric label={t("Records with barcode", "سجلات بها باركود")} value={coverage.records_with_barcode} />
    </section>}

    <Alert className="mt-6">
      <AlertDescription>{t("This user-verified CSV is used for operational reference signals such as item price and barcode. It is not used to guess active ingredients, indications, dosage instructions, or medical advice.", "يُستخدم ملف CSV الموثق من المستخدم كمؤشر مرجعي تشغيلي مثل السعر والباركود. ولا يُستخدم لتخمين المادة الفعالة أو دواعي الاستعمال أو تعليمات الجرعة أو أي نصيحة طبية.")}</AlertDescription>
    </Alert>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">{t("Matching rule", "قاعدة المطابقة")}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Because the CSV has already been verified by the user, exact one-to-one catalog matches are treated as publishable enrichment. Ambiguous or unmatched rows remain out of public display until an admin links them to the correct medicine record.", "لأن ملف CSV تم توثيقه مسبقًا من المستخدم، فإن التطابقات الدقيقة واحد لواحد مع الكتالوج تُعامل كإثراء قابل للنشر. أما الصفوف الغامضة أو غير المطابقة فلا تظهر للعامة حتى يربطها مسؤول بسجل الدواء الصحيح.")}</p>
      {coverage?.latest_update && <p className="mt-3 text-xs text-muted-foreground">{t("Latest published update", "آخر تحديث منشور")}: {new Date(coverage.latest_update).toLocaleString()}</p>}
    </section>
  </main>;
}

function Info({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent className="pt-0 text-lg font-semibold">{value}</CardContent></Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{Number(value || 0).toLocaleString()}</div></CardContent></Card>;
}
