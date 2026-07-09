import { BookOpen, Database, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";

export default function ItemExportDataSource() {
  const { t } = useLanguage();

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Database className="h-4 w-4" />{t("Data source", "مصدر بيانات")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Pharmacy item export · 2026-05-01", "تصدير أصناف الصيدلية · 2026-05-01")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("A reviewed pharmacy item export used to enrich the medicine encyclopedia with barcode, item-price, and product naming signals when a safe catalog match exists.", "تصدير أصناف صيدلية تمت مراجعته ويُستخدم لإثراء موسوعة الأدوية بالباركود والسعر وبيانات التسمية عند وجود تطابق آمن مع الكتالوج.")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{t("Reviewed dataset", "ملف بيانات مراجع")}</Badge>
        <Badge variant="outline">{t("Price enrichment", "إثراء السعر")}</Badge>
        <Badge variant="outline">{t("Barcode enrichment", "إثراء الباركود")}</Badge>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-3">
      <Info icon={<BookOpen className="h-5 w-5" />} title={t("Original file", "الملف الأصلي")} value="ItemExport_20260501_172109.xlsx - Items.csv" />
      <Info icon={<Database className="h-5 w-5" />} title={t("Dataset type", "نوع البيانات")} value={t("Pharmacy item catalog export", "تصدير كتالوج أصناف صيدلية")} />
      <Info icon={<ShieldCheck className="h-5 w-5" />} title={t("Use in encyclopedia", "الاستخدام في الموسوعة")} value={t("Only safe one-to-one matches are published", "لا تُنشر إلا التطابقات الآمنة واحد لواحد")} />
    </section>

    <Alert className="mt-6">
      <AlertDescription>{t("This source is used for operational reference signals such as item price and barcode. It is not used to guess active ingredients, indications, dosage instructions, or medical advice.", "يُستخدم هذا المصدر كمؤشر مرجعي تشغيلي مثل السعر والباركود. ولا يُستخدم لتخمين المادة الفعالة أو دواعي الاستعمال أو تعليمات الجرعة أو أي نصيحة طبية.")}</AlertDescription>
    </Alert>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">{t("Matching rule", "قاعدة المطابقة")}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Rows are matched to the master medicine catalog only when the normalized Arabic or English item name maps to one clear active medicine record. Ambiguous or unmatched rows are kept out of public display until reviewed.", "تُطابق الصفوف مع كتالوج الأدوية الرئيسي فقط عندما يشير الاسم العربي أو الإنجليزي بعد التطبيع إلى سجل دواء نشط واحد واضح. الصفوف الغامضة أو غير المطابقة لا تظهر للعامة حتى تتم مراجعتها.")}</p>
    </section>
  </main>;
}

function Info({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent className="pt-0 text-lg font-semibold">{value}</CardContent></Card>;
}
