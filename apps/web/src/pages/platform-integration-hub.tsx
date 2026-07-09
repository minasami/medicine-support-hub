import { useLanguage } from "@/lib/i18n";

const areas = [
  {
    title: "Medicines encyclopedia",
    titleAr: "موسوعة الأدوية",
    href: "/medicines",
    description: "Public searchable medicine knowledge base designed to attract traffic and connect interest back to the platform.",
    descriptionAr: "قاعدة معرفة عامة وقابلة للبحث عن الأدوية لجذب الزيارات وربط الاهتمام بالمنصة.",
    status: "Traffic",
    statusAr: "زيارات",
  },
  {
    title: "Platform admin",
    titleAr: "إدارة المنصة",
    href: "/admin-users",
    description: "Manage users, roles, activation status, and account details from one controlled dashboard.",
    descriptionAr: "إدارة المستخدمين والأدوار وحالة التفعيل وبيانات الحساب من لوحة واحدة محكومة.",
    status: "Control",
    statusAr: "تحكم",
  },
  {
    title: "Pharmacy operations",
    titleAr: "عمليات الصيدلية",
    href: "/pharmacy",
    description: "Run sales, inventory, purchases, branch access, finance, training, and settings.",
    descriptionAr: "تشغيل المبيعات والمخزون والمشتريات وصلاحيات الفروع والمالية والتدريب والإعدادات.",
    status: "Operations",
    statusAr: "تشغيل",
  },
  {
    title: "Pharmacy reports",
    titleAr: "تقارير الصيدلية",
    href: "/pharmacy/reports",
    description: "Open finance, stock, reorder, movement, purchase, supplier, sales, and access reports.",
    descriptionAr: "فتح تقارير المالية والمخزون وإعادة الطلب والحركات والمشتريات والموردين والمبيعات والصلاحيات.",
    status: "Reports",
    statusAr: "تقارير",
  },
  {
    title: "Program workspace",
    titleAr: "مساحة البرامج",
    href: "/workspace",
    description: "Manage healthcare programs, beneficiaries, requests, pilots, decisions, meetings, and evidence.",
    descriptionAr: "إدارة البرامج الصحية والمستفيدين والطلبات والتجارب والقرارات والاجتماعات والأدلة.",
    status: "Programs",
    statusAr: "برامج",
  },
  {
    title: "Impact reporting",
    titleAr: "تقارير الأثر",
    href: "/impact",
    description: "Review public-health outcomes, performance indicators, and program impact narrative.",
    descriptionAr: "مراجعة نتائج الصحة العامة ومؤشرات الأداء وسرد أثر البرامج.",
    status: "Impact",
    statusAr: "أثر",
  },
  {
    title: "Staff portal",
    titleAr: "بوابة الفريق",
    href: "/portal",
    description: "Sign in and route staff to the right operational workspace based on role.",
    descriptionAr: "تسجيل الدخول وتوجيه الفريق إلى مساحة العمل المناسبة حسب الدور.",
    status: "Access",
    statusAr: "دخول",
  },
];

const flows = [
  ["Attract public interest through the medicine encyclopedia", "اجذب الاهتمام العام من خلال موسوعة الأدوية"],
  ["Create or update users", "أنشئ أو حدّث المستخدمين"],
  ["Run work in pharmacy or program modules", "نفّذ العمل داخل أقسام الصيدلية أو البرامج"],
  ["Review reports and export evidence", "راجع التقارير وصدّر الأدلة"],
];

export default function PlatformIntegrationHub() {
  const { t } = useLanguage();

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Integrated command", "القيادة المتكاملة")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Platform integration hub", "مركز تكامل المنصة")}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {t("A single command page connecting public medicine discovery, administration, healthcare programs, pharmacy operations, reporting, and staff access.", "صفحة قيادة واحدة تربط اكتشاف الأدوية للجمهور وإدارة المنصة والبرامج الصحية وعمليات الصيدلية والتقارير ودخول الفريق.")}
          </p>
        </div>
        <a href="/medicines" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
          {t("Open medicines", "فتح الأدوية")}
        </a>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => <a key={area.href} href={area.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{t(area.title, area.titleAr)}</h2>
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{t(area.status, area.statusAr)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(area.description, area.descriptionAr)}</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">{t("Open area →", "فتح القسم ←")}</span>
      </a>)}
    </section>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">{t("Best integrated operating flow", "أفضل مسار تشغيل متكامل")}</h2>
      <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
        {flows.map(([en, ar], index) => <li key={en} className="rounded-xl bg-background p-4">{index + 1}. {t(en, ar)}</li>)}
      </ol>
    </section>
  </main>;
}
