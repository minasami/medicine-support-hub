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
import { UserCog, CheckCircle, AlertTriangle, FileText, Clock, Flag } from "lucide-react";

export default function PhysicianPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: pending, refetch: refetchPending, isLoading } = useListRequests({ status: "pending" as any, limit: 100 });
  const { data: approved, refetch: refetchApproved } = useListRequests({ status: "approved" as any, limit: 100 });
  const { data: rejected, refetch: refetchRejected } = useListRequests({ status: "rejected" as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  async function handleDecision(id: number, decision: "approved" | "rejected") {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      await updateRequest({
        id,
        data: { status: decision, reviewer_notes: notes[id] ?? null },
      });
      toast({ title: decision === "approved" ? t("Prescription Authorized", "تم تفويض الوصفة") : t("Prescription Flagged", "تم إيقاف الوصفة") });
      setNotes(n => { const c = { ...n }; delete c[id]; return c; });
      refetchPending(); refetchApproved(); refetchRejected();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function RxCard({ req, canAct }: { req: any; canAct: boolean }) {
    const isUrgent = req.urgency === "critical";
    return (
      <Card className={`border-l-4 ${isUrgent ? "border-l-red-500" : "border-l-blue-500"} hover:shadow-md transition-shadow`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">Rx #{req.id}</span>
                {isUrgent && (
                  <span className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    {t("URGENT", "عاجل")}
                  </span>
                )}
                {req.wet_signature_required && (
                  <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                    {t("Wet Sig Required", "توقيع فعلي")}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{req.requester_name}</div>
              <div className="text-xs text-muted-foreground">{req.requester_phone}</div>
              {req.is_for_relative && req.patient_name && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("Patient:", "المريض:")} {req.patient_name} ({req.patient_relation})
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {t("Prescribed Medicines", "الأدوية الموصوفة")}
            </div>
            <div className="space-y-1">
              {(req.medicines as any[]).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm bg-blue-50 rounded px-3 py-1.5">
                  <span className="font-medium">{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                  <span className="text-muted-foreground text-xs">×{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {req.prescription_url && (
            <a href={req.prescription_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3">
              <FileText className="w-3.5 h-3.5" />
              {t("View Prescription Image", "عرض صورة الوصفة")}
            </a>
          )}

          {canAct && (
            <>
              <Textarea
                placeholder={t("Add clinical justification note (required for flagging)...", "أضف ملاحظة سريرية (مطلوبة للإيقاف)...")}
                value={notes[req.id] ?? ""}
                onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                className="mb-3 text-sm min-h-[70px]"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleDecision(req.id, "approved")} disabled={loading[req.id]}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t("Authorize", "تفويض")}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDecision(req.id, "rejected")} disabled={loading[req.id] || !(notes[req.id]?.trim())}>
                  <Flag className="w-3.5 h-3.5" />
                  {t("Flag & Hold", "إيقاف")}
                </Button>
              </div>
            </>
          )}

          {!canAct && req.reviewer_notes && (
            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("Clinical Note:", "ملاحظة سريرية:")}</span> {req.reviewer_notes}
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
          {t("Physician Portal", "بوابة الطبيب")}
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="w-6 h-6 text-blue-600" />
          {t("Prescription Authorization Queue", "قائمة تفويض الوصفات")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Review patient prescriptions and authorize or flag them for clinical hold.", "راجع وصفات المرضى وفوّضها أو أوقفها للمراجعة السريرية.")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-800">{pending?.length ?? "—"}</div>
            <div className="text-xs text-blue-700 font-medium mt-1">{t("Awaiting Authorization", "بانتظار التفويض")}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-800">{approved?.length ?? "—"}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">{t("Authorized", "مُفوَّض")}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-800">{rejected?.length ?? "—"}</div>
            <div className="text-xs text-red-700 font-medium mt-1">{t("Flagged & Held", "موقوف")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-3.5 h-3.5" />
            {t("Pending", "قيد الانتظار")} {pending?.length ? `(${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="authorized">{t("Authorized", "مُفوَّض")}</TabsTrigger>
          <TabsTrigger value="flagged">{t("Flagged", "موقوف")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {isLoading ? [1,2].map(i => <Skeleton key={i} className="h-48 w-full" />) :
            !pending?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <div className="font-medium">{t("No prescriptions awaiting authorization", "لا وصفات بانتظار التفويض")}</div>
              </div>
            ) : pending.map(req => <RxCard key={req.id} req={req} canAct />)
          }
        </TabsContent>
        <TabsContent value="authorized" className="space-y-3">
          {approved?.map(req => <RxCard key={req.id} req={req} canAct={false} />)}
          {!approved?.length && <div className="text-center py-12 text-muted-foreground text-sm">{t("No authorized prescriptions", "لا وصفات مُفوَّضة")}</div>}
        </TabsContent>
        <TabsContent value="flagged" className="space-y-3">
          {rejected?.map(req => <RxCard key={req.id} req={req} canAct={false} />)}
          {!rejected?.length && <div className="text-center py-12 text-muted-foreground text-sm">{t("No flagged prescriptions", "لا وصفات موقوفة")}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
