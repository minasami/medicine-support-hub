import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Shield } from "lucide-react";
import { adminNavByCategory } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function AdminShell({ title, subtitle, children, actions }: Props) {
  const [location] = useLocation();
  const groups = adminNavByCategory();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin/hub"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"
            >
              <Shield className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LayoutDashboard className="h-3.5 w-3.5" />
                <Link href="/admin/hub" className="hover:text-foreground">
                  Platform admin
                </Link>
                <span>/</span>
                <span className="truncate text-foreground font-medium">{title}</span>
              </div>
              {subtitle && (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-5">
            {groups.map((g) => (
              <div key={g.category}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active =
                      location === item.href ||
                      (item.href !== "/admin" && location.startsWith(item.href));
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block rounded-lg px-2.5 py-1.5 text-sm transition",
                            active
                              ? "bg-emerald-600/10 font-semibold text-emerald-800 dark:text-emerald-200"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
