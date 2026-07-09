import { useLanguage } from "@/lib/i18n";

const modules = [
  { title: "Integration hub", titleAr: "مركز التكامل", href: "/integrations", description: "Connect pharmacy, admin, program workspace, impact reporting, and staff access from one command page.", descriptionAr: "ربط الصيدلية والإدارة ومساحة البرامج وتقارير الأثر ودخول الفريق من صفحة قيادة واحدة.", status: "Command", statusAr: "قيادة" },
  { title: "Reports and exports", titleAr: "التقارير والتصدير", href: "/pharmacy/reports", description: "One place for finance, stock, reorder, movement, purchase, supplier, sales, and access reports.", descriptionAr: "مكان واحد لتقارير المالية والمخزون وإعادة الطلب والحركات والمشتريات والموردين والمبيعات والصلاحيات.", status: "Hub", statusAr: "مركز" },
  { title: "Finance reporting", titleAr: "التقارير المالية", href: "/pharmacy/finance", description: "Track sales, expenses, and profit by reporting period.", descriptionAr: "متابعة المبيعات والمصروفات والربح حسب فترة التقرير.", status: "Live", statusAr: "متاح" },
  { title: "Sales", titleAr: "المبيعات", href: "/pharmacy/sales", description: "Sell from inventory batches, deduct stock, and post revenue to finance.", descriptionAr: "البيع من باتشات المخزون مع خصم الكمية وترحيل الإيراد للمالية.", status: "New", statusAr: "جديد" },
  { title: "Team access", titleAr: "صلاحيات الفريق", href: "/pharmacy/members", description: "Manage accountant and manager access for each pharmacy branch.", descriptionAr: "إدارة صلاحيات المحاسب والمدير لكل فرع صيدلية.", status: "Live", statusAr: "متاح" },
  { title: "Branch settings", titleAr: "إعدادات الفروع", href: "/pharmacy/settings", description: "Review active branches and deactivate duplicate or test branches safely.", descriptionAr: "مراجعة الفروع النشطة وتعطيل الفروع المكررة أو التجريبية بأمان.", status: "Admin", statusAr: "إدارة" },
  { title: "Inventory", titleAr: "المخزون", href: "/pharmacy/inventory", description: "Review medicine stock movement and inventory readiness.", descriptionAr: "مراجعة حركة مخزون الأدوية وجاهزية المخزون.", status: "Module", statusAr: "قسم" },
  { title: "Purchases", titleAr: "المشتريات", href: "/pharmacy/purchases", description: "Prepare pharmacy purchasing workflows and supplier tracking.", descriptionAr: "إدارة مشتريات الصيدلية ومتابعة الموردين.", status: "Module", statusAr: "قسم" },
  { title: "Training", titleAr: "التدريب", href: "/pharmacy/training", description: "Keep branch staff aligned on operating procedures and system use.", descriptionAr: "توحيد فهم فريق الفرع لإجراءات التشغيل واستخدام النظام.", status: "Module", statusAr: "قسم" },
];

export default function PharmacyPortal() {
  const { t } = useLanguage();
  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Pharmacy operations", "عمليات الصيدلية")}</p>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("Pharmacy operations hub", "مركز عمليات الصيدلية")}</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">{t("Manage branch finance, sales, accountant access, inventory, purchases, reports, team training, and branch settings from one stable entry point.", "إدارة مالية الفرع والمبيعات والصلاحيات والمخزون والمشتريات والتقارير والتدريب وإعدادات الفروع من مكان واحد.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/integrations" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted">{t("Open integration hub", "فتح مركز التكامل")}</a>
            <a href="/pharmacy/reports" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted">{t("Open reports", "فتح التقارير")}</a>
            <a href="/pharmacy/sales" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">{t("Open sales", "فتح المبيعات")}</a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <a key={module.href} href={module.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{t(module.title, module.titleAr)}</h2>
              <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{t(module.status, module.statusAr)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(module.description, module.descriptionAr)}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-primary">{t("Open module →", "فتح القسم ←")}</span>
          </a>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
        <h2 className="text-lg font-semibold">{t("Recommended operating flow", "مسار التشغيل المقترح")}</h2>
        <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <li className="rounded-xl bg-background p-4">{t("1. Receive stock through Purchases or Inventory.", "١. استلم المخزون من المشتريات أو المخزون.")}</li>
          <li className="rounded-xl bg-background p-4">{t("2. Sell from available batches in Sales.", "٢. بع من الباتشات المتاحة في المبيعات.")}</li>
          <li className="rounded-xl bg-background p-4">{t("3. Review profit, reorder needs, and supplier balances in Reports.", "٣. راجع الربح وإعادة الطلب وأرصدة الموردين في التقارير.")}</li>
          <li className="rounded-xl bg-background p-4">{t("4. Use Integration Hub to move between admin, programs, reports, and operations.", "٤. استخدم مركز التكامل للتنقل بين الإدارة والبرامج والتقارير والتشغيل.")}</li>
        </ol>
      </section>
    </main>
  );
}
