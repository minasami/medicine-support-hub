import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Handshake,
  Pill,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import SupportRequestsPage from "@/pages/support-requests";

type SectionProps = {
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  next: string;
  backLabel: string;
  capabilitiesLabel: string;
  buildNoteLabel: string;
  scaffoldNote: string;
};

function NgoSectionPage({
  title,
  badge,
  description,
  icon: Icon,
  items,
  next,
  backLabel,
  capabilitiesLabel,
  buildNoteLabel,
  scaffoldNote,
}: SectionProps) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {badge}
          </Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Icon className="h-8 w-8 text-emerald-700" /> {title}
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/ngo/dashboard">{backLabel}</Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{capabilitiesLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  {index + 1}
                </div>
                <div className="text-sm font-medium">{item}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{buildNoteLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{next}</p>
            <p>{scaffoldNote}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function useSectionChrome() {
  const { t } = useLanguage();
  return {
    t,
    backLabel: t("Back to NGO dashboard", "العودة إلى لوحة الجمعية"),
    capabilitiesLabel: t("Phase 1 capabilities", "قدرات المرحلة الأولى"),
    buildNoteLabel: t("Build note", "ملاحظة التطوير"),
    scaffoldNote: t(
      "These pages are scaffolds. The next engineering step is connecting them to NGO-specific Supabase tables with workspace-based access control.",
      "هذه الصفحات هياكل أولية. الخطوة الهندسية التالية هي ربطها بجداول الجمعية في Supabase مع تحكم بالوصول حسب مساحة العمل.",
    ),
  };
}

export function NgoBeneficiariesPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Beneficiary Registry", "سجل المستفيدين")}
      badge={t("NGO Beneficiaries", "مستفيدو الجمعية")}
      icon={Users}
      description={t(
        "Manage beneficiary profiles, eligibility data, chronic conditions, prescriptions, and support history.",
        "إدارة ملفات المستفيدين وبيانات الأهلية والحالات المزمنة والوصفات وسجل الدعم.",
      )}
      items={[
        t("Create beneficiary profiles", "إنشاء ملفات المستفيدين"),
        t("Record household and eligibility data", "تسجيل بيانات الأسرة والأهلية"),
        t("Track chronic conditions", "تتبع الحالات المزمنة"),
        t("Attach prescription documents", "إرفاق مستندات الوصفة"),
        t("View medicine support history", "عرض سجل دعم الأدوية"),
      ]}
      next={t(
        "Start by building CRUD for beneficiaries, because every request, budget allocation, and impact report depends on a clean beneficiary record.",
        "ابدأ ببناء عمليات إنشاء/قراءة/تحديث/حذف للمستفيدين، لأن كل طلب وتخصيص ميزانية وتقرير أثر يعتمد على سجل مستفيد نظيف.",
      )}
    />
  );
}

export function NgoRequestsPage() {
  return <SupportRequestsPage />;
}

export function NgoBudgetsPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Budgets", "الميزانيات")}
      badge={t("NGO Finance", "مالية الجمعية")}
      icon={Wallet}
      description={t(
        "Assign program budgets, allocate support by beneficiary or disease area, and track committed monthly costs.",
        "تعيين ميزانيات البرامج وتخصيص الدعم حسب المستفيد أو مجال المرض وتتبع التكاليف الشهرية الملتزمة.",
      )}
      items={[
        t("Create project budget", "إنشاء ميزانية المشروع"),
        t("Allocate budget by beneficiary or disease", "تخصيص الميزانية حسب المستفيد أو المرض"),
        t("Track committed monthly medicine cost", "تتبع تكلفة الدواء الشهرية الملتزمة"),
        t("Show remaining balance", "عرض الرصيد المتبقي"),
        t(
          "Warn when requests exceed available budget",
          "التنبيه عند تجاوز الطلبات للميزانية المتاحة",
        ),
      ]}
      next={t(
        "Budget logic should be simple and auditable before adding advanced donor restrictions or complex forecasting.",
        "يجب أن تكون منطق الميزانية بسيطًا وقابلًا للتدقيق قبل إضافة قيود المانحين المتقدمة أو التنبؤ المعقد.",
      )}
    />
  );
}

export function NgoAlternativesPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Medicine Alternatives", "بدائل الأدوية")}
      badge={t("NGO Clinical Cost Review", "مراجعة التكلفة السريرية للجمعية")}
      icon={Pill}
      description={t(
        "Compare cheaper alternatives using active ingredient, strength, dosage form, availability, and reviewer approval.",
        "قارن البدائل الأرخص باستخدام المادة الفعالة والتركيز والشكل الصيدلاني والتوفر وموافقة المراجع.",
      )}
      items={[
        t("Match by active ingredient", "المطابقة حسب المادة الفعالة"),
        t("Check strength and dosage form", "التحقق من التركيز والشكل"),
        t("Compare unit cost", "مقارنة تكلفة الوحدة"),
        t("Show supplier availability", "عرض توفر المورد"),
        t("Require medical reviewer confirmation", "اشتراط تأكيد المراجع الطبي"),
      ]}
      next={t(
        "The system should suggest alternatives, not automatically substitute medicines.",
        "يجب أن يقترح النظام البدائل، لا أن يستبدل الأدوية تلقائيًا.",
      )}
    />
  );
}

export function NgoProcurementPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Procurement", "المشتريات")}
      badge={t("NGO Supply Chain", "سلسلة توريد الجمعية")}
      icon={ShoppingCart}
      description={t(
        "Manage suppliers, tender requests, discounts, pharmacy partnerships, purchase orders, and delivery tracking.",
        "إدارة الموردين وطلبات المناقصات والخصومات وشراكات الصيدليات وأوامر الشراء وتتبع التسليم.",
      )}
      items={[
        t("Register suppliers and pharmacy partners", "تسجيل الموردين وشركاء الصيدليات"),
        t("Create tender requests", "إنشاء طلبات المناقصات"),
        t("Compare supplier offers", "مقارنة عروض الموردين"),
        t("Track purchase orders", "تتبع أوامر الشراء"),
        t("Monitor deliveries and fulfillment", "مراقبة التسليم والتنفيذ"),
      ]}
      next={t(
        "Procurement should come after budget review, because approved demand defines what needs to be sourced.",
        "يجب أن تأتي المشتريات بعد مراجعة الميزانية، لأن الطلب المعتمد يحدد ما يلزم تأمينه.",
      )}
    />
  );
}

export function NgoPartnersPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Partners", "الشركاء")}
      badge={t("NGO Partnerships", "شراكات الجمعية")}
      icon={Handshake}
      description={t(
        "Manage local pharmacies, pharmaceutical companies, suppliers, donors, and support partners.",
        "إدارة الصيدليات المحلية وشركات الأدوية والموردين والمانحين وشركاء الدعم.",
      )}
      items={[
        t("Register partner organizations", "تسجيل جهات الشراكة"),
        t("Record discount or donation terms", "تسجيل شروط الخصم أو التبرع"),
        t("Track assigned fulfillment tasks", "تتبع مهام التنفيذ المسندة"),
        t("Monitor partner performance", "مراقبة أداء الشركاء"),
        t("Prepare partnership reports", "إعداد تقارير الشراكة"),
      ]}
      next={t(
        "Keep partner access limited to assigned tenders or fulfillment tasks when partner portals are added.",
        "أبقِ وصول الشركاء محدودًا بالمناقصات أو مهام التنفيذ المسندة عند إضافة بوابات الشركاء.",
      )}
    />
  );
}

export function NgoImpactPage() {
  const chrome = useSectionChrome();
  const { t } = chrome;
  return (
    <NgoSectionPage
      {...chrome}
      title={t("Impact Reporting", "تقارير الأثر")}
      badge={t("NGO Public Health", "الصحة العامة للجمعية")}
      icon={BarChart3}
      description={t(
        "Review treatment months funded, disease categories, budget use, and transparent health-impact assumptions.",
        "مراجعة أشهر العلاج الممولة وفئات الأمراض واستخدام الميزانية وافتراضات الأثر الصحي الشفافة.",
      )}
      items={[
        t("Beneficiaries supported by disease", "المستفيدون حسب المرض"),
        t("Treatment months funded", "أشهر العلاج الممولة"),
        t("Cost per beneficiary", "التكلفة لكل مستفيد"),
        t("Support continuity indicators", "مؤشرات استمرارية الدعم"),
        t("Donor-facing reports with assumptions", "تقارير للمانحين مع الافتراضات"),
      ]}
      next={t(
        "Impact reporting should be transparent and conservative. Every estimate should show its assumptions.",
        "يجب أن تكون تقارير الأثر شفافة ومحافظة. كل تقدير يجب أن يُظهر افتراضاته.",
      )}
    />
  );
}
