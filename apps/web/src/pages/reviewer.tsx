import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, LogIn } from "lucide-react";

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
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const approved = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const rejected = useMemo(() => requests.filter((r) => r.status === "rejected"), [requests]);

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
      setError(err instanceof Error ? err.message : "Could not load reviewer queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [isAuthenticated, session?.access_token]);

  async function handleDecision(id: number, decision: "approved" | "rejected") {
    setSaving((current) => ({ ...current, [id]: true }));
    try {
      const updated = await supabaseFetch<RequestRow[]>(`/rest/v1/medicine_requests?id=eq.${id}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: decision, reviewer_notes: notes[id] || null }),
      });
      setRequests((current) => current.map((request) => (request.id === id ? { ...request, ...updated[0] } : request)));
      setNotes((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast({
        title: decision === "approved" ? t("Request approved", "تمت الموافقة") : t("Request rejected", "تم الرفض"),
        description: t(`Request #${id} has been ${decision}.`, `تم ${decision === "approved" ? "قبول" : "رفض"} الطلب #${id}.`),
      });
    } catch (err) {
      toast({
        title: t("Error", "خطأ"),
        description: err instanceof Error ? err.message : "Could not update request.",
        variant: "destructive",
      });
    } finally {
      setSaving((current) => ({ ...current, [id]: false }));
    }
  }

  function RequestCard({ req }: { req: RequestRow }) {
    const isUrgent = req.urgency === "critical";
    const reqNotes = notes[req.id] ?? "";
    const medicines = Array.isArray(req.medicines) ? req.medicines : [];

    return (
      <Card className={`border-l-4 ${isUrgent ? "border-l-red-500" : "border-l-violet-400"} transition-shadow hover:shadow-md`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">Request #{req.id}</span>
                {isUrgent && (
                  <span className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    {t("CRITICAL CARE", "رعاية حرجة")}
                  </span>
                )}
                {req.wet_signature_required && (
                  <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                    {t("Wet Signature Required", "يلزم توقيع فعلي")}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-foreground">{req.requester_name}</div>
              <div className="text-xs text-muted-foreground">{req.requester_phone}</div>
              {req.employee_department && <div className="text-xs text-muted-foreground">{t("Dept:", "القسم:")} {req.employee_department}</div>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>

          {req.is_for_relative && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 text-xs">
              <span className="font-medium text-muted-foreground">{t("Patient:", "المريض:")}</span> {req.patient_name} ({req.patient_relation})
            </div>
          )}

          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {t("Prescribed Medicines", "الأدوية الموصوفة")}
            </div>
            <div className="space-y-1">
              {medicines.map((medicine, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1">
                  <span>{language === "en" ? medicine.name_en : medicine.name_ar || medicine.name_en}</span>
                  <span className="text-muted-foreground text-xs">x{medicine.quantity ?? 1}</span>
                </div>
              ))}
            </div>
          </div>

          {req.prescription_url && (
            <div className="mb-3">
              <a href={req.prescription_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <FileText className="w-3.5 h-3.5" />
                {t("View Prescription", "عرض الوصفة")}
              </a>
            </div>
          )}

          {req.status === "pending" ? (
            <>
              <Textarea
                placeholder={t("Add medical justification note (required for rejection)...", "أضف ملاحظة التبرير الطبي (مطلوبة للرفض)...")}
                value={reqNotes}
                onChange={(event) => setNotes((current) => ({ ...current, [req.id]: event.target.value }))}
                className="mb-3 text-sm min-h-[70px]"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecision(req.id, "approved")} disabled={saving[req.id]}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t("Approve", "موافقة")}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDecision(req.id, "rejected")} disabled={saving[req.id] || !reqNotes.trim()}>
                  <XCircle className="w-3.5 h-3.5" />
                  {t("Reject", "رفض")}
                </Button>
              </div>
            </>
          ) : req.reviewer_notes ? (
            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("Note:", "ملاحظة:")}</span> {req.reviewer_notes}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl">
        <Alert className="mb-4">
          <LogIn className="h-4 w-4" />
          <AlertDescription>{t("Please sign in before opening the reviewer portal.", "يرجى تسجيل الدخول قبل فتح بوابة المراجع.")}</AlertDescription>
        </Alert>
        <Button asChild><Link href="/portal">{t("Go to platform sign in", "اذهب إلى تسجيل دخول المنصة")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Clinical Medical Reviewer Portal", "بوابة المراجع الطبي السريري")}
        </div>
        <h1 className="text-2xl font-bold">{t("Medical Triage Queue", "قائمة الفرز الطبي")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Evaluate benefit submissions and approve or reject with formal medical explanation.", "تقييم طلبات المزايا والموافقة عليها أو رفضها مع تفسير طبي رسمي.")}
        </p>
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-yellow-50 border-yellow-200"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-yellow-800">{pending.length}</div><div className="text-xs text-yellow-700 font-medium mt-1">{t("Awaiting Review", "بانتظار المراجعة")}</div></CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-emerald-800">{approved.length}</div><div className="text-xs text-emerald-700 font-medium mt-1">{t("Approved", "موافق عليه")}</div></CardContent></Card>
        <Card className="bg-red-50 border-red-200"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-red-800">{rejected.length}</div><div className="text-xs text-red-700 font-medium mt-1">{t("Rejected", "مرفوض")}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2"><Clock className="w-3.5 h-3.5" />{t("Pending", "قيد الانتظار")} {pending.length ? `(${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="approved">{t("Approved", "موافق عليه")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("Rejected", "مرفوض")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {loading ? [1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />) : !pending.length ? <div className="text-center py-12 text-muted-foreground"><CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" /><div className="font-medium">{t("All clear — no pending requests", "القائمة فارغة — لا طلبات معلقة")}</div></div> : pending.map((req) => <RequestCard key={req.id} req={req} />)}
        </TabsContent>
        <TabsContent value="approved" className="space-y-3">{approved.map((req) => <RequestCard key={req.id} req={req} />)}{!approved.length && <div className="text-center py-12 text-muted-foreground text-sm">{t("No approved requests", "لا طلبات معتمدة")}</div>}</TabsContent>
        <TabsContent value="rejected" className="space-y-3">{rejected.map((req) => <RequestCard key={req.id} req={req} />)}{!rejected.length && <div className="text-center py-12 text-muted-foreground text-sm">{t("No rejected requests", "لا طلبات مرفوضة")}</div>}</TabsContent>
      </Tabs>
    </div>
  );
}
