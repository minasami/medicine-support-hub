import { useLanguage } from "@/lib/i18n";

const reports = [
  {
    title: "Finance period report",
    titleAr: "تقرير الفترة المالية",
    href: "/pharmacy/finance",
    description: "Export sales, expenses, profit, business dates, and system timestamps by reporting period.",
    descriptionAr: "تصدير المبيعات والمصروفات والربح وتواريخ التشغيل وتوقيتات النظام حسب فترة التقرير.",
    exportLabel: "Finance CSV",
    exportLabelAr: "تصدير المالية",
  },
  {
    title: "Inventory stock report",
    titleAr: "تقرير المخزون الحالي",
    href: "/pharmacy/inventory",
    description: "Export current stock, reorder levels, low-stock status, nearest expiry, and selling prices.",
    descriptionAr: "تصدير المخزون الحالي وحدود إعادة الطلب وحالة النقص وأقرب تاريخ انتهاء وأسعار البيع.",
    exportLabel: "Stock CSV",
    exportLabelAr: "تصدير المخزون",
  },
  {
    title: "Reorder planning report",
    titleAr: "تقرير خطة إعادة الطلب",
    href: "/pharmacy/inventory",
    description: "Review items at or below reorder level and export suggested reorder quantities.",
    descriptionAr: "مراجعة الأصناف التي وصلت أو انخفضت عن حد إعادة الطلب وتصدير الكميات المقترحة للشراء.",
    exportLabel: "Reorder CSV",
    exportLabelAr: "تصدير إعادة الطلب",
  },
  {
    title: "Inventory movement report",
    titleAr: "تقرير حركة المخزون",
    href: "/pharmacy/inventory",
    description: "Export recent stock movement history with movement type, quantity, reference, note, and timestamp.",
    descriptionAr: "تصدير آخر حركات المخزون مع نوع الحركة والكمية والمرجع والملاحظة والتوقيت.",
    exportLabel: "Movements CSV",
    exportLabelAr: "تصدير الحركات",
  },
  {
    title: "Purchase invoices report",
    titleAr: "تقرير فواتير الشراء",
    href: "/pharmacy/purchases",
    description: "Export supplier purchase invoices with payment status, business date, and system timestamp.",
    descriptionAr: "تصدير فواتير شراء الموردين مع حالة الدفع وتاريخ العملية وتوقيت النظام.",
    exportLabel: "Invoices CSV",
    exportLabelAr: "تصدير الفواتير",
  },
  {
    title: "Supplier balance report",
    titleAr: "تقرير أرصدة الموردين",
    href: "/pharmacy/purchases",
    description: "Review supplier opening balances, purchase totals, paid totals, and balance due.",
    descriptionAr: "مراجعة الرصيد الافتتاحي للموردين وإجمالي المشتريات والمدفوع والمتبقي.",
    exportLabel: "Supplier balances CSV",
    exportLabelAr: "تصدير أرصدة الموردين",
  },
  {
    title: "Sales report",
    titleAr: "تقرير المبيعات",
    href: "/pharmacy/sales",
    description: "Export latest sales with payment method, total amount, gross profit, and system timestamp.",
    descriptionAr: "تصدير آخر المبيعات مع طريقة الدفع والإجمالي ومجمل الربح وتوقيت النظام.",
    exportLabel: "Sales CSV",
    exportLabelAr: "تصدير المبيعات",
  },
  {
    title: "Branch access report",
    titleAr: "تقرير صلاحيات الفرع",
    href: "/pharmacy/members",
    description: "Export branch member roles, active status, and access creation timestamps.",
    descriptionAr: "تصدير أدوار أعضاء الفرع وحالة التفعيل وتوقيتات إنشاء الصلاحيات.",
    exportLabel: "Access CSV",
    exportLabelAr: "تصدير الصلاحيات",
  },
];

export default function PharmacyReports() {
  const { t } = useLanguage();

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Pharmacy reports", "تقارير الصيدلية")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Reports and exports hub", "مركز التقارير والتصدير")}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {t("One consistent place to find finance, stock, movement, purchase, supplier, sales, and branch-access reporting.", "مكان موحد للوصول إلى تقارير المالية والمخزون والحركات والمشتريات والموردين والمبيعات وصلاحيات الفروع.")}
          </p>
        </div>
        <a href="/pharmacy" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted">
          {t("Back to pharmacy", "العودة إلى الصيدلية")}
        </a>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => <a key={report.title} href={report.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{t(report.title, report.titleAr)}</h2>
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{t(report.exportLabel, report.exportLabelAr)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(report.description, report.descriptionAr)}</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">{t("Open source module →", "فتح القسم المرتبط ←")}</span>
      </a>)}
    </section>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">{t("Recommended reporting rhythm", "إيقاع المتابعة المقترح")}</h2>
      <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
        <li className="rounded-xl bg-background p-4">{t("Daily: review sales, cash, and stock movements.", "يوميًا: راجع المبيعات والنقدية وحركات المخزون.")}</li>
        <li className="rounded-xl bg-background p-4">{t("Weekly: check reorder planning and supplier balances.", "أسبوعيًا: راجع خطة إعادة الطلب وأرصدة الموردين.")}</li>
        <li className="rounded-xl bg-background p-4">{t("Monthly: export finance period reports.", "شهريًا: صدّر تقارير الفترة المالية.")}</li>
        <li className="rounded-xl bg-background p-4">{t("When staff changes: export branch access.", "عند تغيير الموظفين: صدّر تقرير صلاحيات الفرع.")}</li>
      </ol>
    </section>
  </main>;
}
