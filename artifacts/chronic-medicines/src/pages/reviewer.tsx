import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useUpdateRequest } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function ReviewerPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: pending, refetch: refetchPending, isLoading: loadingPending } = useListRequests({ status: "pending" as any, limit: 100 });
  const { data: approved, refetch: refetchApproved } = useListRequests({ status: "approved" as any, limit: 100 });
  const { data: rejected, refetch: refetchRejected } = useListRequests({ status: "rejected" as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  async function handleDecision(id: number, decision: "approved" | "rejected") {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      await updateRequest({
        id,
        data: {
          status: decision,
          reviewer_notes: notes[id] ?? null,
        },
      });
      toast({
        title: decision === "approved" ? t("Request Approved", "تمت الموافقة") : t("Request Rejected", "تم الرفض"),
        description: t(`Request #${id} has been ${decision}.`, `تم ${decision === "approved" ? "قبول" : "رفض"} الطلب #${id}.`),
      });
      setNotes(n => { const c = { ...n }; delete c[id]; return c; });
      refetchPending();
      refetchApproved();
      refetchRejected();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function RequestCard({ req }: { req: any }) {
    const isUrgent = req.urgency === "critical";
    const reqNotes = notes[req.id] ?? "";
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
              {req.employee_department && (
                <div className="text-xs text-muted-foreground">{t("Dept:", "القسم:")} {req.employee_department}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>

          {req.is_for_relative && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 text-xs">
              <span className="font-medium text-muted-foreground">{t("Patient:", "المريض:")}</span>{" "}
              {req.patient_name} ({req.patient_relation})
            </div>
          )}

          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {t("Prescribed Medicines", "الأدوية الموصوفة")}
            </div>
            <div className="space-y-1">
              {(req.medicines as any[]).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1">
                  <span>{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                  <span className="text-muted-foreground text-xs">x{m.quantity}</span>
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
                <FileText className="w-3.5 h-3.5" />
                {t("View Prescription", "عرض الوصفة")}
              </a>
            </div>
          )}

          {req.status === "pending" && (
            <>
              <Textarea
                placeholder={t("Add medical justification note (required for rejection)...", "أضف ملاحظة التبرير الطبي (مطلوبة للرفض)...")}
                value={reqNotes}
                onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                className="mb-3 text-sm min-h-[70px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleDecision(req.id, "approved")}
                  disabled={loading[req.id]}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t("Approve", "موافقة")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDecision(req.id, "rejected")}
                  disabled={loading[req.id] || !reqNotes.trim()}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t("Reject", "رفض")}
                </Button>
              </div>
            </>
          )}

          {req.status !== "pending" && req.reviewer_notes && (
            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("Note:", "ملاحظة:")}</span> {req.reviewer_notes}
            </div>
          )}
        </CardContent>
      </Card>
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

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-800">{pending?.length ?? "—"}</div>
            <div className="text-xs text-yellow-700 font-medium mt-1">{t("Awaiting Review", "بانتظار المراجعة")}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-800">{approved?.length ?? "—"}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">{t("Approved", "موافق عليه")}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-800">{rejected?.length ?? "—"}</div>
            <div className="text-xs text-red-700 font-medium mt-1">{t("Rejected", "مرفوض")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-3.5 h-3.5" />
            {t("Pending", "قيد الانتظار")} {pending?.length ? `(${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">{t("Approved", "موافق عليه")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("Rejected", "مرفوض")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {loadingPending ? (
            [1,2].map(i => <Skeleton key={i} className="h-48 w-full" />)
          ) : !pending?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <div className="font-medium">{t("All clear — no pending requests", "القائمة فارغة — لا طلبات معلقة")}</div>
            </div>
          ) : (
            pending.map(req => <RequestCard key={req.id} req={req} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3">
          {approved?.map(req => <RequestCard key={req.id} req={req} />)}
          {!approved?.length && (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No approved requests", "لا طلبات معتمدة")}</div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-3">
          {rejected?.map(req => <RequestCard key={req.id} req={req} />)}
          {!rejected?.length && (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No rejected requests", "لا طلبات مرفوضة")}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
