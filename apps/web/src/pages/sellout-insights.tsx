import { Link } from "wouter";
import snapshot from "@/data/sellout-mounjaro.json";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat("en-EG").format(Math.round(n));
}

function money(n: number) {
  return `EGP ${new Intl.NumberFormat("en-EG").format(Math.round(n / 1_000_000))}m`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function Bar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">
          {fmt(value)} ({share.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, share)}%` }} />
      </div>
    </div>
  );
}

export default function SelloutInsightsPage() {
  const { t } = useLanguage();
  const data = snapshot;
  const net = data.totals.net_units;
  const maxMonth = Math.max(...data.monthly.map((m) => m.units));

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("Sell-out insights", "لمحة المبيعات")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.brand} · {data.inn} · {data.period.from} → {data.period.to}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t("Internal", "داخلي")}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">{t("Back to admin", "العودة للإدارة")}</Link>
          </Button>
        </div>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {t(data.disclaimer_en, data.disclaimer_ar)} {t("Accounts are ranked, not named.", "الحسابات مرتبة بلا أسماء.")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Net units", "وحدات صافية")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmt(net)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{money(data.totals.net_value_egp)} @ EGP {fmt(data.unit_value_egp)}/{t("unit", "وحدة")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Return rate", "معدل المرتجع")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{pct(data.totals.return_rate_of_gross)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmt(Math.abs(data.totals.return_units))} / {fmt(data.totals.gross_sales_units)} {t("gross", "إجمالي")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Top account", "أكبر حساب")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{pct(data.top_account_share)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("of four-month net", "من صافي الأربعة أشهر")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Doors / bricks", "نقاط / مناطق")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmt(data.totals.customers)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.totals.bricks} {t("bricks", "منطقة")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Monthly net units", "الوحدات الشهرية")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.monthly.map((row) => (
            <div key={row.month} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{row.month}</span>
                <span className="font-mono">{fmt(row.units)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(row.units / maxMonth) * 100}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Strength mix", "توزيع الجرعات")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sku.map((row) => (
              <Bar key={row.sku} label={row.sku} value={row.units} total={net} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Channel", "القناة")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.channel.map((row) => (
              <Bar key={row.name} label={row.name} value={row.units} total={net} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Distributor", "الموزع")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.distributor.map((row) => (
              <Bar key={row.name} label={row.name} value={row.units} total={net} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Top bricks", "أكبر المناطق")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_bricks.map((row) => (
              <Bar key={row.brick} label={row.brick.replace("BRICK", "B")} value={row.units} total={net} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Ranked accounts (names withheld)", "حسابات مرتبة (بدون أسماء)")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.top_accounts.map((row) => (
            <Bar key={row.rank} label={row.label} value={row.units} total={net} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Calls", "القراءة")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {data.calls.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
