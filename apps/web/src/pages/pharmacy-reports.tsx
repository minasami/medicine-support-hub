const reports = [
  {
    title: "Finance period report",
    href: "/pharmacy/finance",
    description: "Export sales, expenses, profit, business dates, and system timestamps by reporting period.",
    exportLabel: "Finance CSV",
  },
  {
    title: "Inventory stock report",
    href: "/pharmacy/inventory",
    description: "Export current stock, reorder levels, low-stock status, nearest expiry, and selling prices.",
    exportLabel: "Stock CSV",
  },
  {
    title: "Reorder planning report",
    href: "/pharmacy/inventory",
    description: "Review items at or below reorder level and export suggested reorder quantities.",
    exportLabel: "Reorder CSV",
  },
  {
    title: "Inventory movement report",
    href: "/pharmacy/inventory",
    description: "Export recent stock movement history with movement type, quantity, reference, note, and timestamp.",
    exportLabel: "Movements CSV",
  },
  {
    title: "Purchase invoices report",
    href: "/pharmacy/purchases",
    description: "Export supplier purchase invoices with payment status, business date, and system timestamp.",
    exportLabel: "Invoices CSV",
  },
  {
    title: "Supplier balance report",
    href: "/pharmacy/purchases",
    description: "Review supplier opening balances, purchase totals, paid totals, and balance due.",
    exportLabel: "Supplier balances CSV",
  },
  {
    title: "Sales report",
    href: "/pharmacy/sales",
    description: "Export latest sales with payment method, total amount, gross profit, and system timestamp.",
    exportLabel: "Sales CSV",
  },
  {
    title: "Branch access report",
    href: "/pharmacy/members",
    description: "Export branch member roles, active status, and access creation timestamps.",
    exportLabel: "Access CSV",
  },
];

export default function PharmacyReports() {
  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pharmacy reports</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports and exports hub</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            One consistent place to find finance, stock, movement, purchase, supplier, sales, and branch-access reporting.
          </p>
        </div>
        <a href="/pharmacy" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted">
          Back to pharmacy
        </a>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => <a key={report.title} href={report.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{report.title}</h2>
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{report.exportLabel}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{report.description}</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">Open source module →</span>
      </a>)}
    </section>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">Recommended reporting rhythm</h2>
      <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
        <li className="rounded-xl bg-background p-4">Daily: review sales, cash, and stock movements.</li>
        <li className="rounded-xl bg-background p-4">Weekly: check reorder planning and supplier balances.</li>
        <li className="rounded-xl bg-background p-4">Monthly: export finance period reports.</li>
        <li className="rounded-xl bg-background p-4">When staff changes: export branch access.</li>
      </ol>
    </section>
  </main>;
}
