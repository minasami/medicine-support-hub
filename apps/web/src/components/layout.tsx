import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useRole, ROLE_LABELS, ROLE_HOME, ROLE_COLOR } from "@/lib/role";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FloatingFounderContact } from "@/components/floating-founder-contact";
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

const ROLE_NAV: Record<string, Array<{ href: string; labelEn: string; labelAr: string }>> = {
  REVIEWER: [
    { href: "/reviewer", labelEn: "Triage Queue", labelAr: "قائمة الفرز" },
    { href: "/clinical-assistant", labelEn: "Clinical Assistant", labelAr: "المساعد السريري" },
  ],
  PHYSICIAN: [
    { href: "/physician", labelEn: "Authorization Queue", labelAr: "قائمة التفويض" },
    { href: "/clinical-assistant", labelEn: "Clinical Assistant", labelAr: "المساعد السريري" },
  ],
  PHARMACY_ASSISTANT: [
    { href: "/pharmacy", labelEn: "Dispensing Queue", labelAr: "قائمة الصرف" },
  ],
  PHARMACIST: [
    { href: "/pharmacist", labelEn: "Clinical Dispensing", labelAr: "الصرف السريري" },
    { href: "/clinical-assistant", labelEn: "Clinical Assistant", labelAr: "المساعد السريري" },
  ],
  PREP_MANAGER: [
    { href: "/prep", labelEn: "Packaging Queue", labelAr: "قائمة التعبئة" },
  ],
  DELIVERY_MAN: [
    { href: "/delivery", labelEn: "Delivery Queue", labelAr: "قائمة التوصيل" },
  ],
  BRANCH_MANAGER: [
    { href: "/branch-manager", labelEn: "Branch Overview", labelAr: "نظرة الفرع" },
    { href: "/dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم" },
  ],
  COSMETICIAN: [
    { href: "/cosmetician", labelEn: "Product Queue", labelAr: "قائمة المنتجات" },
  ],
  DATA_ENTRY: [
    { href: "/data-entry", labelEn: "Bulk Entry", labelAr: "إدخال مجمع" },
    { href: "/request", labelEn: "New Record", labelAr: "سجل جديد" },
  ],
  PLATFORM_ADMIN: [
    { href: "/admin", labelEn: "Administration", labelAr: "الإدارة" },
    { href: "/dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم" },
    { href: "/clinical-assistant", labelEn: "Clinical Assistant", labelAr: "المساعد السريري" },
  ],
};

const STAFF_PATHS = [
  "/reviewer", "/physician", "/pharmacist", "/pharmacy",
  "/delivery", "/branch-manager", "/cosmetician", "/data-entry",
  "/admin", "/dashboard", "/employee", "/portal",
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const { role, user } = useRole();
  const { loading, logout } = useAuth();
  const [location, navigate] = useLocation();

  const toggleLanguage = () => setLanguage(language === "en" ? "ar" : "en");

  const isStaffPath = STAFF_PATHS.some(p => location === p || location.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    if (isStaffPath && location !== "/portal" && !user) {
      navigate("/portal");
    }
  }, [loading, user, isStaffPath, location]);

  const RoleIcon = role ? ROLE_ICONS[role] : null;
  const navLinks = role ? (ROLE_NAV[role] ?? []) : [];

  const isStaffPage = role !== null;
  const isPublicPage = !isStaffPage;

  const publicNav = [
    { href: "/request", labelEn: "Request Medicines", labelAr: "طلب أدوية" },
    { href: "/track", labelEn: "Track Order", labelAr: "تتبع الطلب" },
    { href: "/clinical-assistant", labelEn: "Clinical Assistant", labelAr: "المساعد السريري" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground">
      <header className={`sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 ${isStaffPage ? "bg-slate-900/95" : "bg-background/95"}`}>
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href={role ? ROLE_HOME[role] : "/"} className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 ${isStaffPage ? "bg-blue-600" : "bg-primary"} rounded-lg flex items-center justify-center text-white`}>
                {isStaffPage ? <ShieldCheck className="w-4 h-4" /> : <span className="font-bold text-sm">C</span>}
              </div>
              <span className={`font-semibold text-base tracking-tight hidden sm:block ${isStaffPage ? "text-white" : "text-foreground"}`}>
                {t("ChronicMed", "أدوية الأمراض المزمنة")}
              </span>
            </Link>

            {role && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:block" />
                <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded border ${ROLE_COLOR[role]}`}>
                  {RoleIcon && <RoleIcon className="w-3 h-3" />}
                  {ROLE_LABELS[role]}
                </div>
              </>
            )}

            <nav className="hidden md:flex items-center gap-3 text-sm font-medium ml-2">
              {(isStaffPage ? navLinks : publicNav).map(({ href, labelEn, labelAr }) => (
                <Link
                  key={href}
                  href={href}
                  className={`transition-colors hover:text-primary text-sm ${
                    location === href || location.startsWith(href + "/")
                      ? isStaffPage ? "text-blue-400" : "text-primary"
                      : isStaffPage ? "text-slate-300" : "text-muted-foreground"
                  }`}
                >
                  {t(labelEn, labelAr)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className={`font-medium text-xs h-8 ${isStaffPage ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}`}
            >
              {language === "en" ? "العربية" : "English"}
            </Button>

            {isStaffPage ? (
              <div className="flex items-center gap-2">
                {user && (
                  <span className="hidden sm:block text-xs text-slate-400">{user.displayName}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => { logout().then(() => navigate("/portal")); }}
                >
                  <LogOut className="w-3 h-3" />
                  {t("Sign Out", "تسجيل الخروج")}
                </Button>
              </div>
            ) : (
              <Link href="/portal">
                <Button size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
                  {t("Staff Portal", "بوابة الموظفين")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-6 mt-auto bg-card text-card-foreground">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>{t("© 2026 ChronicMed Clinical Pharmacy Platform. All rights reserved.", "© 2026 منصة ChronicMed للصيدلة السريرية. جميع الحقوق محفوظة.")}</p>
        </div>
      </footer>

      {isPublicPage && <FloatingFounderContact />}
      {import.meta.env.DEV && <DevRoleSwitcher />}
    </div>
  );
}

function DevRoleSwitcher() {
  const { role, setUser, clearRole } = useRole();
  const [isOpen, setIsOpen] = useState(false);

  const rolesList = [
    { key: "REVIEWER", label: "Clinical Reviewer" },
    { key: "PHYSICIAN", label: "Physician" },
    { key: "PHARMACIST", label: "Pharmacist" },
    { key: "PHARMACY_ASSISTANT", label: "Pharmacy Assistant" },
    { key: "PREP_MANAGER", label: "Prep Manager" },
    { key: "DELIVERY_MAN", label: "Delivery Man" },
    { key: "BRANCH_MANAGER", label: "Branch Manager" },
    { key: "COSMETICIAN", label: "Cosmetician" },
    { key: "DATA_ENTRY", label: "Data Entry Operator" },
    { key: "PLATFORM_ADMIN", label: "Platform Admin" },
  ];

  const handleSelectRole = (r: any) => {
    setUser({
      id: 999,
      username: "dev_impersonator",
      role: r,
      displayName: "Dev " + r.replace("_", " "),
      branchId: 1,
    });
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[999] font-sans">
      {isOpen ? (
        <div className="bg-popover border border-primary/20 shadow-xl rounded-xl p-4 w-64 text-sm flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Dev Role Impersonator</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-1 rounded hover:bg-muted"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto pr-1">
            {rolesList.map((r) => (
              <button
                key={r.key}
                onClick={() => handleSelectRole(r.key)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                  role === r.key
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span>{r.label}</span>
                {role === r.key && <span className="text-[10px] bg-white/20 px-1 rounded">Active</span>}
              </button>
            ))}
          </div>
          <div className="border-t pt-2 flex gap-2">
            <button
              onClick={() => { clearRole(); setIsOpen(false); }}
              className="flex-1 text-center py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              Clear Role
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-primary transition-all duration-300 rounded-full font-bold text-xs border border-white/10"
        >
          <UserCog className="w-3.5 h-3.5" />
          <span>Role Impersonator</span>
        </button>
      )}
    </div>
  );
}
