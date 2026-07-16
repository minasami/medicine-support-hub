import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { useRole, ROLE_LABELS, ROLE_HOME, ROLE_COLOR } from "@/lib/role";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FloatingFounderContact } from "@/components/floating-founder-contact";
import { PwaExperience } from "@/components/pwa-experience";
import { PlatformFieldStandardizer } from "@/components/platform-field-standardizer";
import {
  MobilePlatformNav,
  PlatformDiscovery,
} from "@/components/platform-discovery";
import {
  Stethoscope,
  FlaskConical,
  Package,
  Truck,
  ClipboardList,
  LayoutDashboard,
  Pill,
  UserCog,
  Briefcase,
  Sparkles,
  ChevronRight,
  LogOut,
  ShieldCheck,
  CircleUserRound,
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ElementType> = {
  REVIEWER: Stethoscope,
  PHARMACY_ASSISTANT: FlaskConical,
  PHARMACIST: Pill,
  PREP_MANAGER: Package,
  DELIVERY_MAN: Truck,
  DATA_ENTRY: ClipboardList,
  PLATFORM_ADMIN: LayoutDashboard,
  PHYSICIAN: UserCog,
  BRANCH_MANAGER: Briefcase,
  COSMETICIAN: Sparkles,
};

const ROLE_NAV: Record<
  string,
  Array<{ href: string; labelEn: string; labelAr: string }>
> = {
  REVIEWER: [
    { href: "/reviewer", labelEn: "Triage Queue", labelAr: "قائمة الفرز" },
    {
      href: "/clinical-assistant",
      labelEn: "Clinical Assistant",
      labelAr: "المساعد السريري",
    },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  PHYSICIAN: [
    {
      href: "/physician",
      labelEn: "Authorization Queue",
      labelAr: "قائمة التفويض",
    },
    {
      href: "/clinical-assistant",
      labelEn: "Clinical Assistant",
      labelAr: "المساعد السريري",
    },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  PHARMACY_ASSISTANT: [
    { href: "/pharmacy", labelEn: "Dispensing Queue", labelAr: "قائمة الصرف" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  PHARMACIST: [
    {
      href: "/pharmacist",
      labelEn: "Clinical Dispensing",
      labelAr: "الصرف السريري",
    },
    {
      href: "/clinical-assistant",
      labelEn: "Clinical Assistant",
      labelAr: "المساعد السريري",
    },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  PREP_MANAGER: [
    { href: "/prep", labelEn: "Packaging Queue", labelAr: "قائمة التعبئة" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  DELIVERY_MAN: [
    { href: "/delivery", labelEn: "Delivery Queue", labelAr: "قائمة التوصيل" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  BRANCH_MANAGER: [
    {
      href: "/branch-manager",
      labelEn: "Branch Overview",
      labelAr: "نظرة الفرع",
    },
    { href: "/dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  COSMETICIAN: [
    {
      href: "/cosmetician",
      labelEn: "Product Queue",
      labelAr: "قائمة المنتجات",
    },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  DATA_ENTRY: [
    { href: "/data-entry", labelEn: "Bulk Entry", labelAr: "إدخال مجمع" },
    { href: "/request", labelEn: "New Record", labelAr: "سجل جديد" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
  PLATFORM_ADMIN: [
    { href: "/admin", labelEn: "Administration", labelAr: "الإدارة" },
    {
      href: "/admin/control-center",
      labelEn: "Platform Controls",
      labelAr: "تحكم المنصة",
    },
    {
      href: "/admin/notifications",
      labelEn: "Notifications",
      labelAr: "الإشعارات",
    },
    {
      href: "/admin/community",
      labelEn: "Community Safety",
      labelAr: "سلامة المجتمع",
    },
    {
      href: "/admin/industry",
      labelEn: "Industry Review",
      labelAr: "مراجعة الشركات",
    },
    {
      href: "/admin/marketplace",
      labelEn: "Marketplace Trust",
      labelAr: "مراجعة السوق",
    },
    {
      href: "/admin/healthcare-network",
      labelEn: "Care Network",
      labelAr: "شبكة الرعاية",
    },
    { href: "/dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم" },
    {
      href: "/clinical-assistant",
      labelEn: "Clinical Assistant",
      labelAr: "المساعد السريري",
    },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
  ],
};

const STAFF_PATHS = [
  "/reviewer",
  "/physician",
  "/pharmacist",
  "/pharmacy",
  "/delivery",
  "/branch-manager",
  "/cosmetician",
  "/data-entry",
  "/admin",
  "/dashboard",
  "/employee",
  "/portal",
];

const AMAZON_ASSOCIATE_URL =
  "https://www.amazon.com?&linkCode=ll2&tag=jesussavedm03-20&linkId=9595e25fcf981157824faa0db82976e2&language=en_US&ref_=as_li_ss_tl";

export function Layout({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const { role, user } = useRole();
  const { loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const toggleLanguage = () => setLanguage(language === "en" ? "ar" : "en");
  const isStaffPath = STAFF_PATHS.some(
    (path) => location === path || location.startsWith(path + "/"),
  );

  useEffect(() => {
    if (loading) return;
    if (isStaffPath && location !== "/portal" && !user) navigate("/portal");
  }, [loading, user, isStaffPath, location, navigate]);

  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  const RoleIcon = role ? ROLE_ICONS[role] : null;
  const navLinks = role
    ? [
        ...(ROLE_NAV[role] ?? []),
        { href: "/journey", labelEn: "Journey", labelAr: "الرحلة" },
      ]
    : [];
  const isStaffPage = role !== null;
  const isPublicPage = !isStaffPage;
  const roleHome = role ? ROLE_HOME[role] : undefined;
  const publicNav = [
    { href: "/journey", labelEn: "Journey", labelAr: "الرحلة" },
    { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
    { href: "/marketplace", labelEn: "Marketplace", labelAr: "السوق" },
    { href: "/companies", labelEn: "Companies", labelAr: "الشركات" },
    { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
    { href: "/industry", labelEn: "Industry", labelAr: "قطاع الصناعة" },
    { href: "/request", labelEn: "Request Support", labelAr: "طلب دعم" },
  ];

  return (
    <div className="min-h-[100dvh] min-w-0 overflow-x-hidden bg-background font-sans text-foreground flex flex-col">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition focus:translate-y-0"
      >
        {t("Skip to content", "انتقل إلى المحتوى")}
      </a>
      <header
        className={`sticky top-0 z-50 w-full border-b pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/60 ${isStaffPage ? "bg-slate-900/95" : "bg-background/95"}`}
      >
        <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              href={roleHome || "/"}
              className="flex shrink-0 items-center gap-2"
              aria-label={t(
                "Medicine Support Hub home",
                "الرئيسية لمنصة دعم الدواء",
              )}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl ${isStaffPage ? "bg-blue-600" : "bg-primary"}`}
              >
                {isStaffPage ? (
                  <ShieldCheck className="h-4 w-4 text-white" />
                ) : (
                  <img src="/pwa-icon.svg" alt="" className="h-8 w-8" />
                )}
              </div>
              <span
                className={`hidden text-base font-semibold tracking-tight sm:block ${isStaffPage ? "text-white" : "text-foreground"}`}
              >
                {t("Medicine Support Hub", "منصة دعم الدواء")}
              </span>
            </Link>

            {role && (
              <>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-500 sm:block" />
                <div
                  className={`hidden items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold sm:flex ${ROLE_COLOR[role]}`}
                >
                  {RoleIcon && <RoleIcon className="h-3 w-3" />}
                  {ROLE_LABELS[role]}
                </div>
              </>
            )}

            <nav className="ml-2 hidden items-center gap-3 text-sm font-medium lg:flex">
              {(isStaffPage ? navLinks : publicNav).map(
                ({ href, labelEn, labelAr }) => {
                  const active =
                    location === href || location.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`text-sm transition-colors hover:text-primary ${active ? (isStaffPage ? "text-blue-400" : "text-primary") : isStaffPage ? "text-slate-300" : "text-muted-foreground"}`}
                    >
                      {t(labelEn, labelAr)}
                    </Link>
                  );
                },
              )}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className={`h-10 min-w-10 px-2 text-xs font-medium sm:h-8 ${isStaffPage ? "text-slate-300 hover:bg-slate-700 hover:text-white" : ""}`}
            >
              {language === "en" ? "العربية" : "English"}
            </Button>
            {isStaffPage ? (
              <div className="flex items-center gap-2">
                {user && (
                  <span className="hidden text-xs text-slate-400 sm:block">
                    {user.displayName}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 min-w-10 gap-1 border-slate-600 px-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white sm:h-8"
                  onClick={() => {
                    logout().then(() => navigate("/portal"));
                  }}
                  aria-label={t("Sign out", "تسجيل الخروج")}
                >
                  <LogOut className="h-4 w-4 sm:h-3 sm:w-3" />
                  <span className="hidden sm:inline">
                    {t("Sign Out", "تسجيل الخروج")}
                  </span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/account">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 min-w-10 gap-1 px-2 text-xs sm:h-8"
                    aria-label={t(
                      "Account and profile settings",
                      "إعدادات الحساب والملف",
                    )}
                  >
                    <CircleUserRound className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {t("Account", "الحساب")}
                    </span>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 outline-none"
      >
        {children}
      </main>
      <PlatformFieldStandardizer />
      <PlatformDiscovery isStaffPage={isStaffPage} roleHome={roleHome} />
      <footer
        aria-label={t("Platform information", "معلومات المنصة")}
        className="mt-auto border-t bg-card pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] text-card-foreground lg:py-6"
      >
        <div className="container mx-auto space-y-2 px-4 text-center text-xs leading-5 text-muted-foreground">
          <p>
            {t(
              "© 2026 Medicine Support Hub. Connected healthcare knowledge, verified participation, learning, marketplace supply, and operations.",
              "© 2026 منصة دعم الدواء. معرفة صحية ومشاركة موثقة وتعلم وسوق إمداد وعمليات مترابطة.",
            )}
          </p>
          <p>
            {t(
              "As an Amazon Associate, the platform may earn from qualifying purchases of general health, accessibility, education, and office supplies. Affiliate links do not affect clinical content or medicine rankings.",
              "بصفتها عضوًا في برنامج شركاء أمازون، قد تحصل المنصة على عمولة من مشتريات مؤهلة لمستلزمات الصحة العامة والإتاحة والتعليم والمكتب. لا تؤثر روابط العمولة على المحتوى السريري أو ترتيب الأدوية.",
            )}{" "}
            <a
              href={AMAZON_ASSOCIATE_URL}
              target="_blank"
              rel="sponsored nofollow noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {t("Browse eligible supplies", "تصفح المستلزمات المؤهلة")}
            </a>
          </p>
        </div>
      </footer>
      <MobilePlatformNav isStaffPage={isStaffPage} roleHome={roleHome} />
      <PwaExperience />
      {isPublicPage && <FloatingFounderContact />}
    </div>
  );
}
