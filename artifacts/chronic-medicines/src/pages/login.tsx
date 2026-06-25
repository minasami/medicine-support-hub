import { useLocation } from "wouter";
import { useRole, type UserRole, ROLE_LABELS } from "@/lib/role";
import { useLanguage } from "@/lib/i18n";
import {
  UserCircle,
  Stethoscope,
  FlaskConical,
  Package,
  Truck,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";

const ROLES: Array<{
  role: string;
  icon: React.ElementType;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  permissions: string[];
  permissionsAr: string[];
  accent: string;
  border: string;
  iconBg: string;
}> = [
  {
    role: "REVIEWER",
    icon: UserCircle,
    title: "Clinical Reviewer",
    titleAr: "المراجع السريري",
    description: "Medical triage queue for benefit approval and audit",
    descriptionAr: "قائمة الفرز الطبي للموافقة على المزايا والتدقيق",
    permissions: [
      "Initiate prescription dispensation forms",
      "Mark requests as critical-care urgent",
      "Track live pipeline status of requests",
    ],
    permissionsAr: [
      "بدء نماذج صرف الوصفات",
      "تحديد الطلبات كحالات رعاية حرجة",
      "تتبع حالة الطلبات في الوقت الفعلي",
    ],
    accent: "from-blue-50 to-blue-100/50",
    border: "border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-600",
  },
  {
    role: "REVIEWER",
    icon: Stethoscope,
    title: "Clinical Medical Reviewer",
    titleAr: "المراجع الطبي السريري",
    description: "Medical triage queue for benefit approval and audit",
    descriptionAr: "قائمة الفرز الطبي للموافقة على المزايا والتدقيق",
    permissions: [
      "Access medical triage queue",
      "Evaluate diagnostic reasoning",
      "Approve or reject with formal medical logs",
    ],
    permissionsAr: [
      "الوصول إلى قائمة الفرز الطبي",
      "تقييم المبررات التشخيصية",
      "الموافقة أو الرفض مع سجلات طبية رسمية",
    ],
    accent: "from-violet-50 to-violet-100/50",
    border: "border-violet-200 hover:border-violet-400",
    iconBg: "bg-violet-600",
  },
  {
    role: "PHARMACY_ADMIN",
    icon: FlaskConical,
    title: "Pharmacy Administrator",
    titleAr: "مدير الصيدلية",
    description: "Logistics-centric dispensation and stock control station",
    descriptionAr: "محطة إدارة الصرف والمخزون المتمحورة حول اللوجستيات",
    permissions: [
      "Receive clinically approved medication files",
      "Record shelf, bin, and batch serial identifiers",
      "Dispatch physical medications to dispensed",
    ],
    permissionsAr: [
      "استلام ملفات الأدوية المعتمدة سريرياً",
      "تسجيل معرفات الرف والصندوق والدفعة",
      "إرسال الأدوية الفعلية إلى حالة الصرف",
    ],
    accent: "from-amber-50 to-amber-100/50",
    border: "border-amber-200 hover:border-amber-400",
    iconBg: "bg-amber-600",
  },
  {
    role: "PREP_MANAGER",
    icon: Package,
    title: "Prep Operations Manager",
    titleAr: "مدير عمليات التحضير",
    description: "Pharmaceutical safety, batch insulation, and packaging compliance",
    descriptionAr: "سلامة الأدوية وعزل الدفعات والامتثال للتعبئة",
    permissions: [
      "Monitor dispensed medications for packaging",
      "Seal safety bags with QR tags",
      "Certify package readiness for retrieval",
    ],
    permissionsAr: [
      "مراقبة الأدوية الموزعة للتعبئة",
      "إغلاق الأكياس الآمنة بعلامات QR",
      "اعتماد جاهزية الطرود للاسترداد",
    ],
    accent: "from-emerald-50 to-emerald-100/50",
    border: "border-emerald-200 hover:border-emerald-400",
    iconBg: "bg-emerald-600",
  },
  {
    role: "COMPANY_COORDINATOR",
    icon: Truck,
    title: "Delivery Coordinator",
    titleAr: "منسق التوصيل",
    description: "Ground transport, physical handoff, and final feedback loops",
    descriptionAr: "النقل البري والتسليم الفعلي وحلقات التغذية الراجعة النهائية",
    permissions: [
      "Acknowledge and retrieve bundles from hubs",
      "Manage on-premises delivery routing",
      "Log user signatures and mark requests completed",
    ],
    permissionsAr: [
      "الإقرار باستلام الطرود من المراكز",
      "إدارة توجيه التوصيل داخل المكتب",
      "تسجيل التواقيع وتحديد حالة الطلبات كمكتملة",
    ],
    accent: "from-sky-50 to-sky-100/50",
    border: "border-sky-200 hover:border-sky-400",
    iconBg: "bg-sky-600",
  },
  {
    role: "DATA_ENTRY",
    icon: ClipboardList,
    title: "Data Entry Operator",
    titleAr: "موظف إدخال البيانات",
    description: "Record management and bulk offline prescription processing",
    descriptionAr: "إدارة السجلات ومعالجة الوصفات الورقية بشكل مجمع",
    permissions: [
      "Bulk upload via CSV templates",
      "Manage historical audit records",
      "Support digital recording of offline prescriptions",
    ],
    permissionsAr: [
      "التحميل المجمع عبر قوالب CSV",
      "إدارة سجلات التدقيق التاريخية",
      "دعم التسجيل الرقمي للوصفات الورقية",
    ],
    accent: "from-slate-50 to-slate-100/50",
    border: "border-slate-200 hover:border-slate-400",
    iconBg: "bg-slate-600",
  },
  {
    role: "PLATFORM_ADMIN",
    icon: LayoutDashboard,
    title: "Platform Administrator",
    titleAr: "مدير المنصة",
    description: "High-level telemetry, system infrastructure, and organization audits",
    descriptionAr: "القياس عن بعد عالي المستوى وبنية النظام والتدقيق التنظيمي",
    permissions: [
      "Monitor active database sync relays",
      "View aggregate platform activity graphs",
      "Export CSV files for executive reports",
    ],
    permissionsAr: [
      "مراقبة ترحيل مزامنة قاعدة البيانات",
      "عرض مخططات نشاط المنصة الإجمالية",
      "تصدير ملفات CSV للتقارير التنفيذية",
    ],
    accent: "from-rose-50 to-rose-100/50",
    border: "border-rose-200 hover:border-rose-400",
    iconBg: "bg-rose-600",
  },
];

export default function Login() {
  const { setRole } = useRole();
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();

  function handleSelectRole(role: string) {
    setRole(role as UserRole);
    const homeMap: Record<string, string> = {
      EMPLOYEE: "/employee",
      REVIEWER: "/reviewer",
      PHARMACY_ADMIN: "/pharmacy",
      PREP_MANAGER: "/prep",
      COMPANY_COORDINATOR: "/coordinator",
      DATA_ENTRY: "/data-entry",
      PLATFORM_ADMIN: "/admin",
    };
    navigate(homeMap[role] ?? "/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl">
              C
            </div>
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {t("ChronicMed", "أدوية الأمراض المزمنة")}
            </span>
          </div>
          <div className="inline-block bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-4">
            {t("Simulate Quick Login", "محاكاة تسجيل الدخول السريع")}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {t("Select Your Role Portal", "اختر بوابة دورك")}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              "Each role has a dedicated workflow interface tailored to its responsibilities in the clinical care delivery cycle.",
              "كل دور له واجهة سير عمل مخصصة تتناسب مع مسؤولياته في دورة تقديم الرعاية السريرية."
            )}
          </p>
        </div>

        {/* Role grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ROLES.map(({ role, icon: Icon, title, titleAr, description, descriptionAr, permissions, permissionsAr, accent, border, iconBg }) => (
            <button
              key={role}
              onClick={() => handleSelectRole(role)}
              className={`relative text-left rounded-xl border-2 ${border} bg-gradient-to-br ${accent} p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group cursor-pointer`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`${iconBg} rounded-lg p-2 shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground leading-tight">
                    {language === "en" ? title : titleAr}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {language === "en" ? description : descriptionAr}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {(language === "en" ? permissions : permissionsAr).map((p, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                {t("Simulate Login →", "محاكاة الدخول →")}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
