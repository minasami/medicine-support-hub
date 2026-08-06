import { useLanguage } from "@/lib/i18n";
import { Shield, Lock, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 space-y-8">
      <div className="border-b pb-6 space-y-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
          <Shield className="h-4 w-4" />
          <span>{t("Legal & Compliance", "الشروط والأحكام والامتثال")}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("Privacy Policy & Data Governance", "سياسة الخصوصية وحوكمة البيانات")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Effective Date: August 2026 • Medicine Support Hub Platform",
            "تاريخ النفاذ: أغسطس ٢٠٢٦ • منصة دليل الخدمات والأدوية الطبية",
          )}
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              {t("Medical Information & Privacy Assurance", "ضمان الخصوصية والبيانات الطبية")}
            </h2>
            <p>
              {t(
                "Medicine Support Hub is dedicated to providing transparent pharmaceutical information while safeguarding user privacy. We do not sell personal medical queries, location data, or prescription records to third parties.",
                "تلتزم منصة دليل الخدمات والأدوية بتوفير معلومات دوائية شفافة مع التزام كامل بحماية خصوصية المستخدمين. لا نقوم ببيع أو مشاركة بيانات البحث الطبي أو الموقع أو معلومات السجلات مع أي أطراف خارجية.",
              )}
            </p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("1. Information We Collect", "١. البيانات التي نجمعها")}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>{t("Public Catalog Queries:", "استعلامات الدليل العام:")}</strong>{" "}
              {t(
                "Search queries, barcode scans, and category filter selections performed on the public encyclopedia.",
                "كلمات البحث، عمليات مسح الباركود، وتصفية الفئات الدوائية المجراة على الموسوعة العامة.",
              )}
            </li>
            <li>
              <strong>{t("Manufacturer Representatives:", "ممثلي الشركات المصنعة:")}</strong>{" "}
              {t(
                "Name, professional email address, company affiliation, and authorization credentials submitted during company account registration and claim verification.",
                "الاسم، البريد الإلكتروني المهني، التبعية للشركة، وإثباتات التفويض المقدمة عند تسجيل حسابات الشركات وتوثيق الملكية.",
              )}
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("2. How We Use Data", "٢. كيفية استخدام البيانات")}
          </h2>
          <p>
            {t(
              "Collected data is strictly used to display verified medicine information, calculate price accuracy metrics, facilitate manufacturer product updates, and ensure compliance with regulatory standards.",
              "تستخدم البيانات المجمعة حصرياً لعرض معلومات الأدوية الموثقة، حساب مؤشرات دقة الأسعار، تمكين الشركات من تحديث بيانات مستحضراتها، وضمان الامتثال للمعايير التنظيمية.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("3. Data Security & Storage", "٣. أمان البيانات والتخزين")}
          </h2>
          <p>
            {t(
              "All data transmissions are encrypted via TLS 1.3. User account data and claim records are stored securely within our Appwrite Cloud infrastructure with strict role-based access control.",
              "تتم جميع عمليات نقل البيانات مشفرة باستخدام TLS 1.3. يتم تخزين بيانات الحسابات ومستندات التوثيق بأمان عبر منصة Appwrite Cloud المشفرة مع تطبيق صلاحيات وصول صارمة.",
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("4. Medical Disclaimer", "٤. إخلاء المسؤولية الطبية")}
          </h2>
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 text-amber-900 dark:text-amber-200">
              {t(
                "The content provided on Medicine Support Hub is for informational and educational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider.",
                "المعلومات المتوفرة على دليل الخدمات والأدوية هي لأغراض إعلامية وتثقيفية فقط، ولا تعتبر بديلاً عن الاستشارة الطبية المتخصصة أو التشخيص أو العلاج. احرص دائماً على استشارة الطبيب أو الصيدلي المختص.",
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-bold text-foreground">
            {t("5. Contact & Privacy Inquiries", "٥. التواصل واستفسارات الخصوصية")}
          </h2>
          <p>
            {t(
              "For questions regarding data privacy or to request account data removal, please contact privacy@medicinesupport.app.",
              "لأي استفسارات تتعلق بخصوصية البيانات أو لطلب حذف بيانات الحساب، يرجى التواصل عبر privacy@medicinesupport.app.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
