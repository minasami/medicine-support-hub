import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Dna,
  FlaskConical,
  GraduationCap,
  Handshake,
  HeartPulse,
  Hospital,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Network,
  Pill,
  Route as RouteIcon,
  Scan,
  ScanLine,
  Search,
  Stethoscope,
  Store,
  UserRound,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type DiscoveryTile = {
  id: string;
  href: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  badgeEn?: string;
  badgeAr?: string;
  icon: LucideIcon;
  accent: "emerald" | "blue" | "teal" | "indigo" | "amber" | "rose";
  metricEn?: string;
  metricAr?: string;
};

export const DISCOVERY_TILES: DiscoveryTile[] = [
  {
    id: "medicines",
    href: "/medicines",
    titleEn: "Medicines Encyclopedia",
    titleAr: "موسوعة الأدوية",
    descEn: "Verified pricing, active INN breakdown, and EDA monographs.",
    descAr: "أسعار رسمية، التحليل الكيميائي للمادة الفعالة وسجلات هيئة الدواء.",
    badgeEn: "Core Catalog",
    badgeAr: "السجل الرئيسي",
    icon: Pill,
    accent: "emerald",
    metricEn: "25,000+ Items",
    metricAr: "أكثر من 25 ألف دواء",
  },
  {
    id: "scan",
    href: "/scan",
    titleEn: "Barcode Scanner",
    titleAr: "ماسح الباركود",
    descEn: "Scan medicine packaging EAN barcodes for instant monograph lookup.",
    descAr: "امسح الباركود المدون على العبوة للوصول الفوري لسجل الدواء.",
    badgeEn: "Camera Scan",
    badgeAr: "مسح بالكاميرا",
    icon: Scan,
    accent: "emerald",
    metricEn: "Camera & Manual",
    metricAr: "كاميرا وإدخال يدوي",
  },
  {
    id: "ngos",
    href: "/ngos",
    titleEn: "NGO Assistance Network",
    titleAr: "شبكة الجمعيات الأهلية",
    descEn: "Civil society medication grants, emergency relief, and patient advocacy.",
    descAr: "دعم ومساعدات الدواء من الجمعيات، الإغاثة الطارئة وكفالة المرضى.",
    badgeEn: "Social Safety",
    badgeAr: "الأمان الاجتماعي",
    icon: HeartPulse,
    accent: "teal",
    metricEn: "1,200+ Partners",
    metricAr: "أكثر من 1200 شريك",
  },
  {
    id: "psps",
    href: "/psps",
    titleEn: "Patient Support Programs (PSPs)",
    titleAr: "دليل برامج الدعم (PSP)",
    descEn: "Co-pay assistance, free diagnostics, and manufacturer-sponsored aid.",
    descAr: "برامج دعم المرضى، الفحوصات المجانية ودعم تكلفة العلاجات المزمنة.",
    badgeEn: "Co-Pay & Access",
    badgeAr: "تخفيف التكلفة",
    icon: Handshake,
    accent: "blue",
    metricEn: "45+ Active PSPs",
    metricAr: "أكثر من 45 برنامجاً",
  },
  {
    id: "companies",
    href: "/companies",
    titleEn: "Pharma Companies Directory",
    titleAr: "دليل شركات الأدوية",
    descEn: "Manufacturer stock disclosures, shortage reporting, and company hubs.",
    descAr: "إفصاحات المخزون للشركات، بلاغات النقص ومراكز الاتصال المباشر.",
    badgeEn: "Industry Ops",
    badgeAr: "قطاع الأدوية",
    icon: Building2,
    accent: "indigo",
    metricEn: "1,850+ Entities",
    metricAr: "أكثر من 1850 شركة",
  },
  {
    id: "marketplace",
    href: "/marketplace",
    titleEn: "Supply & Needs Exchange",
    titleAr: "سوق تبادل الإمدادات",
    descEn: "Direct donation matching and verified pharmacy exchange request hub.",
    descAr: "منظومة التبرع المباشر وتبادل النواقص بين المستشفيات والصيدليات.",
    badgeEn: "Live Exchange",
    badgeAr: "التبادل المباشر",
    icon: Store,
    accent: "amber",
    metricEn: "Direct Matching",
    metricAr: "تطابق مباشر",
  },
  {
    id: "clinics",
    href: "/clinics",
    titleEn: "Care & Diagnostic Network",
    titleAr: "شبكة الرعاية والفحوصات",
    descEn: "Clinics, labs, radiology centers, and specialized care partners.",
    descAr: "العيادات، معامل التحاليل، مراكز الأشعة والخدمات الطبية المساندة.",
    badgeEn: "Care Access",
    badgeAr: "مراكز الرعاية",
    icon: Hospital,
    accent: "rose",
    metricEn: "Nationwide Hubs",
    metricAr: "تغطية شاملة",
  },
  {
    id: "learn",
    href: "/learn",
    titleEn: "Medical Knowledge Center",
    titleAr: "مركز المعرفة الطبية",
    descEn: "Patient education, safe usage guides, and clinical protocol courses.",
    descAr: "التثقيف الدوائي، أدلة الاستخدام الآمن ودورات الرعاية الصحية.",
    badgeEn: "Education",
    badgeAr: "التثقيف الصحي",
    icon: GraduationCap,
    accent: "blue",
    metricEn: "Free Courses",
    metricAr: "دورات مجانية",
  },
];

const ACCENT_STYLES = {
  emerald: {
    border: "hover:border-emerald-500/50 dark:hover:border-emerald-400/50",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    border: "hover:border-blue-500/50 dark:hover:border-blue-400/50",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  teal: {
    border: "hover:border-teal-500/50 dark:hover:border-teal-400/50",
    badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  indigo: {
    border: "hover:border-indigo-500/50 dark:hover:border-indigo-400/50",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  amber: {
    border: "hover:border-amber-500/50 dark:hover:border-amber-400/50",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  rose: {
    border: "hover:border-rose-500/50 dark:hover:border-rose-400/50",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

function isSectionActive(location: string, href: string): boolean {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(`${href}/`);
}

export function PlatformDiscovery({ currentHref }: { currentHref?: string }) {
  const { t } = useLanguage();
  const [location] = useLocation();

  const activeHref = currentHref || location;

  return (
    <section className="border-t bg-slate-50/50 dark:bg-slate-900/30 py-12">
      <div className="container mx-auto max-w-7xl px-4 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
              <Layers3 className="h-4 w-4" />
              <span>{t("Unified Medical Discovery Engine", "منظومة الاستكشاف الدوائية الموحدة")}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Explore Healthcare & Aid Services", "استكشف الخدمات الدوائية والمساعدات")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "Access official monographs, NGO medication assistance, PSP directory, and manufacturer stock disclosures in one click.",
                "انتقل مباشرة بين موسوعة المستحضرات، مساعدات الجمعيات، برامج دعم المرضى، وإفصاحات المخزون.",
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DISCOVERY_TILES.map((tile) => {
            const isActive = isSectionActive(activeHref, tile.href);
            const style = ACCENT_STYLES[tile.accent];
            const Icon = tile.icon;

            return (
              <Link
                key={tile.id}
                href={tile.href}
                className={`group relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 ${style.border} ${
                  isActive
                    ? "ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10"
                    : "hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {tile.badgeEn && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                      >
                        {t(tile.badgeEn, tile.badgeAr || tile.badgeEn)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>{t(tile.titleEn, tile.titleAr)}</span>
                      <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {t(tile.descEn, tile.descAr)}
                    </p>
                  </div>
                </div>

                {tile.metricEn && (
                  <div className="mt-4 pt-3 border-t text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>{t(tile.metricEn, tile.metricAr || tile.metricEn)}</span>
                    <span className="text-primary font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                      {t("Explore →", "استكشف ←")}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PlatformDiscoveryHeader({
  currentPath,
}: {
  currentPath?: string;
}) {
  const { t } = useLanguage();
  const [location] = useLocation();
  const path = currentPath || location;

  const quickLinks = useMemo(() => {
    if (path.startsWith("/medicines") || path.startsWith("/catalog")) {
      return [
        { href: "/scan", labelEn: "Barcode Scan", labelAr: "مسح الباركود" },
        { href: "/companies", labelEn: "Companies", labelAr: "الشركات" },
        { href: "/ngos", labelEn: "NGO Aid", labelAr: "الجمعيات" },
        { href: "/psps", labelEn: "PSPs Directory", labelAr: "برامج الدعم" },
        { href: "/marketplace", labelEn: "Exchange Hub", labelAr: "منصة التبادل" },
      ];
    }
    if (path.startsWith("/companies")) {
      return [
        { href: "/medicines", labelEn: "Medicines Catalog", labelAr: "دليل الأدوية" },
        { href: "/scan", labelEn: "Barcode Scan", labelAr: "مسح الباركود" },
        { href: "/marketplace", labelEn: "Stock Exchange", labelAr: "تبادل المخزون" },
        { href: "/industry", labelEn: "Industry Portal", labelAr: "بوابة الصناعة" },
      ];
    }
    if (path.startsWith("/ngos") || path.startsWith("/request")) {
      return [
        { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
        { href: "/psps", labelEn: "PSPs Directory", labelAr: "برامج الدعم" },
        { href: "/marketplace", labelEn: "Donations", labelAr: "التبرعات" },
        { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية" },
      ];
    }
    return [
      { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
      { href: "/scan", labelEn: "Barcode Scan", labelAr: "مسح الباركود" },
      { href: "/companies", labelEn: "Companies", labelAr: "الشركات" },
      { href: "/marketplace", labelEn: "Exchange", labelAr: "التبادل" },
      { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
    ];
  }, [path]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-muted-foreground">
        {t("Quick Links:", "روابط سريعة:")}
      </span>
      {quickLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary px-2.5 py-1 text-[11px] font-medium transition-colors"
        >
          {t(link.labelEn, link.labelAr)}
        </Link>
      ))}
    </div>
  );
}

export function MobilePlatformNav({
  isStaffPage,
  roleHome,
}: {
  isStaffPage: boolean;
  roleHome?: string;
}) {
  const { t } = useLanguage();
  const [location] = useLocation();
  const items = isStaffPage
    ? [
        { href: roleHome || "/portal", labelEn: "Workspace", labelAr: "العمل", icon: LayoutDashboard },
        { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية", icon: Pill },
        { href: "/search", labelEn: "Search", labelAr: "بحث", icon: Search },
        { href: "/learn", labelEn: "Learn", labelAr: "تعلم", icon: GraduationCap },
        { href: "/network", labelEn: "Network", labelAr: "الشبكة", icon: Network },
      ]
    : [
        { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية", icon: Pill },
        { href: "/scan", labelEn: "Scan", labelAr: "مسح", icon: Scan },
        { href: "/search", labelEn: "Search", labelAr: "بحث", icon: Search },
        { href: "/network", labelEn: "Network", labelAr: "الشبكة", icon: Network },
        { href: "/account", labelEn: "Account", labelAr: "الحساب", icon: UserRound },
      ];

  return (
    <nav
      aria-label={t("Mobile platform navigation", "تنقل المنصة على الهاتف")}
      className="fixed inset-x-0 bottom-0 z-[70] border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, labelEn, labelAr, icon: Icon }) => {
          const active = isSectionActive(location, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary scale-110" : ""}`} />
              <span className="truncate">{t(labelEn, labelAr)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
