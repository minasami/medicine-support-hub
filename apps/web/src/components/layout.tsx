import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { useRole, ROLE_LABELS, ROLE_HOME, ROLE_COLOR } from "@/lib/role";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FloatingFounderContact } from "@/components/floating-founder-contact";
import { PwaExperience } from "@/components/pwa-experience";
import { PlatformFieldStandardizer } from "@/components/platform-field-standardizer";
import { GlobalMedicineSearch } from "@/components/global-medicine-search";
import { PlatformSidebarDrawer } from "@/components/platform-sidebar-drawer";
import {
  MobilePlatformNav,
  PlatformDiscovery,
} from "@/components/platform-discovery";
import { prefetchCanonicalIdMap } from "@/lib/canonical-id-map";
import { CanonicalMapStatusBanner } from "@/components/canonical-map-status-banner";
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
  ChevronRight,
  LogOut,
  ShieldCheck,
  CircleUserRound,
  Scan,
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ElementType> = {
  REVIEWER: Stethoscope,
  PHARMACY_ASSISTANT: FlaskConical,
  PHARMACIST: Pill,
  PREP_MANAGER: Package,
  DELIVERY_MAN: Truck,
  DATA_ENTRY: ClipboardList,
  PLATFORM_ADMIN: LayoutDashboard,
  ROLE_MANAGER: UserCog,
  INDUSTRY_REPRESENTATIVE: Briefcase,
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const { role } = useRole();
  const { session, logout } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  useEffect(() => {
    prefetchCanonicalIdMap();
  }, []);

  const RoleIcon = role ? ROLE_ICONS[role] : null;
  const isStaffPage = role !== null;
  const isPublicPage = !isStaffPage;
  const roleHome = role ? ROLE_HOME[role] : undefined;
  const publicNav = [
    { href: "/journey", labelEn: "Journey", labelAr: "الرحلة" },
    { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
    { href: "/scan", labelEn: "Scan Barcode", labelAr: "مسح الباركود" },
    { href: "/world-search", labelEn: "World Search", labelAr: "بحث عالمي" },
    { href: "/formulas", labelEn: "Baby Formulas", labelAr: "حليب الأطفال" },
    { href: "/marketplace", labelEn: "Marketplace", labelAr: "السوق" },
    { href: "/ngos", labelEn: "NGO Network", labelAr: "الجمعيات الأهلية" },
    { href: "/psps", labelEn: "PSPs Directory", labelAr: "دليل برامج الدعم" },
    { href: "/companies", labelEn: "Companies", labelAr: "الشركات" },
    { href: "/jobs", labelEn: "Jobs", labelAr: "الوظائف" },
    { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
    { href: "/ai", labelEn: "AI / MCP", labelAr: "الذكاء الاصطناعي" },
    { href: "/industry", labelEn: "Industry", labelAr: "قطاع الصناعة" },
    { href: "/request", labelEn: "Request Support", labelAr: "طلب دعم" },
  ];

  return (
    <div className="min-h-[100dvh] min-w-0 overflow-x-clip bg-background font-sans text-foreground flex flex-col">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition focus:translate-y-0"
      >
        {t("Skip to content", "انتقل إلى المحتوى")}
      </a>
      <header
        className={`sticky top-0 z-50 w-full border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-all duration-300 ${
          isStaffPage
            ? "bg-slate-950/85 border-slate-800/80 shadow-lg shadow-black/10"
            : "bg-background/80 border-slate-200/50 dark:border-slate-800/50 shadow-sm"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
            <PlatformSidebarDrawer>
              <button
                className="flex shrink-0 items-center gap-2 cursor-pointer group focus:outline-none"
                aria-label={t(
                  "Medicine Support Hub navigation menu",
                  "قائمة تنقل منصة دعم الدواء",
                )}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl group-hover:scale-105 transition-transform ${isStaffPage ? "bg-blue-600" : "bg-primary"}`}
                >
                  {isStaffPage ? (
                    <ShieldCheck className="h-4 w-4 text-white" />
                  ) : (
                    <img
                      src="/medicine-support-hub-logo.png"
                      alt=""
                      className="h-8 w-8 object-cover"
                    />
                  )}
                </div>
                <span
                  className={`hidden text-base font-semibold tracking-tight sm:block ${isStaffPage ? "text-white" : "text-foreground"}`}
                >
                  {t("Medicine Support Hub", "منصة دعم الدواء")}
                </span>
              </button>
            </PlatformSidebarDrawer>

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
          </div>

          <GlobalMedicineSearch isStaffPage={isStaffPage} />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className={`h-10 min-w-10 px-2 text-xs font-medium sm:h-8 ${isStaffPage ? "text-slate-300 hover:bg-slate-700 hover:text-white" : ""}`}
            >
              {language === "en" ? "العربية" : "English"}
            </Button>
            {isStaffPage ? (
              <div className="flex items-center gap-2">
                {session?.user && (
                  <span className="hidden text-xs text-slate-400 sm:block">
                    {session.user.email}
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
                <Link
                  href="/scan"
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/40 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60 sm:h-8"
                  aria-label={t("Scan medicine barcode", "مسح باركود الدواء")}
                  title={t("Scan barcode", "مسح الباركود")}
                >
                  <Scan className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">{t("Scan", "مسح")}</span>
                </Link>
                <Link
                  href="/account"
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:h-8"
                  aria-label={t("Account and profile settings", "إعدادات الحساب والملف")}
                >
                  <CircleUserRound className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("Account", "الحساب")}</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {isPublicPage && (
          <nav
            aria-label={t("Primary navigation", "التنقل الرئيسي")}
            className="border-t border-slate-200/50 bg-background/50 dark:border-slate-800/50"
          >
            <div className="container mx-auto flex h-10 items-center gap-1 overflow-x-auto px-4 text-xs scrollbar-none">
              {publicNav.map((link) => {
                const isActive =
                  location === link.href ||
                  (link.href !== "/" && location.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {t(link.labelEn, link.labelAr)}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="container mx-auto max-w-7xl px-3 pt-3 sm:px-4">
          <CanonicalMapStatusBanner />
        </div>
        {children}
      </main>

      {isPublicPage && <PlatformDiscovery />}

      <footer className="border-t border-slate-200/50 bg-slate-50/50 dark:border-slate-800/50 dark:bg-slate-900/50 py-8 text-center text-xs text-muted-foreground">
        <div className="container mx-auto max-w-7xl px-4 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
            <Link href="/medicines" className="hover:text-foreground transition-colors">
              {t("Medicines Encyclopedia", "موسوعة الأدوية")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/scan" className="hover:text-foreground transition-colors">
              {t("Barcode Scanner", "ماسح الباركود")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/world-search" className="hover:text-foreground transition-colors">
              {t("World Search", "بحث عالمي")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/ngos" className="hover:text-foreground transition-colors">
              {t("NGO Network", "شبكة الجمعيات الأهلية")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/companies" className="hover:text-foreground transition-colors">
              {t("Pharma Companies", "شركات الأدوية")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/request" className="hover:text-foreground transition-colors">
              {t("Request Support", "طلب الدعم الدوائي")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/ai" className="hover:text-foreground transition-colors">
              {t("AI / MCP", "الذكاء الاصطناعي")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {t("Privacy Policy", "سياسة الخصوصية")}
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              {t("Terms of Service", "شروط الاستخدام")}
            </Link>
          </div>

          <p>
            {t(
              "Medicine Support Hub — Unified Egyptian Healthcare Intelligence & Assistance Network",
              "منصة دعم الدواء — المنظومة الوطنية الموحدة للمساعدات والخدمات الدوائية في مصر",
            )}
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            {t(
              "Independent non-governmental medical intelligence & social support platform. Information provided is for educational and accessibility purposes.",
              "منصة أهلية مستقلة غير حكومية للمعلومات والمساعدات الدوائية. البيانات المتاحة لأغراض التوعية والتسهيل الاجتماعي.",
            )}
          </p>
        </div>
      </footer>
      <PwaExperience />
      <PlatformFieldStandardizer />
      <MobilePlatformNav isStaffPage={isStaffPage} roleHome={roleHome} />
      <FloatingFounderContact />
    </div>
  );
}
