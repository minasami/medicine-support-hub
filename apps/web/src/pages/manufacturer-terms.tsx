import { useLanguage } from "@/lib/i18n";
import { Building2, CheckCircle2, ShieldCheck, FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ManufacturerTermsPage() {
  const { t } = useLanguage();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-8">
      <div className="border-b pb-6 space-y-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
          <Building2 className="h-4 w-4" />
          <span>{t("Manufacturer Governance", "حوكمة الشركات المصنعة")}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("Pharmaceutical Manufacturer Contribution Terms", "شروط مشاركة وتحديث بيانات الشركات المصنعة")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Phase A Pilot Framework • Verified Catalog Data Governance",
            "إطار المرحلة التجريبية (Phase A) • حوكمة بيانات السجل الدوائي المعتمد",
          )}
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {t("Verified Brand Data Integrity Policy", "سياسة نزاهة ودقة بيانات العلامات التجارية الموثقة")}
            </h2>
            <p>
              {t(
                "These terms govern pharmaceutical manufacturers, brand holders, and contract manufacturers updating product monographs, official list prices, clinical notes, and brand images on Medicine Support Hub.",
                "تنظم هذه الشروط قيام الشركات المصنعة، أصحاب العلامات التجارية، وشركات التصنيع لدى الغير بتحديث النشرات الدوائية، الأسعار الرسمية، والملاحظات الطبية وصور المستحضرات على المنصة.",
              )}
            </p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("1. Authorization & Role Scope", "١. التفويض ونطاق الصلاحيات")}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>{t("Company Claim Authorization:", "توثيق ملكية الشركة:")}</strong>{" "}
              {t(
                "Product portfolio updates require an approved company profile claim verified by platform administrators.",
                "يتطلب تحديث كارت الأدوية وجود مطالبة توثيق معتمدة من قبل إدارة المنصة.",
              )}
            </li>
            <li>
              <strong>{t("Role Hierarchy Enforcement:", "التزام التسلسل الهرمي:")}</strong>{" "}
              {t(
                "CEOs and Product Managers hold editing and publishing rights. Line managers and representatives are scoped to assigned product lines.",
                "يتمتع الرئيس التنفيذي ومدراء المنتجات بصلاحيات التعديل والنشر. بينما يقتصر نطاق عمل مدراء الخطوط والممثلين على خطوط الإنتاج المحددة لهم.",
              )}
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("2. Official Price & Formulation Accuracy", "٢. دقة الأسعار والمواصفات الرسمية")}
          </h2>
          <p>
            {t(
              "Manufacturers warrant that published list prices (EGP) correspond strictly to Egyptian Drug Authority (EDA) official tariff pricing. Submitting inaccurate or speculative pricing is prohibited.",
              "تتعهد الشركات بأن الأسعار الرسمية (بالجنيه المصري) تطابق التعريفة الرسمية المعتمدة من هيئة الدواء المصرية (EDA). يحظر نشر أسعار غير دقيقة أو تخمينية.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("3. Content Lifecycle & Audit Logging", "٣. دورة حياة المحتوى وسجل التتبع")}
          </h2>
          <p>
            {t(
              "Every product update transitions through defined lifecycle states (Draft → Pending Review → Published). All changes are recorded with immutable provenance metadata detailing contributor email, timestamp, and audit payload.",
              "تمر كافة التحديثات بدورة حياة محددة (مسودة ← قيد المراجعة ← منشور). ويتم تسجيل جميع التعديلات في سجل تتبع غير قابل للتغيير يتضمن بريد المساهم، التوقيت الزمني، وبيانات التعديل.",
            )}
          </p>
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-bold text-foreground">
            {t("4. Pilot Support & Registration Inquiries", "٤. الدعم الفني والانضمام للمرحلة التجريبية")}
          </h2>
          <p>
            {t(
              "Pharmaceutical manufacturers wishing to participate in the Phase A Pilot program may submit documentation through /industry or email industry@medicinesupport.app.",
              "يمكن للشركات المصنعة الراغبة في الانضمام للمرحلة التجريبية (Phase A Pilot) تقديم مستندات التوثيق عبر /industry أو بالتواصل مع industry@medicinesupport.app.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
