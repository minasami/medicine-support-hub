const modules = [
  {
    title: "Finance reporting",
    href: "/pharmacy/finance",
    description: "Track sales, expenses, and profit by reporting period.",
    status: "Live",
  },
  {
    title: "Team access",
    href: "/pharmacy/members",
    description: "Manage accountant and manager access for each pharmacy branch.",
    status: "Live",
  },
  {
    title: "Branch settings",
    href: "/pharmacy/settings",
    description: "Review active branches and deactivate duplicate or test branches safely.",
    status: "Admin",
  },
  {
    title: "Inventory",
    href: "/pharmacy/inventory",
    description: "Review medicine stock movement and inventory readiness.",
    status: "Module",
  },
  {
    title: "Purchases",
    href: "/pharmacy/purchases",
    description: "Prepare pharmacy purchasing workflows and supplier tracking.",
    status: "Module",
  },
  {
    title: "Training",
    href: "/pharmacy/training",
    description: "Keep branch staff aligned on operating procedures and system use.",
    status: "Module",
  },
];

export default function PharmacyPortal() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pharmacy operations</p>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pharmacy operations hub</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Manage branch finance, accountant access, inventory, purchases, team training, and branch settings from one stable entry point.
            </p>
          </div>
          <a
            href="/pharmacy/finance"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Open finance
          </a>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <a
            key={module.href}
            href={module.href}
            className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{module.title}</h2>
              <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{module.status}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{module.description}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-primary">Open module →</span>
          </a>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
        <h2 className="text-lg font-semibold">Recommended operating flow</h2>
        <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <li className="rounded-xl bg-background p-4">1. Create or select the pharmacy branch.</li>
          <li className="rounded-xl bg-background p-4">2. Add the accountant or manager from Team access.</li>
          <li className="rounded-xl bg-background p-4">3. Record daily sales and expenses from Finance reporting.</li>
        </ol>
      </section>
    </main>
  );
}
