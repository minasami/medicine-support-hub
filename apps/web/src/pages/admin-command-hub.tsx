import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AdminAutomatePanel } from "@/components/admin-automate-panel";
import { AdminShell } from "@/components/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_NAV, adminNavByCategory } from "@/lib/admin-nav";
import {
  listCompanyClaims,
  reviewCompanyClaim,
  type CompanyClaimRecord,
} from "@/lib/company-claims-data";
import { isPlatformAdminUser } from "@/lib/platform-admin";
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

type MapStats = {
  mapped?: number;
  static_total?: number;
  accuracy_score_percent?: number;
};

export default function AdminCommandHub() {
  const { t } = useLanguage();
  const { isAuthenticated, profile, session } = usePatientAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<CompanyClaimRecord[]>([]);
  const [claimCounts, setClaimCounts] = useState({
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [storageMode, setStorageMode] = useState<string>("");
  const [mapStats, setMapStats] = useState<MapStats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const email =
    normalizeSessionEmail(session) ||
    String((profile as { email?: string } | null)?.email || "");
  const profileRole = String((profile as { role?: string } | null)?.role || "");

  const isAdmin = useMemo(
    () =>
      isPlatformAdminUser({
        email,
        profileRole,
      }),
    [email, profileRole],
  );

  const roleDisplay = profileRole
    ? profileRole.toUpperCase()
    : isAdmin
      ? "PLATFORM_ADMIN (email)"
      : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ claims, storage }, allRes, mapJson] = await Promise.all([
        listCompanyClaims({ status: "pending", limit: 100 }),
        listCompanyClaims({ limit: 200 }),
        fetch("/data/static-to-live-id-map.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      setPendingClaims(claims);
      setStorageMode(storage);

      const all = allRes.claims || [];
      const counts = {
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        total: all.length,
      };
      for (const c of all) {
        const s = String(c.status || "").toLowerCase();
        if (s === "pending") counts.pending += 1;
        else if (s === "under_review") counts.under_review += 1;
        else if (s === "approved") counts.approved += 1;
        else if (s === "rejected") counts.rejected += 1;
      }
      if (claims.length > counts.pending) counts.pending = claims.length;
      setClaimCounts(counts);

      if (mapJson?.stats) {
        setMapStats({
          mapped: Number(mapJson.stats.mapped ?? mapJson.stats.names ?? 0),
          static_total: Number(mapJson.stats.static_total ?? 0),
          accuracy_score_percent: Number(
            mapJson.stats.accuracy_score_percent ??
              mapJson.accuracy_summary?.accuracy_score_percent ??
              0,
          ),
        });
      } else {
        setMapStats(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load admin queues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function oneClickReview(
    claimId: string,
    decision: "approved" | "rejected",
  ) {
    setBusyId(claimId);
    setMessage(null);
    setError(null);
    try {
      const saved = await reviewCompanyClaim(
        claimId,
        decision,
        decision === "approved"
          ? "One-click approve from command hub"
          : "One-click reject from command hub",
      );
      if (!saved) throw new Error("Review failed — claim not found");
      setMessage(
        decision === "approved"
          ? t(`Approved claim ${claimId}`, `تم اعتماد الطلب ${claimId}`)
          : t(`Rejected claim ${claimId}`, `تم رفض الطلب ${claimId}`),
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  const unmatchedStatic =
    mapStats?.static_total != null && mapStats?.mapped != null
      ? Math.max(0, mapStats.static_total - mapStats.mapped)
      : null;

  const queues: QueueStat[] = [
    {
      key: "claims",
      label: t("Pending claims", "طلبات معلقة"),
      count: claimCounts.pending,
      href: "/admin/industry",
      tone: claimCounts.pending > 0 ? "urgent" : "ok",
      hint: storageMode
        ? `${storageMode} · ${claimCounts.under_review} under review`
        : undefined,
    },
    {
      key: "approved",
      label: t("Approved reps", "ممثلون معتمدون"),
      count: claimCounts.approved,
      href: "/admin/industry",
      tone: "ok",
      hint: t(`${claimCounts.rejected} rejected`, `${claimCounts.rejected} مرفوض`),
    },
    {
      key: "mapping",
      label: t("Unmapped static IDs", "معرّفات ثابتة غير مربوطة"),
      count: unmatchedStatic,
      href: "/admin/mapping-accuracy",
      tone:
        unmatchedStatic == null
          ? "normal"
          : unmatchedStatic > 100
            ? "urgent"
            : "normal",
      hint: mapStats?.accuracy_score_percent
        ? `${mapStats.accuracy_score_percent}% accuracy · ${mapStats.mapped}/${mapStats.static_total}`
        : t("Open mapping dashboard", "افتح لوحة الربط"),
    },
    {
      key: "enrichment",
      label: t("Medicine enrichment", "إثراء الأدوية"),
      count: null,
      href: "/admin/medicine-enrichment",
      tone: "normal",
      hint: t("DrugEye · tariffs · prices", "DrugEye · التعريفة · الأسعار"),
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
      <div className="container mx-auto max-w-lg px-4 py-16 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Your account does not have platform admin role. Contact a super admin if you need access.",
              "حسابك لا يملك صلاحية مشرف المنصة.",
            )}
            {roleDisplay ? ` (role: ${roleDisplay})` : ""}
            {email ? ` · ${email}` : ""}
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          {t(
            "Founder accounts such as jesussavedmina@gmail.com are granted admin automatically after deploy of the platform-admin fix.",
            "حسابات المؤسس مثل jesussavedmina@gmail.com تُمنح صلاحية المشرف تلقائياً بعد نشر إصلاح المنصة.",
          )}
        </p>
      </div>
    );
  }

  const groups = adminNavByCategory();

  return (
    <AdminShell
      title={t("Command hub", "مركز القيادة")}
      subtitle={t(
        "One-click claims, automated safe pack, live backlogs",
        "اعتماد فوري، حزمة آمنة مؤتمتة، وطوابير مباشرة",
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
      {message && (
        <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <AlertDescription>{message}</AlertDescription>
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
                  {q.tone === "ok" && q.count === 0 && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {loading && q.count == null
                    ? "…"
                    : q.count == null
                      ? "—"
                      : q.count.toLocaleString()}
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

      {/* Automated bulk actions — safe pack, score-based approve/reject */}
      <AdminAutomatePanel
        actorEmail={email || undefined}
        onCompleted={() => {
          void load();
        }}
      />

      <Card className="border-amber-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-700" />
            {t("One-click claim approval", "اعتماد الطلبات بنقرة واحدة")}
            <Badge variant="outline" className="ml-auto text-[10px]">
              {pendingClaims.length} pending
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && pendingClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Loading claims…", "جاري التحميل…")}</p>
          ) : pendingClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t("No pending company representative claims.", "لا توجد طلبات معلقة لممثلي الشركات.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingClaims.slice(0, 12).map((c) => {
                const id = c.id || "";
                return (
                  <li
                    key={id || `${c.work_email}-${c.company_slug}`}
                    className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {c.proposed_company_name || c.company_name || c.company_slug}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.work_email}
                        {c.role_title ? ` · ${c.role_title}` : ""}
                        {c.company_slug ? ` · ${c.company_slug}` : ""}
                        {typeof c.verification_score === "number"
                          ? ` · score ${c.verification_score}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        disabled={!id || busyId === id}
                        onClick={() => void oneClickReview(id, "approved")}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {busyId === id
                          ? t("…", "…")
                          : t("Approve", "اعتماد")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 gap-1"
                        disabled={!id || busyId === id}
                        onClick={() => void oneClickReview(id, "rejected")}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("Reject", "رفض")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pendingClaims.length > 12 && (
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <Link href="/admin/industry">
                {t(
                  `View all ${pendingClaims.length} in industry queue →`,
                  `عرض كل ${pendingClaims.length} في طابور الصناعة ←`,
                )}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

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
                  {t("Run safe pack", "تشغيل الحزمة الآمنة")}
                </span>{" "}
                — {t(
                  "Automate panel above: refresh backlog + auto-approve score ≥ 85 (dry-run first if unsure).",
                  "لوحة الأتمتة أعلاه: تحديث الطابور + اعتماد تلقائي للدرجة ≥ 85 (جرّب Dry-run أولاً).",
                )}
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {t("Clear remaining claims", "مراجعة الطلبات المتبقية")}
                </span>{" "}
                — {t(
                  "use one-click Approve/Reject for medium-score rows or the full industry queue.",
                  "استخدم الاعتماد/الرفض السريع للدرجات المتوسطة أو طابور الصناعة الكامل.",
                )}
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {t("Enrich & map", "إثراء وربط")}
                </span>{" "}
                — {t(
                  "DrugEye / MOH tariffs, then verify static→live ID map accuracy.",
                  "DrugEye / تعريفة الصحة ثم تحقق من دقة الربط.",
                )}
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {t("Governance", "الحوكمة")}
                </span>{" "}
                — {t(
                  "Merge duplicates and review ingestion candidates in Control Center.",
                  "دمج التكرار ومراجعة المرشحين في مركز التحكم.",
                )}
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/admin/industry">
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("Full claims queue", "طابور الطلبات الكامل")}
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
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/automation">
                  {t("Scheduled automation", "الأتمتة المجدولة")}
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
                {email || profile?.full_name || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("Role", "الدور")}</div>
              <Badge variant="outline" className="mt-0.5">
                {roleDisplay || "PLATFORM_ADMIN"}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("Claims storage", "تخزين الطلبات")}</div>
              <div className="font-medium">{storageMode || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("Claim backlog", "مخزون الطلبات")}</div>
              <div className="font-medium text-xs">
                {claimCounts.pending}p / {claimCounts.under_review}r /{" "}
                {claimCounts.approved}a / {claimCounts.rejected}x · total{" "}
                {claimCounts.total}
              </div>
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
        {ADMIN_NAV.length} tools ·{" "}
        <Link href="/admin/legacy" className="underline hover:text-foreground">
          Legacy ops portal
        </Link>
        {" · "}
        <Link href="/medicines" className="underline hover:text-foreground">
          Public encyclopedia
        </Link>
      </p>
    </AdminShell>
  );
}

function normalizeSessionEmail(session: unknown): string {
  try {
    const s = session as {
      user?: { email?: string };
      email?: string;
    } | null;
    return String(s?.user?.email || s?.email || "")
      .toLowerCase()
      .trim();
  } catch {
    return "";
  }
}
