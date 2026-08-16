import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, LogIn, ShieldCheck } from "lucide-react";

type RequestRow = {
  id: number;
  requester_name: string;
  requester_phone: string;
  is_for_relative: boolean;
  patient_name: string | null;
  patient_relation: string | null;
  medicines: Array<{ name_en?: string; name_ar?: string; quantity?: number }>;
  prescription_url: string | null;
  status: string;
  reviewer_notes: string | null;
  created_at: string;
  urgency: string;
  wet_signature_required: boolean;
  employee_department: string | null;
};

export default function ReviewerPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<RequestRow | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const approved = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const rejected = useMemo(() => requests.filter((r) => r.status === "rejected"), [requests]);

  const metrics = useMemo(() => {
    let criticalCount = 0;
    let totalItems = 0;
    requests.forEach((r) => {
      if (r.urgency === "critical") criticalCount++;
      if (Array.isArray(r.medicines)) {
        r.medicines.forEach((m) => {
          totalItems += m.quantity ?? 1;
        });
      }
    });
    const averagePrice = 45;
    const totalValue = totalItems * averagePrice;
    const patientCopay = totalValue * 0.2;
    return { activeQueue: pending.length, criticalCount, totalValue, patientCopay };
  }, [requests, pending]);

  async function loadRequests() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<RequestRow[]>(
        "/rest/v1/medicine_requests?select=id,requester_name,requester_phone,is_for_relative,patient_name,patient_relation,medicines,prescription_url,status,reviewer_notes,created_at,urgency,wet_signature_required,employee_department&order=created_at.desc&limit=200",
      );
      setRequests(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not load reviewer queue.", "تعذّر تحميل قائمة المراجع."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [isAuthenticated, session?.access_token]);

  async function handleDecision(id: number, decision: "approved" | "rejected", reviewerNote?: string | null) {
    setSaving((current) => ({ ...current, [id]: true }));
    try {
      const updated = await supabaseFetch<RequestRow[]>(`/rest/v1/medicine_requests?id=eq.${id}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: decision, reviewer_notes: reviewerNote ?? null }),
      });
      setRequests((current) => current.map((request) => (request.id === id ? { ...request, ...updated[0] } : request)));
      toast({
        title:
          decision === "approved"
            ? t("Request approved", "تمت الموافقة على الطلب")
            : t("Request rejected", "تم رفض الطلب"),
        description: t(`Request #${id} has been ${decision}.`, `الطلب #${id} أصبح ${decision}.`),
      });
      if (decision === "rejected") {
        setRejectionTarget(null);
        setRejectionNote("");
      }
    } catch (err) {
      toast({
        title: t("Error", "خطأ"),
        description: err instanceof Error ? err.message : t("Could not update request.", "تعذّر تحديث الطلب."),
        variant: "destructive",
      });
    } finally {
      setSaving((current) => ({ ...current, [id]: false }));
    }
  }

  function RequestCard({ req }: { req: RequestRow }) {
    const isUrgent = req.urgency === "critical";
    const medicines = Array.isArray(req.medicines) ? req.medicines : [];

    return (
      <Card className={`border-l-4 ${isUrgent ? "border-l-red-500" : "border-l-violet-400"} transition-shadow hover:shadow-md`}>
        <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-bold">
                  {t("Request", "طلب")} #{req.id}
                </span>
                {isUrgent && (
                  <span className="flex items-center gap-1 rounded border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    <AlertTriangle className="h-3 w-3" />
                    {t("CRITICAL CARE", "رعاية حرجة")}
                  </span>
                )}
                {req.wet_signature_required && (
                  <span className="rounded border border-orange-200 bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                    {t("Wet Signature Required", "توقيع حي مطلوب")}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-foreground">{req.requester_name}</div>
              <div className="text-xs text-muted-foreground">{req.requester_phone}</div>
              {req.employee_department && (
                <div className="text-xs text-muted-foreground">
                  {t("Dept:", "القسم:")} {req.employee_department}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>

          {req.is_for_relative && (
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">{t("Patient", "المريض")}:</span>{" "}
              {req.patient_name} ({req.patient_relation})
            </div>
          )}

          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Prescribed Medicines", "الأدوية الموصوفة")}
            </div>
            <div className="space-y-1">
              {medicines.map((medicine, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm"
                >
                  <span>
                    {language === "en" ? medicine.name_en : medicine.name_ar || medicine.name_en}
                  </span>
                  <span className="text-xs text-muted-foreground">x{medicine.quantity ?? 1}</span>
                </div>
              ))}
            </div>
          </div>

          {req.prescription_url && (
            <div className="mb-3">
              <a
                href={req.prescription_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {t("View Prescription", "عرض الوصفة")}
              </a>
            </div>
          )}

          {req.status === "pending" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleDecision(req.id, "approved", null)}
                disabled={saving[req.id]}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {t("Approve", "موافقة")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setRejectionTarget(req);
                  setRejectionNote(req.reviewer_notes ?? "");
                }}
                disabled={saving[req.id]}
              >
                <XCircle className="h-3.5 w-3.5" />
                {t("Reject", "رفض")}
              </Button>
            </div>
          ) : req.reviewer_notes ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("Note", "ملاحظة")}:</span> {req.reviewer_notes}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Alert className="mb-4">
          <LogIn className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Please sign in before opening the reviewer portal.",
              "يرجى تسجيل الدخول قبل فتح بوابة المراجع.",
            )}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/portal">{t("Go to platform sign in", "الذهاب لتسجيل الدخول")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Clinical Medical Reviewer Portal", "بوابة المراجع الطبي السريري")}
        </div>
        <h1 className="text-2xl font-bold">{t("Medical Triage Queue", "قائمة الفرز الطبي")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Evaluate benefit submissions and approve or reject with a formal explanation.",
            "قيّم طلبات الاستفادة ووافق أو ارفض مع تبرير رسمي.",
          )}
        </p>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-yellow-200/50 bg-yellow-50/20 shadow-sm border-slate-200">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Active Queue", "الطلبات النشطة")}
              </span>
              <div className="text-2xl font-bold text-yellow-800">{metrics.activeQueue}</div>
            </div>
            <div className="rounded-xl bg-yellow-100/50 p-3 text-yellow-800">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200/50 bg-red-50/20 shadow-sm border-slate-200">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Critical Care", "الحالات الحرجة")}
              </span>
              <div className="text-2xl font-bold text-red-600">{metrics.criticalCount}</div>
            </div>
            <div className="rounded-xl bg-red-100/50 p-3 text-red-600">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50 bg-emerald-50/20 shadow-sm border-slate-200">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Projected Claims", "المطالبات المتوقعة")}
              </span>
              <div className="text-2xl font-bold text-emerald-800">
                ${metrics.totalValue.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-100/50 p-3 text-emerald-800">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200/50 bg-blue-50/20 shadow-sm border-slate-200">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Co-pay Revenue", "عوائد المشاركة")}
              </span>
              <div className="text-2xl font-bold text-blue-600">
                ${metrics.patientCopay.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-blue-100/50 p-3 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-3.5 w-3.5" />
            {t("Pending", "قيد الانتظار")} {pending.length ? `(${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">{t("Approved", "موافق عليه")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("Rejected", "مرفوض")}</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {loading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)
          ) : !pending.length ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
              <div className="font-medium">
                {t("All clear — no pending requests", "لا توجد طلبات معلّقة")}
              </div>
            </div>
          ) : (
            pending.map((req) => <RequestCard key={req.id} req={req} />)
          )}
        </TabsContent>
        <TabsContent value="approved" className="space-y-3">
          {approved.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))}
          {!approved.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("No approved requests", "لا توجد طلبات موافق عليها")}
            </div>
          )}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-3">
          {rejected.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))}
          {!rejected.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("No rejected requests", "لا توجد طلبات مرفوضة")}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {rejectionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-4">
              <div className="text-lg font-bold">
                {t("Reject request", "رفض الطلب")} #{rejectionTarget.id}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "Write the rejection justification clearly. This note will be saved with the request.",
                  "اكتب مبرر الرفض بوضوح. ستُحفظ هذه الملاحظة مع الطلب.",
                )}
              </p>
            </div>
            <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{rejectionTarget.requester_name}</div>
              <div className="text-xs text-muted-foreground">{rejectionTarget.requester_phone}</div>
            </div>
            <Textarea
              autoFocus
              value={rejectionNote}
              onChange={(event) => setRejectionNote(event.target.value)}
              placeholder={t("Justification for rejection...", "مبرر الرفض...")}
              className="min-h-[180px] resize-y text-sm"
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectionTarget(null);
                  setRejectionNote("");
                }}
                disabled={saving[rejectionTarget.id]}
              >
                {t("Cancel", "إلغاء")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  handleDecision(rejectionTarget.id, "rejected", rejectionNote.trim())
                }
                disabled={saving[rejectionTarget.id] || !rejectionNote.trim()}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {saving[rejectionTarget.id]
                  ? t("Rejecting...", "جاري الرفض...")
                  : t("Confirm rejection", "تأكيد الرفض")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
