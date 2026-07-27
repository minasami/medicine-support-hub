import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { useRole, ROLE_LABELS, ROLE_COLOR } from "@/lib/role";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pill,
  Baby,
  HeartHandshake,
  ShieldCheck,
  Building2,
  FileText,
  User,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  Globe,
  Menu,
  HelpCircle,
  FolderHeart,
  Briefcase,
} from "lucide-react";

export function PlatformSidebarDrawer({ children }: { children?: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const { session, profile, signOut } = usePatientAuth();
  const { role } = useRole();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const isAr = language === "ar";

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const navItem = (href: string, icon: React.ReactNode, titleEn: string, titleAr: string, badge?: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-900 transition-colors group text-xs font-semibold text-slate-700 dark:text-slate-200"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className="truncate">{t(titleEn, titleAr)}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] px-1.5 py-0">
            {badge}
          </Badge>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button
            aria-label={t("Open platform navigation menu", "فتح قائمة التنقل في المنصة")}
            className="flex items-center gap-2 text-left cursor-pointer group focus:outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-blue-600 shadow-md group-hover:scale-105 transition-transform">
              <img
                src="/medicine-support-hub-logo.png"
                alt="Logo"
                className="h-9 w-9 object-cover"
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                {t("Medicine Support Hub", "منصة دعم الدواء")}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-1">
                <Menu className="h-3 w-3 inline" />
                <span>{t("Click for menu", "انقر للقائمة")}</span>
              </div>
            </div>
          </button>
        )}
      </SheetTrigger>

      <SheetContent side={isAr ? "right" : "left"} className="w-[320px] sm:w-[360px] p-0 flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 p-1 flex items-center justify-center shrink-0">
                <img src="/medicine-support-hub-logo.png" alt="" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm leading-tight truncate">
                  {t("Medicine Support Hub", "منصة دعم الدواء")}
                </h3>
                <p className="text-[11px] text-blue-100/80 truncate">
                  {t("National Pharmaceutical Platform", "المنصة القومية لدعم الدواء")}
                </p>
              </div>
            </div>

            {/* Logged in User Profile Banner */}
            <div className="mt-3.5 pt-3 border-t border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {profile?.full_name?.charAt(0) || session?.user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {profile?.full_name || session?.user?.email?.split("@")[0] || t("Guest User", "زائر")}
                  </div>
                  <div className="text-[10px] text-blue-200 truncate">
                    {session?.user?.email || t("Public Session", "جلسة عامة")}
                  </div>
                </div>
              </div>

              {role && (
                <Badge className={`text-[9px] px-1.5 py-0 ${ROLE_COLOR[role] || "bg-white/20 text-white"}`}>
                  {ROLE_LABELS[role] || role}
                </Badge>
              )}
            </div>
          </div>

          {/* Navigation Links Group */}
          <div className="p-3 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
            {/* Account & Settings */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("Account & Profile", "الحساب والملف الشخصي")}
              </div>
              {navItem("/account", <User className="h-4 w-4" />, "Account & Representative Hub", "حساب الممثل والملف الشخصي", "Dashboard")}
              {navItem("/account#settings", <Settings className="h-4 w-4" />, "Settings & Password", "الإعدادات كلمة المرور")}
            </div>

            {/* Main Clinical Services */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("Medicines & Products", "الأدوية والمنتجات الطبية")}
              </div>
              {navItem("/medicines", <Pill className="h-4 w-4" />, "Medicine Encyclopedia", "موسوعة الأدوية", "1500+")}
              {navItem("/formulas", <Baby className="h-4 w-4" />, "Baby Formulas Finder", "دليل حليب الأطفال", "Pediatric")}
            </div>

            {/* Healthcare Network */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("Healthcare Support Network", "شبكة الدعم والرعاية")}
              </div>
              {navItem("/request", <FolderHeart className="h-4 w-4" />, "Submit Medicine Request", "تقديم طلب دعم دواء", "Fast Priority")}
              {navItem("/ngos", <HeartHandshake className="h-4 w-4" />, "NGO Assistance Network", "دليل الجمعيات الخيرية")}
              {navItem("/psps", <ShieldCheck className="h-4 w-4" />, "Patient Support Programs (PSP)", "برامج دعم المرضى")}
            </div>

            {/* Industry & Governance */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("Pharmaceutical Industry", "قطاع شركات الدواء")}
              </div>
              {navItem("/industry", <Building2 className="h-4 w-4" />, "Industry Contribution Network", "شبكة مساهمات الشركات")}
              {navItem("/manifesto", <FileText className="h-4 w-4" />, "Platform Manifesto & Security", "بيان وسلامة المنصة")}
            </div>
          </div>
        </div>

        {/* Bottom Drawer Actions */}
        <div className="p-3 border-t bg-slate-50 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="flex-1 text-xs gap-1.5 h-8 font-semibold"
            >
              <Globe className="h-3.5 w-3.5 text-blue-600" />
              <span>{language === "en" ? "العربية" : "English"}</span>
            </Button>

            {session?.user && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="text-xs gap-1.5 h-8"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t("Sign Out", "خروج")}</span>
              </Button>
            )}
          </div>

          <div className="text-center text-[10px] text-slate-400">
            Medicine Support Hub • v1.0.4 • Appwrite Sites Verified
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
