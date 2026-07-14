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
  ScanLine,
  Search,
  Stethoscope,
  Store,
  UserRound,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Destination = {
  href: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: LucideIcon;
};

const DESTINATIONS: Destination[] = [
  {
    href: "/medicines",
    titleEn: "Medicine encyclopedia",
    titleAr: "موسوعة الأدوية",
    descriptionEn: "Search products, active ingredients, companies, uses, and connected care options.",
    descriptionAr: "ابحث عن المنتجات والمواد الفعالة والشركات والاستخدامات وخيارات الرعاية المرتبطة.",
    icon: Pill,
  },
  {
    href: "/companies",
    titleEn: "Company portfolios",
    titleAr: "ملفات الشركات",
    descriptionEn: "Move from a product to its manufacturer, toll manufacturer, trademark owner, and portfolio.",
    descriptionAr: "انتقل من المنتج إلى المصنع ومصنع الغير ومالك العلامة التجارية ومحفظة الشركة.",
    icon: Building2,
  },
  {
    href: "/generics",
    titleEn: "Active ingredients",
    titleAr: "المواد الفعالة",
    descriptionEn: "Explore medicines through their generic and ingredient relationships.",
    descriptionAr: "استكشف الأدوية من خلال علاقاتها بالمواد الفعالة والأسماء العلمية.",
    icon: Dna,
  },
  {
    href: "/diseases",
    titleEn: "Disease areas",
    titleAr: "المجالات المرضية",
    descriptionEn: "Connect conditions with medicines, learning resources, and care providers.",
    descriptionAr: "اربط الحالات المرضية بالأدوية وموارد التعلم ومقدمي الرعاية.",
    icon: HeartPulse,
  },
  {
    href: "/therapeutic-categories",
    titleEn: "Therapeutic categories",
    titleAr: "الفئات العلاجية",
    descriptionEn: "Browse the catalog through therapeutic families and clinical context.",
    descriptionAr: "تصفح الكتالوج من خلال العائلات العلاجية والسياق السريري.",
    icon: Layers3,
  },
  {
    href: "/marketplace",
    titleEn: "Verified marketplace",
    titleAr: "السوق الموثق",
    descriptionEn: "Continue from medicine discovery to verified supply and seller information.",
    descriptionAr: "انتقل من اكتشاف الدواء إلى معلومات الإمداد والبائعين الموثقين.",
    icon: Store,
  },
  {
    href: "/clinics",
    titleEn: "Clinics and physicians",
    titleAr: "العيادات والأطباء",
    descriptionEn: "Find reviewed providers, communicate, and request an appointment.",
    descriptionAr: "ابحث عن مقدمي رعاية تمت مراجعتهم وتواصل واطلب موعدًا.",
    icon: Stethoscope,
  },
  {
    href: "/pharmacies",
    titleEn: "Pharmacy network",
    titleAr: "شبكة الصيدليات",
    descriptionEn: "Connect prescriptions and medicine needs with participating pharmacies.",
    descriptionAr: "اربط الوصفات واحتياجات الدواء بالصيدليات المشاركة.",
    icon: Hospital,
  },
  {
    href: "/labs",
    titleEn: "Laboratory network",
    titleAr: "شبكة المعامل",
    descriptionEn: "Find laboratories connected to diagnostic orders and patient journeys.",
    descriptionAr: "ابحث عن المعامل المرتبطة بطلبات التحاليل ورحلة المريض.",
    icon: FlaskConical,
  },
  {
    href: "/radiology",
    titleEn: "Radiology and examinations",
    titleAr: "الأشعة والفحوصات",
    descriptionEn: "Continue diagnostic requests through connected examination centers.",
    descriptionAr: "تابع طلبات التشخيص من خلال مراكز الفحوصات المترابطة.",
    icon: ScanLine,
  },
  {
    href: "/learn",
    titleEn: "Learning center",
    titleAr: "مركز التعلم",
    descriptionEn: "Understand medicines, workflows, safety, and platform participation.",
    descriptionAr: "افهم الأدوية ومسارات العمل والسلامة والمشاركة في المنصة.",
    icon: GraduationCap,
  },
  {
    href: "/journey",
    titleEn: "Connected care journey",
    titleAr: "رحلة الرعاية المترابطة",
    descriptionEn: "See how discovery, providers, diagnostics, prescriptions, and fulfillment connect.",
    descriptionAr: "شاهد كيف يترابط البحث ومقدمو الرعاية والتشخيص والوصفات والتنفيذ.",
    icon: RouteIcon,
  },
  {
    href: "/industry",
    titleEn: "Industry participation",
    titleAr: "مشاركة قطاع الصناعة",
    descriptionEn: "Contribute verified product, company, and market knowledge through governance.",
    descriptionAr: "ساهم بمعرفة موثقة عن المنتجات والشركات والسوق من خلال الحوكمة.",
    icon: Briefcase,
  },
  {
    href: "/industry/opportunities",
    titleEn: "Partnership opportunities",
    titleAr: "فرص الشراكة",
    descriptionEn: "Connect organizations, pilots, data contributions, and healthcare opportunities.",
    descriptionAr: "اربط المؤسسات والمشروعات التجريبية ومساهمات البيانات والفرص الصحية.",
    icon: Handshake,
  },
  {
    href: "/verified-products",
    titleEn: "Verified products",
    titleAr: "المنتجات الموثقة",
    descriptionEn: "Review governed product records and their supporting evidence.",
    descriptionAr: "راجع سجلات المنتجات المحكومة والأدلة الداعمة لها.",
    icon: BadgeCheck,
  },
  {
    href: "/request",
    titleEn: "Request support",
    titleAr: "طلب دعم",
    descriptionEn: "Start a support request and follow it through the connected workflow.",
    descriptionAr: "ابدأ طلب دعم وتابعه خلال مسار العمل المترابط.",
    icon: LifeBuoy,
  },
  {
    href: "/network",
    titleEn: "Platform network map",
    titleAr: "خريطة شبكة المنصة",
    descriptionEn: "See the platform as one connected system instead of isolated modules.",
    descriptionAr: "شاهد المنصة كنظام واحد مترابط بدلًا من وحدات منفصلة.",
    icon: Network,
  },
  {
    href: "/search",
    titleEn: "Search the whole platform",
    titleAr: "ابحث في المنصة كلها",
    descriptionEn: "Search across medicines, companies, care, learning, and opportunities.",
    descriptionAr: "ابحث عبر الأدوية والشركات والرعاية والتعلم والفرص.",
    icon: Search,
  },
  {
    href: "/account",
    titleEn: "Patient account",
    titleAr: "حساب المريض",
    descriptionEn: "Keep requests, appointments, preferences, and care activity together.",
    descriptionAr: "اجمع الطلبات والمواعيد والتفضيلات ونشاط الرعاية في مكان واحد.",
    icon: UserRound,
  },
];

const DESTINATION_MAP = new Map(DESTINATIONS.map((destination) => [destination.href, destination]));

function isSectionActive(location: string, href: string) {
  if (location === href) return true;
  const section = href.split("/").filter(Boolean)[0];
  return Boolean(section && location.startsWith(`/${section}/`));
}

function routeRecommendations(location: string, isStaffPage: boolean) {
  if (isStaffPage) {
    return ["/medicines", "/clinics", "/search", "/learn", "/network", "/journey"];
  }
  if (/^\/(medicines|catalog|generics|diseases|therapeutic-categories)/.test(location)) {
    return ["/companies", "/generics", "/diseases", "/therapeutic-categories", "/marketplace", "/clinics"];
  }
  if (/^\/(clinics|pharmacies|labs|radiology|profiles)/.test(location)) {
    return ["/medicines", "/clinics", "/pharmacies", "/labs", "/radiology", "/journey", "/account"];
  }
  if (/^\/(companies|industry|verified-products|marketplace)/.test(location)) {
    return ["/medicines", "/companies", "/verified-products", "/marketplace", "/industry/opportunities", "/network"];
  }
  if (/^\/(learn|journey|request|account|track)/.test(location)) {
    return ["/medicines", "/clinics", "/companies", "/marketplace", "/learn", "/network"];
  }
  return ["/medicines", "/clinics", "/companies", "/marketplace", "/learn", "/network"];
}

export function PlatformDiscovery({
  isStaffPage,
  roleHome,
}: {
  isStaffPage: boolean;
  roleHome?: string;
}) {
  const { t } = useLanguage();
  const [location] = useLocation();
  const recommended = routeRecommendations(location, isStaffPage)
    .map((href) => DESTINATION_MAP.get(href))
    .filter((destination): destination is Destination => Boolean(destination))
    .filter((destination) => !isSectionActive(location, destination.href));

  const staffHome: Destination | null = isStaffPage && roleHome && !isSectionActive(location, roleHome)
    ? {
        href: roleHome,
        titleEn: "Return to your workspace",
        titleAr: "العودة إلى مساحة عملك",
        descriptionEn: "Continue your role-specific tasks without losing the wider platform context.",
        descriptionAr: "تابع مهام دورك مع الحفاظ على ارتباطها ببقية المنصة.",
        icon: LayoutDashboard,
      }
    : null;

  const destinations = [...(staffHome ? [staffHome] : []), ...recommended].slice(0, 6);

  return (
    <section
      aria-labelledby="platform-discovery-title"
      className="border-t bg-gradient-to-b from-muted/20 via-background to-background"
    >
      <div className="container mx-auto px-4 py-10 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("One connected platform", "منصة واحدة مترابطة")}
            </div>
            <h2 id="platform-discovery-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("Continue your journey across Medicine Support Hub", "واصل رحلتك عبر منصة دعم الدواء")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {t(
                "Every page is a doorway to related medicine knowledge, companies, care providers, diagnostics, fulfillment, learning, and support.",
                "كل صفحة هي مدخل إلى معرفة دوائية وشركات ومقدمي رعاية وتشخيص وتنفيذ وتعلم ودعم مترابط.",
              )}
            </p>
          </div>
          <Link
            href="/network"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-primary/40 hover:text-primary sm:self-auto"
          >
            {t("View the network map", "عرض خريطة الشبكة")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mobile-scrollbar-hidden -mx-4 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <Link
                key={destination.href}
                href={destination.href}
                className="group min-h-44 w-[82vw] max-w-sm shrink-0 snap-start rounded-2xl border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md md:w-auto md:max-w-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                </div>
                <h3 className="mt-5 text-base font-bold">{t(destination.titleEn, destination.titleAr)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(destination.descriptionEn, destination.descriptionAr)}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{t("Connected pathway:", "المسار المترابط:")}</span>
          {[
            ["/medicines", "Discover", "اكتشف"],
            ["/companies", "Understand", "افهم"],
            ["/clinics", "Find care", "ابحث عن رعاية"],
            ["/journey", "Continue the journey", "واصل الرحلة"],
          ].map(([href, en, ar], index) => (
            <span key={href} className="inline-flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">→</span>}
              <Link href={href} className="min-h-8 rounded-full bg-muted px-3 py-1.5 transition hover:bg-primary/10 hover:text-primary">
                {t(en, ar)}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </section>
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
        { href: "/clinics", labelEn: "Care", labelAr: "الرعاية", icon: Stethoscope },
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
              <span className={`flex h-8 w-10 items-center justify-center rounded-xl transition ${active ? "bg-primary/12" : ""}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate">{t(labelEn, labelAr)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
