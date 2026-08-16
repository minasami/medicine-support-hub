import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RequestRecord = {
  id: string;
  organization_id: string;
  request_number: string;
  status: string;
  priority: string;
  medicine_summary: string;
  clinical_notes: string | null;
  requested_months: number;
  estimated_monthly_cost: number | string;
  approved_monthly_cost: number | string | null;
  currency: string;
  decision_note: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  fulfilled_at: string | null;
  beneficiaries?: {
    id: string;
    full_name: string;
    primary_condition: string | null;
  } | null;
  programs?: { id: string; name: string } | null;
};
type Event = {
  id: string;
  from_status: string | null;
  to_status: string | null;
  title: string;
  note: string | null;
  created_at: string;
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
];

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

export default function SupportRequestDetailPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/requests/:id");
  const requestId = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [record, setRecord] = useState<RequestRecord | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState("submitted");
  const [approvedCost, setApprovedCost] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const statusLabel = (s: string) =>
    t(s.replaceAll("_", " "), STATUS_AR[s] || s);
  const priorityLabel = (p: string) => t(p, PRIORITY_AR[p] || p);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!requestId)
        throw new Error(t("Request ID is missing.", "معرّف الطلب مفقود."));
      if (!isAuthenticated || !session?.user?.id)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const rows = await supabaseFetch<RequestRecord[]>(
        `/rest/v1/support_requests?select=id,organization_id,request_number,status,priority,medicine_summary,clinical_notes,requested_months,estimated_monthly_cost,approved_monthly_cost,currency,decision_note,created_at,submitted_at,reviewed_at,approved_at,fulfilled_at,beneficiaries(id,full_name,primary_condition),programs(id,name)&id=eq.${requestId}&limit=1`,
      );
      const current = rows[0] ?? null;
      if (!current)
        throw new Error(
          t("Request not found or access denied.", "الطلب غير موجود أو الوصول مرفوض."),
        );
      setRecord(current);
      setStatus(current.status);
      setApprovedCost(
        current.approved_monthly_cost == null
          ? ""
          : String(current.approved_monthly_cost),
      );
      setDecisionNote(current.decision_note || "");
      setEvents(
        await supabaseFetch<Event[]>(
          `/rest/v1/support_request_events?select=id,from_status,to_status,title,note,created_at&request_id=eq.${requestId}&order=created_at.desc`,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Failed to load request.", "تعذّر تحميل الطلب."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [requestId, isAuthenticated, session?.access_token]);

  async function saveReview() {
    if (!record) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      await supabaseFetch(`/rest/v1/support_requests?id=eq.${record.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status,
          approved_monthly_cost:
            approvedCost === "" ? null : Number(approvedCost),
          decision_note: decisionNote.trim() || null,
          reviewed_by: session?.user?.id || null,
          reviewed_at: now,
          approved_at: status === "approved" ? now : record.approved_at,
          fulfilled_at: status === "delivered" ? now : record.fulfilled_at,
          closed_at: status === "closed" ? now : null,
          updated_at: now,
        }),
      });
      if (status !== record.status || decisionNote.trim()) {
        await supabaseFetch(`/rest/v1/support_request_events`, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            organization_id: record.organization_id,
            request_id: record.id,
            from_status: record.status,
            to_status: status,
            title: t(
              `Review saved: ${status.replaceAll("_", " ")}`,
              `تم حفظ المراجعة: ${STATUS_AR[status] || status}`,
            ),
            note: decisionNote.trim() || null,
          }),
        });
      }
      setMessage(t("Review saved.", "تم حفظ المراجعة."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Failed to save review.", "تعذّر حفظ المراجعة."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="container mx-auto max-w-6xl px-4 py-10 text-muted-foreground">
        {t("Loading request...", "جاري تحميل الطلب...")}
      </div>
    );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href="/ngo/requests">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back to request queue", "العودة إلى قائمة الطلبات")}
        </Link>
      </Button>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Badge className="mb-3 bg-violet-100 text-violet-700">
            {t("Support Request 360°", "طلب الدعم 360°")}
          </Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ClipboardCheck className="h-8 w-8 text-violet-700" />
            {record?.request_number || t("Request", "طلب")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              "Clinical, financial, workflow, and audit context in one review screen.",
              "سياق سريري ومالي وسير عمل وتدقيق في شاشة مراجعة واحدةحدة.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
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
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {record && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">
                  {t("Beneficiary", "المستفيد")}
                </div>
                <div className="mt-2 font-semibold">
                  {record.beneficiaries?.full_name || t("Unknown", "غير معروف")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {record.beneficiaries?.primary_condition ||
                    t("No condition", "بدون حالة")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">
                  {t("Program", "البرنامج")}
                </div>
                <div className="mt-2 font-semibold">
                  {record.programs?.name || t("Unassigned", "غير مُسند")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">
                  {t("Estimated cost", "التكلفة التقديرية")}
                </div>
                <div className="mt-2 text-xl font-bold">
                  {Number(record.estimated_monthly_cost || 0).toLocaleString()}{" "}
                  {record.currency}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("per month", "شهريًا")} × {record.requested_months}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">
                  {t("Priority", "الأولوية")}
                </div>
                <div className="mt-2">
                  <Badge variant="outline">
                    {priorityLabel(record.priority)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("Request details", "تفاصيل الطلب")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold">
                      {t("Medicine summary", "ملخص الدواء")}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {record.medicine_summary}
                    </p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {t("Clinical notes", "ملاحظات سريرية")}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {record.clinical_notes ||
                        t("No clinical notes", "لا توجد ملاحظات سريرية")}
                    </p>
                  </div>
                  {record.beneficiaries && (
                    <Button asChild variant="outline">
                      <Link
                        href={`/workspace/beneficiaries/${record.beneficiaries.id}`}
                      >
                        <UserRound className="mr-2 h-4 w-4" />
                        {t("Open Beneficiary 360°", "افتح المستفيد 360°")}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("Review decision", "قرار المراجعة")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t("Status", "الحالة")}</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>
                      {t("Approved monthly cost", "التكلفة الشهرية المعتمدة")}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={approvedCost}
                      onChange={(e) => setApprovedCost(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("Decision note", "ملاحظة القرار")}</Label>
                    <Textarea
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder={t(
                        "Record eligibility, clinical, budget, or fulfillment rationale.",
                        "سجّل مبرر الأهلية أو السريري أو الميزانية أو التنفيذ.",
                      )}
                    />
                  </div>
                  <Button onClick={() => void saveReview()} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {t("Save review", "حفظ المراجعة")}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5" />
                  {t("Audit timeline", "الجدول الزمني للتدقيق")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("No workflow events yet.", "لا توجد أحداث سير عمل بعد.")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {events.map((e) => (
                      <div key={e.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">{e.title}</div>
                          <Badge variant="outline">
                            {e.to_status
                              ? statusLabel(e.to_status)
                              : t("event", "حدث")}
                          </Badge>
                        </div>
                        {e.note && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {e.note}
                          </p>
                        )}
                        <time className="mt-2 block text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </time>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
