import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePatientAuth } from "@/lib/patient-auth";
import { BarChart3, ClipboardList, Handshake, Pill, ShoppingCart, Users, Wallet, AlertCircle, RefreshCw } from "lucide-react";

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

const modules = [
  { label: "Beneficiaries", href: "/ngo/beneficiaries", icon: Users, description: "Profiles, eligibility, conditions, prescriptions, and support history." },
  { label: "Requests", href: "/ngo/requests", icon: ClipboardList, description: "Request intake, medical review, budget review, and approval workflow." },
  { label: "Budgets", href: "/ngo/budgets", icon: Wallet, description: "Project budget, beneficiary allocations, committed spend, and alerts." },
  { label: "Alternatives", href: "/ngo/alternatives", icon: Pill, description: "Generic/brand alternatives by active ingredient and cost." },
  { label: "Procurement", href: "/ngo/procurement", icon: ShoppingCart, description: "Suppliers, tenders, discounts, purchase orders, and deliveries." },
  { label: "Partners", href: "/ngo/partners", icon: Handshake, description: "Pharmacies, pharmaceutical companies, suppliers, and donors." },
  { label: "Impact", href: "/ngo/impact", icon: BarChart3, description: "Treatment months, disease mix, cost indicators, and donor reports." },
];

function money(value: number, currency = "EGP") {
  return `${Math.round(value).toLocaleString()} ${currency}`;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function NgoDashboard() {
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

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, budget) => sum + toNumber(budget.total_budget), 0);
    const committed = budgets.reduce((sum, budget) => sum + toNumber(budget.committed_amount), 0);
    const spent = budgets.reduce((sum, budget) => sum + toNumber(budget.spent_amount), 0);
    const pending = requests.filter((request) => ["submitted", "eligibility_review", "medical_review", "cost_review"].includes(request.status)).length;
    const approvedMonthly = requests.reduce((sum, request) => sum + toNumber(request.approved_monthly_cost), 0);
    return { totalBudget, committed, spent, pending, approvedMonthly, remaining: totalBudget - committed - spent };
  }, [budgets, requests]);

  async function loadNgoDashboard() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !session?.user?.id) {
        setMember(null);
        setError("Please sign in first from the platform portal, then open the NGO dashboard.");
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
        setError("Your account is not linked to an NGO workspace yet. A platform admin should create an NGO workspace and add your user to ngo_members.");
        return;
      }

      const ngoId = activeMember.ngo_id;
      const [beneficiaryRows, requestRows, budgetRows, supplierRows] = await Promise.all([
        supabaseFetch<NgoBeneficiary[]>(`/rest/v1/ngo_beneficiaries?select=id&ngo_id=eq.${ngoId}&limit=1000`),
        supabaseFetch<NgoRequest[]>(`/rest/v1/ngo_medicine_requests?select=id,status,estimated_monthly_cost,approved_monthly_cost,created_at&ngo_id=eq.${ngoId}&order=created_at.desc&limit=500`),
        supabaseFetch<NgoBudget[]>(`/rest/v1/ngo_budgets?select=total_budget,committed_amount,spent_amount,currency&ngo_id=eq.${ngoId}&is_active=eq.true&limit=100`),
        supabaseFetch<NgoSupplier[]>(`/rest/v1/ngo_suppliers?select=id&ngo_id=eq.${ngoId}&is_active=eq.true&limit=500`),
      ]);
      setBeneficiaries(beneficiaryRows);
      setRequests(requestRows);
      setBudgets(budgetRows);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NGO dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNgoDashboard();
  }, [isAuthenticated, session?.access_token, session?.user?.id]);

  const stats = [
    { label: "Beneficiaries", value: beneficiaries.length.toLocaleString(), icon: Users },
    { label: "Pending requests", value: totals.pending.toLocaleString(), icon: ClipboardList },
    { label: "Monthly committed", value: money(totals.approvedMonthly || totals.committed, currency), icon: Wallet },
    { label: "Active suppliers", value: suppliers.length.toLocaleString(), icon: ShoppingCart },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100">NGO Module</Badge>
          <h1 className="text-3xl font-bold">{ngo?.name ?? "NGO Chronic Medicine Support Dashboard"}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {ngo ? `${ngo.city ?? ""}${ngo.city && ngo.country ? ", " : ""}${ngo.country ?? ""} • Your role: ${member?.role}` : "Command center for beneficiaries, requests, budgets, alternatives, procurement, partnerships, and impact reporting."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/ngo">NGO landing</Link></Button>
          <Button variant="outline" onClick={loadNgoDashboard} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>

      {loading && <p className="mb-6 text-muted-foreground">Loading NGO dashboard...</p>}
      {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-sm font-medium text-muted-foreground mt-0.5">{stat.label}</div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{money(totals.remaining, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total budget minus committed and spent amounts.</p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(totals.spent, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded spending from active budgets.</p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(totals.totalBudget, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">All active NGO program budgets.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.href} className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card via-card to-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <module.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                {module.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>
              <Button asChild size="sm" variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-all duration-200">
                <Link href={module.href}>Open module</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-slate-200/60 dark:border-slate-800/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Phase 1 workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {["Beneficiary intake", "Medicine request", "Medical review", "Cost and budget review", "Approval", "Fulfillment tracking"].map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
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
