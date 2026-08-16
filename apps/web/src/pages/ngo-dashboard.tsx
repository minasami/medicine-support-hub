import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import {
  BarChart3,
  ClipboardList,
  Handshake,
  Pill,
  ShoppingCart,
  Users,
  Wallet,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

type NgoMember = {
  id: string;
  role: string;
  ngo_id: string;
  ngo_workspaces?: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    default_currency: string;
  } | null;
};

type NgoBudget = {
  total_budget: number | string | null;
  committed_amount: number | string | null;
  spent_amount: number | string | null;
  currency: string | null;
};

type NgoRequest = {
  id: string;
  status: string;
  estimated_monthly_cost: number | string | null;
  approved_monthly_cost: number | string | null;
  created_at: string;
};

type NgoSupplier = { id: string };
type NgoBeneficiary = { id: string };

function money(value: number, currency = "EGP") {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function NgoDashboard() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [member, setMember] = useState<NgoMember | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<NgoBeneficiary[]>([]);
  const [requests, setRequests] = useState<NgoRequest[]>([]);
  const [budgets, setBudgets] = useState<NgoBudget[]>([]);
  const [suppliers, setSuppliers] = useState<NgoSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ngo = member?.ngo_workspaces ?? null;
  const currency = ngo?.default_currency ?? budgets[0]?.currency ?? "EGP";

  const modules = useMemo(
    () => [
      {
        label: t("Donations", "التبرعات"),
        href: "/ngo/donations",
        icon: Pill,
        description: t(
          "Pharma near-expiry inventory, CSV imports, donor lots, and requests.",
          "مخزون قرب انتهاء الصلاحية، استيراد CSV، دفعات المتبرعين، والطلبات.",
        ),
      },
      {
        label: t("Beneficiaries", "المستفيدون"),
        href: "/ngo/beneficiaries",
        icon: Users,
        description: t(
          "Profiles, eligibility, conditions, prescriptions, and support history.",
          "الملفات والأهلية والحالات والوصفات وسجل الدعم.",
        ),
      },
      {
        label: t("Requests", "الطلبات"),
        href: "/ngo/requests",
        icon: ClipboardList,
        description: t(
          "Request intake, medical review, budget review, and approval workflow.",
          "استقبال الطلبات والمراجعة الطبية ومراجعة الميزانية وسير الموافقة.",
        ),
      },
      {
        label: t("Budgets", "الميزانيات"),
        href: "/ngo/budgets",
        icon: Wallet,
        description: t(
          "Project budget, beneficiary allocations, committed spend, and alerts.",
          "ميزانية المشروع وتخصيصات المستفيدين والالتزامات والتنبيهات.",
        ),
      },
      {
        label: t("Alternatives", "البدائل"),
        href: "/ngo/alternatives",
        icon: Pill,
        description: t(
          "Generic/brand alternatives by active ingredient and cost.",
          "بدائل جنيسة وتجارية حسب المادة الفعالة والتكلفة.",
        ),
      },
      {
        label: t("Procurement", "المشتريات"),
        href: "/ngo/procurement",
        icon: ShoppingCart,
        description: t(
          "Suppliers, tenders, discounts, purchase orders, and deliveries.",
          "الموردون والمناقصات والخصومات وأوامر الشراء والتسليم.",
        ),
      },
      {
        label: t("Partners", "الشركاء"),
        href: "/ngo/partners",
        icon: Handshake,
        description: t(
          "Pharmacies, pharmaceutical companies, suppliers, and donors.",
          "الصيدليات وشركات الأدوية والموردون والمانحون.",
        ),
      },
      {
        label: t("Impact", "الأثر"),
        href: "/ngo/impact",
        icon: BarChart3,
        description: t(
          "Treatment months, disease mix, cost indicators, and donor reports.",
          "أشهر العلاج ومزيج الأمراض ومؤشرات التكلفة وتقارير المانحين.",
        ),
      },
    ],
    [t],
  );

  const workflowSteps = useMemo(
    () => [
      t("Beneficiary intake", "استقبال المستفيد"),
      t("Medicine request", "طلب الدواء"),
      t("Medical review", "المراجعة الطبية"),
      t("Cost and budget review", "مراجعة التكلفة والميزانية"),
      t("Approval", "الموافقة"),
      t("Fulfillment tracking", "تتبع التنفيذ"),
    ],
    [t],
  );

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce(
      (sum, budget) => sum + toNumber(budget.total_budget),
      0,
    );
    const committed = budgets.reduce(
      (sum, budget) => sum + toNumber(budget.committed_amount),
      0,
    );
    const spent = budgets.reduce(
      (sum, budget) => sum + toNumber(budget.spent_amount),
      0,
    );
    const pending = requests.filter((request) =>
      [
        "submitted",
        "eligibility_review",
        "medical_review",
        "cost_review",
      ].includes(request.status),
    ).length;
    const approvedMonthly = requests.reduce(
      (sum, request) => sum + toNumber(request.approved_monthly_cost),
      0,
    );
    return {
      totalBudget,
      committed,
      spent,
      pending,
      approvedMonthly,
      remaining: totalBudget - committed - spent,
    };
  }, [budgets, requests]);

  async function loadNgoDashboard() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !session?.user?.id) {
        setMember(null);
        setError(
          t(
            "Please sign in first from the platform portal, then open the NGO dashboard.",
            "يرجى تسجيل الدخول أولًا من بوابة المنصة، ثم افتح لوحة الجمعية.",
          ),
        );
        return;
      }

      const membershipRows = await supabaseFetch<NgoMember[]>(
        `/rest/v1/ngo_members?select=id,role,ngo_id,ngo_workspaces(id,name,city,country,default_currency)&user_id=eq.${session.user.id}&is_active=eq.true&limit=1`,
      );
      const activeMember = membershipRows[0] ?? null;
      setMember(activeMember);

      if (!activeMember) {
        setBeneficiaries([]);
        setRequests([]);
        setBudgets([]);
        setSuppliers([]);
        setError(
          t(
            "Your account is not linked to an NGO workspace yet. A platform admin should create an NGO workspace and add your user to ngo_members.",
            "حسابك غير مرتبط بمساحة عمل جمعية بعد. ينبغي لمسؤول المنصة إنشاء مساحة عمل وإضافتك إلى ngo_members.",
          ),
        );
        return;
      }

      const ngoId = activeMember.ngo_id;
      const [beneficiaryRows, requestRows, budgetRows, supplierRows] =
        await Promise.all([
          supabaseFetch<NgoBeneficiary[]>(
            `/rest/v1/ngo_beneficiaries?select=id&ngo_id=eq.${ngoId}&limit=1000`,
          ),
          supabaseFetch<NgoRequest[]>(
            `/rest/v1/ngo_medicine_requests?select=id,status,estimated_monthly_cost,approved_monthly_cost,created_at&ngo_id=eq.${ngoId}&order=created_at.desc&limit=500`,
          ),
          supabaseFetch<NgoBudget[]>(
            `/rest/v1/ngo_budgets?select=total_budget,committed_amount,spent_amount,currency&ngo_id=eq.${ngoId}&is_active=eq.true&limit=100`,
          ),
          supabaseFetch<NgoSupplier[]>(
            `/rest/v1/ngo_suppliers?select=id&ngo_id=eq.${ngoId}&is_active=eq.true&limit=500`,
          ),
        ]);
      setBeneficiaries(beneficiaryRows);
      setRequests(requestRows);
      setBudgets(budgetRows);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Failed to load NGO dashboard.", "تعذّر تحميل لوحة الجمعية."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNgoDashboard();
  }, [isAuthenticated, session?.access_token, session?.user?.id]);

  const stats = [
    {
      label: t("Beneficiaries", "المستفيدون"),
      value: beneficiaries.length.toLocaleString(),
      icon: Users,
    },
    {
      label: t("Pending requests", "طلبات معلّقة"),
      value: totals.pending.toLocaleString(),
      icon: ClipboardList,
    },
    {
      label: t("Monthly committed", "التزام شهري"),
      value: money(totals.approvedMonthly || totals.committed, currency),
      icon: Wallet,
    },
    {
      label: t("Active suppliers", "موردون نشطون"),
      value: suppliers.length.toLocaleString(),
      icon: ShoppingCart,
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {t("NGO operations", "عمليات الجمعيات")}
          </Badge>
          <h1 className="text-3xl font-bold">
            {ngo?.name ??
              t(
                "NGO Chronic Medicine Support Dashboard",
                "لوحة دعم أدوية الأمراض المزمنة للجمعيات",
              )}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {ngo
              ? `${ngo.city ?? ""}${ngo.city && ngo.country ? ", " : ""}${ngo.country ?? ""} • ${t("Your role", "دورك")}: ${member?.role}`
              : t(
                  "Command center for beneficiaries, requests, budgets, alternatives, procurement, partnerships, and impact reporting.",
                  "مركز قيادة للمستفيدين والطلبات والميزانيات والبدائل والمشتريات والشراكات وتقارير الأثر.",
                )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/ngo">{t("NGO landing", "صفحة الجمعية")}</Link>
          </Button>
          <Button
            variant="outline"
            onClick={loadNgoDashboard}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
        </div>
      </div>

      {loading && (
        <p className="mb-6 text-muted-foreground">
          {t("Loading NGO dashboard...", "جاري تحميل لوحة الجمعية...")}
        </p>
      )}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5"
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-2xl font-bold tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-muted-foreground mt-0.5">
                  {stat.label}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/40 p-3 text-emerald-600 dark:text-emerald-400">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Budget remaining", "الميزانية المتبقية")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {money(totals.remaining, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "Total budget minus committed and spent amounts.",
                "إجمالي الميزانية ناقص المبالغ الملتزم بها والمنفقة.",
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Committed", "ملتزم")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {money(totals.committed, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "Reserved for approved ongoing support.",
                "محجوز للدعم المعتمد المستمر.",
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Total budget", "إجمالي الميزانية")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {money(totals.totalBudget, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "All active NGO program budgets.",
                "كل ميزانيات برامج الجمعية النشطة.",
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card
            key={module.href}
            className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card via-card to-emerald-500/5"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <module.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                {module.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {module.description}
              </p>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Link href={module.href}>{t("Open module", "فتح الوحدة")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-slate-200/60 dark:border-slate-800/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t("Phase 1 workflow", "سير عمل المرحلة الأولى")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {index + 1}
                </div>
                <div className="font-semibold text-sm">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
