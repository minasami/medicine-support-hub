import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_NAV, adminNavByCategory } from "@/lib/admin-nav";
import { listCompanyClaims } from "@/lib/company-claims-data";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

type QueueStat = {
  key: string;
  label: string;
  count: number | null;
  href: string;
  tone: "urgent" | "normal" | "ok";
  hint?: string;
};

export default function AdminCommandHub() {
  const { t } = useLanguage();
  const { isAuthenticated, profile, session } = usePatientAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<number | null>(null);
  const [storageMode, setStorageMode] = useState<string>("");

  const role = String((profile as { role?: string } | null)?.role || "").toUpperCase();
  const isAdmin =
    role.includes("ADMIN") ||
    role === "PLATFORM_ADMIN" ||
    role === "SUPER_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { claims, storage } = await listCompanyClaims({
        status: "pending",
        limit: 100,
      });
      setPendingClaims(claims.length);
      setStorageMode(storage);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load admin queues");
      setPendingClaims(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queues: QueueStat[] = [
    {
      key: "claims",
      label: t("Company rep claims", "طلبات ممثلي الشركات"),
      count: pendingClaims,
      href: "/admin/industry",
      tone:
        pendingClaims == null
          ? "normal"
          : pendingClaims > 0
            ? "urgent"
            : "ok",
      hint: storageMode ? `Source: ${storageMode}` : undefined,
    },
    {
      key: "enrichment",
      label: t("Medicine enrichment", "إثراء الأدوية"),
      count: null,
      href: "/admin/medicine-enrichment",
      tone: "normal",
      hint: t("DrugEye · tariffs · prices", "DrugEye · التعريفة · الأسعار"),
    },
    {
      key: "mapping",
      label: t("Catalog ID mapping", "ربط معرفات الكتالوج"),
      count: null,
      href: "/admin/mapping-accuracy",
      tone: "normal",
      hint: t("Static → live accuracy", "دقة الربط الثابت → الحي"),
    },
    {
      key: "control",
      label: t("Control center", "مركز التحكم"),
      count: null,
      href: "/admin/control-center",
      tone: "normal",
      hint: t("Duplicates · ingestion", "التكرار · الاستيراد"),
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <Shield className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="text-xl font-bold">{t("Sign in required", "تسجيل الدخول مطلوب")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Platform admin tools require an authenticated admin account.",
            "أدوات مشرف المنصة تتطلب حساب مشرف مسجل.",
          )}
        </p>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/patient-auth?next=/admin/hub">
            {t("Sign in", "تسجيل الدخول")}
          </Link>
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Your account does not have platform admin role. Contact a super admin if you need access.",
              "حسابك لا يملك صلاحية مشرف المنصة.",
            )}
            {role ? ` (role: ${role})` : ""}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const groups = adminNavByCategory();

  return (
    <AdminShell
      title={t("Command hub", "مركز القيادة")}
      subtitle={t(
        "Queues, encyclopedia ops, and industry governance in one place",
        "الطوابير وعمليات الموسوعة وحوكمة الصناعة في مكان واحد",
      )}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("Refresh", "تحديث")}
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queues.map((q) => (
          <Link key={q.key} href={q.href}>
            <Card
              className={
                "h-full transition hover:border-emerald-500/50 hover:shadow-md " +
                (q.tone === "urgent"
                  ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
                  : q.tone === "ok"
                    ? "border-emerald-500/30"
                    : "")
              }
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{q.label}</span>
                  {q.tone === "urgent" && (
                    <Badge className="bg-amber-600 text-white text-[10px]">Action</Badge>
                  )}
                  {q.tone === "ok" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {q.count == null ? "—" : q.count.toLocaleString()}
                </div>
                {q.hint && (
                  <p className="text-[11px] text-muted-foreground">{q.hint}</p>
                )}
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 pt-1">
                  {t("Open", "فتح")}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              {t("Recommended workflow", "سير العمل الموصى به")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">
                  {t("Clear industry claims", "مراجعة طلبات ممثلي الشركات")}
                </span>{" "}
                — {t("approve Eva / Med-Care style reps before they edit live monographs.", "اعتمد الممثلين قبل تعديل المونوغراف الحي.")}
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {t("Enrich & map", "إثراء وربط")}
                </span>{" "}
                — {t("DrugEye / MOH tariffs, then verify static→live ID map accuracy.", "DrugEye / تعريفة الصحة ثم تحقق من دقة الربط.")}
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {t("Governance", "الحوكمة")}
                </span>{" "}
                — {t("Merge duplicates and review ingestion candidates in Control Center.", "دمج التكرار ومراجعة المرشحين في مركز التحكم.")}
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/admin/industry">
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("Claims queue", "طابور الطلبات")}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/medicine-enrichment">
                  <Database className="mr-1.5 h-3.5 w-3.5" />
                  {t("Enrichment", "الإثراء")}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/control-center">
                  <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                  {t("Control center", "مركز التحكم")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              {t("Session", "الجلسة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">{t("Signed in", "المستخدم")}</div>
              <div className="font-medium truncate">
                {session?.user?.email || profile?.full_name || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("Role", "الدور")}</div>
              <Badge variant="outline" className="mt-0.5">
                {role || "unknown"}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("Claims storage", "تخزين الطلبات")}</div>
              <div className="font-medium">{storageMode || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("All admin tools", "كل أدوات المشرف")}
        </h2>
        {groups.map((g) => (
          <div key={g.category}>
            <h3 className="mb-2 text-xs font-semibold text-foreground">{g.label}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border bg-card p-3 transition hover:border-emerald-500/40 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="text-[11px] text-muted-foreground">
        {ADMIN_NAV.length} tools registered ·{" "}
        <Link href="/medicines" className="underline hover:text-foreground">
          Public encyclopedia
        </Link>
      </p>
    </AdminShell>
  );
}
