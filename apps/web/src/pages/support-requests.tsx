import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Membership = {
  organization_id: string;
  organizations: { name: string; currency: string } | null;
};
type Program = { id: string; name: string };
type Beneficiary = { id: string; full_name: string; program_id: string | null };
type SupportRequest = {
  id: string;
  request_number: string;
  status: string;
  priority: string;
  medicine_summary: string;
  requested_months: number;
  estimated_monthly_cost: number | string;
  approved_monthly_cost: number | string | null;
  currency: string;
  created_at: string;
  beneficiaries?: { full_name: string } | null;
  programs?: { name: string } | null;
};

const STATUSES = [
  "draft",
  "submitted",
  "eligibility_review",
  "medical_review",
  "cost_review",
  "approved",
  "rejected",
  "procurement",
  "dispensing",
  "delivered",
  "closed",
] as const;

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُقدَّم",
  eligibility_review: "مراجعة الأهلية",
  medical_review: "مراجعة طبية",
  cost_review: "مراجعة التكلفة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  procurement: "مشتريات",
  dispensing: "صرف",
  delivered: "تم التسليم",
  closed: "مغلق",
};

const PRIORITY_AR: Record<string, string> = {
  low: "منخفض",
  standard: "عادي",
  high: "مرتفع",
  urgent: "عاجل",
};

export default function SupportRequestsPage() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [draft, setDraft] = useState({
    beneficiary_id: "",
    program_id: "",
    medicine_summary: "",
    clinical_notes: "",
    requested_months: "1",
    estimated_monthly_cost: "0",
    priority: "standard",
    currency: "EGP",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      requests.filter((r) => !["delivered", "closed", "rejected"].includes(r.status))
        .length,
    [requests],
  );

  function statusLabel(status: string) {
    return t(status.replaceAll("_", " "), STATUS_AR[status] || status);
  }

  function priorityLabel(priority: string) {
    return t(priority, PRIORITY_AR[priority] || priority);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !session?.user?.id) {
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      }
      const ms = await supabaseFetch<Membership[]>(
        `/rest/v1/organization_members?select=organization_id,organizations(name,currency)&user_id=eq.${session.user.id}&is_active=eq.true&limit=1`,
      );
      const m = ms[0] ?? null;
      setMembership(m);
      if (!m) {
        throw new Error(
          t("No organization workspace found.", "لم يتم العثور على مساحة عمل للمنظمة."),
        );
      }
      const [p, b, r] = await Promise.all([
        supabaseFetch<Program[]>(
          `/rest/v1/programs?select=id,name&organization_id=eq.${m.organization_id}&order=name.asc`,
        ),
        supabaseFetch<Beneficiary[]>(
          `/rest/v1/beneficiaries?select=id,full_name,program_id&organization_id=eq.${m.organization_id}&order=full_name.asc`,
        ),
        supabaseFetch<SupportRequest[]>(
          `/rest/v1/support_requests?select=id,request_number,status,priority,medicine_summary,requested_months,estimated_monthly_cost,approved_monthly_cost,currency,created_at,beneficiaries(full_name),programs(name)&organization_id=eq.${m.organization_id}&order=created_at.desc`,
        ),
      ]);
      setPrograms(p);
      setBeneficiaries(b);
      setRequests(r);
      setDraft((d) => ({
        ...d,
        currency: m.organizations?.currency || "EGP",
      }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to load requests.", "تعذّر تحميل الطلبات."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, session?.access_token, session?.user?.id]);

  async function createRequest() {
    if (!membership || !draft.beneficiary_id || !draft.medicine_summary.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/support_requests`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: membership.organization_id,
          beneficiary_id: draft.beneficiary_id,
          program_id: draft.program_id || null,
          medicine_summary: draft.medicine_summary.trim(),
          clinical_notes: draft.clinical_notes.trim() || null,
          requested_months: Number(draft.requested_months || 1),
          estimated_monthly_cost: Number(draft.estimated_monthly_cost || 0),
          priority: draft.priority,
          currency: draft.currency,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }),
      });
      setDraft({
        ...draft,
        beneficiary_id: "",
        program_id: "",
        medicine_summary: "",
        clinical_notes: "",
        requested_months: "1",
        estimated_monthly_cost: "0",
        priority: "standard",
      });
      setMessage(t("Support request submitted.", "تم إرسال طلب الدعم."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to create request.", "تعذّر إنشاء الطلب."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(r: SupportRequest, status: string) {
    if (!membership || status === r.status) return;
    setSaving(true);
    setError(null);
    try {
      await supabaseFetch(`/rest/v1/support_requests?id=eq.${r.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status,
          approved_at:
            status === "approved" ? new Date().toISOString() : undefined,
          closed_at: status === "closed" ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        }),
      });
      await supabaseFetch(`/rest/v1/support_request_events`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: membership.organization_id,
          request_id: r.id,
          from_status: r.status,
          to_status: status,
          title: t(
            `Status changed to ${status.replaceAll("_", " ")}`,
            `تغيّرت الحالة إلى ${STATUS_AR[status] || status}`,
          ),
        }),
      });
      setMessage(t("Request status updated.", "تم تحديث حالة الطلب."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to update request.", "تعذّر تحديث الطلب."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href="/workspace">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back to workspace", "العودة إلى مساحة العمل")}
        </Link>
      </Button>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Badge className="mb-3 bg-violet-100 text-violet-700">
            {t("Request Workflow v1", "سير عمل الطلبات v1")}
          </Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ClipboardList className="h-8 w-8 text-violet-700" />
            {t("Medicine Support Requests", "طلبات دعم الأدوية")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              "Intake, review, approval, procurement, dispensing, and delivery.",
              "الاستقبال والمراجعة والموافقة والمشتريات والصرف والتسليم.",
            )}
          </p>
          {membership?.organizations?.name && (
            <p className="mt-1 text-xs text-muted-foreground">
              {membership.organizations.name} ·{" "}
              {t("Open requests", "طلبات مفتوحة")}: {pending}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh", "تحديث")}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <p className="mb-6 text-muted-foreground">
          {t("Loading requests…", "جاري تحميل الطلبات…")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("New support request", "طلب دعم جديد")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{t("Beneficiary", "المستفيد")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.beneficiary_id}
                onChange={(e) =>
                  setDraft({ ...draft, beneficiary_id: e.target.value })
                }
              >
                <option value="">{t("Select beneficiary", "اختر المستفيد")}</option>
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("Program", "البرنامج")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.program_id}
                onChange={(e) =>
                  setDraft({ ...draft, program_id: e.target.value })
                }
              >
                <option value="">{t("Optional program", "برنامج اختياري")}</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("Medicine summary", "ملخص الدواء")}</Label>
              <Textarea
                value={draft.medicine_summary}
                onChange={(e) =>
                  setDraft({ ...draft, medicine_summary: e.target.value })
                }
                placeholder={t(
                  "Medicine, strength, dosage form, and quantity",
                  "الدواء والتركيز والشكل والكمية",
                )}
              />
            </div>
            <div>
              <Label>{t("Clinical notes", "ملاحظات سريرية")}</Label>
              <Textarea
                value={draft.clinical_notes}
                onChange={(e) =>
                  setDraft({ ...draft, clinical_notes: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Months", "الأشهر")}</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.requested_months}
                  onChange={(e) =>
                    setDraft({ ...draft, requested_months: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("Monthly cost", "التكلفة الشهرية")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={draft.estimated_monthly_cost}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      estimated_monthly_cost: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>{t("Priority", "الأولوية")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value })
                }
              >
                {["low", "standard", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => void createRequest()}
              disabled={
                saving || !draft.beneficiary_id || !draft.medicine_summary.trim()
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("Submit request", "إرسال الطلب")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Request queue", "قائمة الطلبات")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("No requests yet.", "لا توجد طلبات بعد.")}
              </p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {r.request_number} —{" "}
                        {r.beneficiaries?.full_name ||
                          t("Unknown beneficiary", "مستفيد غير معروف")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.programs?.name || t("No program", "بدون برنامج")} •{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{priorityLabel(r.priority)}</Badge>
                      <Badge>{statusLabel(r.status)}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{r.medicine_summary}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium">
                      {Number(r.estimated_monthly_cost || 0).toLocaleString()}{" "}
                      {r.currency}/{t("month", "شهر")} × {r.requested_months}
                    </div>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={r.status}
                      onChange={(e) => void changeStatus(r, e.target.value)}
                      disabled={saving}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
