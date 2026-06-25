import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useRole, type UserRole, ROLE_HOME } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Stethoscope,
  FlaskConical,
  Truck,
  ClipboardList,
  LayoutDashboard,
  Pill,
  UserCog,
  Briefcase,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

const STAFF_ROLES: Array<{
  role: NonNullable<UserRole>;
  icon: React.ElementType;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  accent: string;
  border: string;
  iconBg: string;
  defaultUser: string;
}> = [
  {
    role: "REVIEWER",
    icon: Stethoscope,
    titleEn: "Clinical Reviewer",
    titleAr: "المراجع السريري",
    descEn: "Medical triage & prescription approval",
    descAr: "الفرز الطبي والموافقة على الوصفات",
    accent: "from-violet-50 to-violet-100/30",
    border: "border-violet-200 hover:border-violet-400",
    iconBg: "bg-violet-600",
    defaultUser: "reviewer1",
  },
  {
    role: "PHYSICIAN",
    icon: UserCog,
    titleEn: "Physician",
    titleAr: "الطبيب",
    descEn: "Prescription validation & clinical auth",
    descAr: "التحقق من الوصفة والتفويض السريري",
    accent: "from-blue-50 to-blue-100/30",
    border: "border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-600",
    defaultUser: "physician1",
  },
  {
    role: "PHARMACY_ASSISTANT",
    icon: FlaskConical,
    titleEn: "Pharmacy Assistant",
    titleAr: "مساعد الصيدلية",
    descEn: "Dispensing logistics & batch tracking",
    descAr: "لوجستيات الصرف وتتبع الدفعات",
    accent: "from-amber-50 to-amber-100/30",
    border: "border-amber-200 hover:border-amber-400",
    iconBg: "bg-amber-600",
    defaultUser: "assistant1",
  },
  {
    role: "PHARMACIST",
    icon: Pill,
    titleEn: "Pharmacist",
    titleAr: "الصيدلاني",
    descEn: "Clinical dispensing & drug review",
    descAr: "الصرف السريري ومراجعة الأدوية",
    accent: "from-orange-50 to-orange-100/30",
    border: "border-orange-200 hover:border-orange-400",
    iconBg: "bg-orange-600",
    defaultUser: "pharmacist1",
  },
  {
    role: "DELIVERY_MAN",
    icon: Truck,
    titleEn: "Delivery Man",
    titleAr: "عامل التوصيل",
    descEn: "Ground delivery & handoff logging",
    descAr: "التوصيل البري وتسجيل التسليم",
    accent: "from-sky-50 to-sky-100/30",
    border: "border-sky-200 hover:border-sky-400",
    iconBg: "bg-sky-600",
    defaultUser: "delivery1",
  },
  {
    role: "BRANCH_MANAGER",
    icon: Briefcase,
    titleEn: "Branch Manager",
    titleAr: "مدير الفرع",
    descEn: "Branch KPIs, staff & inventory oversight",
    descAr: "مؤشرات الفرع والموظفين والمخزون",
    accent: "from-teal-50 to-teal-100/30",
    border: "border-teal-200 hover:border-teal-400",
    iconBg: "bg-teal-600",
    defaultUser: "manager1",
  },
  {
    role: "COSMETICIAN",
    icon: Sparkles,
    titleEn: "Cosmetician",
    titleAr: "خبير التجميل",
    descEn: "Cosmetic & OTC product queue",
    descAr: "قائمة منتجات التجميل والأدوية المكشوفة",
    accent: "from-pink-50 to-pink-100/30",
    border: "border-pink-200 hover:border-pink-400",
    iconBg: "bg-pink-600",
    defaultUser: "cosmetician1",
  },
  {
    role: "DATA_ENTRY",
    icon: ClipboardList,
    titleEn: "Data Entry Operator",
    titleAr: "موظف إدخال البيانات",
    descEn: "Bulk records & offline prescription entry",
    descAr: "السجلات المجمعة وإدخال الوصفات الورقية",
    accent: "from-slate-50 to-slate-100/30",
    border: "border-slate-200 hover:border-slate-400",
    iconBg: "bg-slate-600",
    defaultUser: "dataentry1",
  },
  {
    role: "PLATFORM_ADMIN",
    icon: LayoutDashboard,
    titleEn: "Platform Administrator",
    titleAr: "مدير المنصة",
    descEn: "Telemetry, users, branches & org config",
    descAr: "القياس والمستخدمون والفروع والإعداد",
    accent: "from-rose-50 to-rose-100/30",
    border: "border-rose-200 hover:border-rose-400",
    iconBg: "bg-rose-600",
    defaultUser: "admin",
  },
];

export default function Portal() {
  const { t, language } = useLanguage();
  const { login } = useAuth();
  const { role } = useRole();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<typeof STAFF_ROLES[0] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectRole(r: typeof STAFF_ROLES[0]) {
    setSelected(r);
    setUsername(r.defaultUser);
    setPassword("");
    setError("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    const result = await login(username, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Invalid credentials");
      return;
    }
    navigate(ROLE_HOME[selected.role]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-xl">ChronicMed</div>
              <div className="text-slate-400 text-xs">{t("Clinical Pharmacy Platform", "منصة الصيدلة السريرية")}</div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {t("Staff Portal", "بوابة الموظفين")}
          </h1>
          <p className="text-slate-400">
            {t("Select your role and sign in to access your workspace.", "اختر دورك وسجّل الدخول للوصول إلى مساحة عملك.")}
          </p>
        </div>

        {/* Role grid + login form side by side on large screens */}
        <div className="flex flex-col xl:flex-row gap-8 items-start">
          {/* Role cards */}
          <div className="flex-1">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("1. Select Your Role", "1. اختر دورك")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {STAFF_ROLES.map(r => (
                <button
                  key={r.role}
                  onClick={() => selectRole(r)}
                  className={`relative text-left rounded-xl border-2 transition-all duration-150 p-4 cursor-pointer
                    ${selected?.role === r.role
                      ? `${r.border} bg-gradient-to-br ${r.accent} shadow-lg ring-2 ring-offset-2 ring-offset-slate-800 ring-white/20`
                      : "border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-slate-500"
                    }`}
                >
                  <div className={`${r.iconBg} rounded-lg p-2 inline-flex mb-2`}>
                    <r.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className={`font-semibold text-xs leading-tight mb-0.5 ${selected?.role === r.role ? "text-slate-900" : "text-white"}`}>
                    {language === "en" ? r.titleEn : r.titleAr}
                  </div>
                  <div className={`text-xs leading-tight ${selected?.role === r.role ? "text-slate-600" : "text-slate-400"}`}>
                    {language === "en" ? r.descEn : r.descAr}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Login form */}
          <div className="w-full xl:w-80 shrink-0">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("2. Sign In", "2. تسجيل الدخول")}
            </p>
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              {!selected ? (
                <div className="text-center py-8 text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                  <p className="text-sm">{t("Select a role to sign in", "اختر دوراً لتسجيل الدخول")}</p>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Selected role badge */}
                  <div className={`flex items-center gap-2 rounded-lg border bg-gradient-to-br ${selected.accent} ${selected.border} p-3`}>
                    <div className={`${selected.iconBg} rounded p-1.5`}>
                      <selected.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {language === "en" ? selected.titleEn : selected.titleAr}
                      </div>
                      <div className="text-xs text-slate-500">{t("Selected role", "الدور المحدد")}</div>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">{t("Username", "اسم المستخدم")}</label>
                    <Input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder={t("Enter username", "أدخل اسم المستخدم")}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">{t("Password", "كلمة المرور")}</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t("Enter password", "أدخل كلمة المرور")}
                        required
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      {t("Demo hint: username shown above, password is role+123", "تلميح: كلمة المرور هي اسم الدور + 123")}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("Signing in…", "جاري الدخول…") : t("Sign In", "تسجيل الدخول")}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setSelected(null); setError(""); }}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mt-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    {t("Change role", "تغيير الدور")}
                  </button>
                </form>
              )}
            </div>

            {/* Client link */}
            <div className="mt-4 text-center">
              <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white text-xs transition-colors">
                {t("← Back to patient portal", "← العودة إلى بوابة المريض")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
