import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useUpdateRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, ArrowRight, CheckCircle } from "lucide-react";

export default function PharmacyPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: approved, refetch: refetchApproved, isLoading: loadingApproved } =
    useListRequests({ status: "approved" as any, limit: 100 });
  const { data: preparing, refetch: refetchPreparing } =
    useListRequests({ status: "preparing" as any, limit: 100 });
  const { data: dispensing, refetch: refetchDispensing } =
    useListRequests({ status: "dispensing" as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  async function handleAction(id: number, status: "preparing" | "dispensing") {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      await updateRequest({
        id,
        data: {
          status,
          ...(notes[id] ? { pharmacy_notes: notes[id] } : {}),
        },
      });
      const label = status === "preparing"
        ? t("Preparation Started", "بدأ التحضير")
        : t("Sent to Pharmacist", "أُرسل للصيدلاني");
      toast({ title: label });
      setNotes(n => { const c = { ...n }; delete c[id]; return c; });
      refetchApproved(); refetchPreparing(); refetchDispensing();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function RequestCard({
    req,
    action,
    actionLabel,
    nextStatus,
    accentColor,
  }: {
    req: any;
    action: string;
    actionLabel: string;
    nextStatus: "preparing" | "dispensing";
    accentColor: string;
  }) {
    return (
      <Card className={`border-l-4 ${accentColor}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-sm">Request #{req.id}</div>
              <div className="text-sm text-muted-foreground">{req.requester_name}</div>
              {req.urgency === "critical" && (
                <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 mt-1 inline-block">
                  {t("CRITICAL", "حرج")}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1">{t("Medicines", "الأدوية")}</div>
            <div className="space-y-1">
              {(req.medicines as any[]).map((m: any, i: number) => (
                <div key={i} className="flex justify-between text-sm bg-slate-50 rounded px-2 py-1">
                  <span>{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                  <span className="text-muted-foreground text-xs">×{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <Textarea
            placeholder={t("Preparation notes (optional)…", "ملاحظات التحضير (اختياري)…")}
            value={notes[req.id] ?? ""}
            onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
            className="mb-3 text-sm min-h-[50px]"
          />

          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => handleAction(req.id, nextStatus)}
            disabled={loading[req.id]}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            {actionLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Pharmacy Assistant Portal", "بوابة مساعد الصيدلية")}
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-amber-600" />
          {t("Stock Preparation Queue", "قائمة تحضير المخزون")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t(
            "Pick stock for approved requests, prepare medications, then hand off to the pharmacist for clinical review.",
            "اسحب المخزون للطلبات المعتمدة وحضّر الأدوية ثم سلّمها للصيدلاني للمراجعة السريرية."
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-800">{approved?.length ?? "—"}</div>
            <div className="text-xs text-blue-700 font-medium mt-1">{t("Awaiting Prep", "بانتظار التحضير")}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-800">{preparing?.length ?? "—"}</div>
            <div className="text-xs text-amber-700 font-medium mt-1">{t("In Preparation", "قيد التحضير")}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-800">{dispensing?.length ?? "—"}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">{t("Sent to Pharmacist", "أُرسل للصيدلاني")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="approved">
        <TabsList className="mb-4">
          <TabsTrigger value="approved">
            {t("To Prepare", "للتحضير")} {approved?.length ? `(${approved.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="preparing">
            {t("In Preparation", "قيد التحضير")} {preparing?.length ? `(${preparing.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="dispensing">
            {t("Sent to Pharmacist", "أُرسل للصيدلاني")} {dispensing?.length ? `(${dispensing.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-3">
          {loadingApproved ? (
            [1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
          ) : !approved?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-blue-300" />
              {t("No approved requests awaiting preparation", "لا طلبات معتمدة بانتظار التحضير")}
            </div>
          ) : approved.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              action="preparing"
              actionLabel={t("Start Stock Preparation", "بدء تحضير المخزون")}
              nextStatus="preparing"
              accentColor="border-l-blue-400"
            />
          ))}
        </TabsContent>

        <TabsContent value="preparing" className="space-y-3">
          {!preparing?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("No requests currently in preparation", "لا طلبات قيد التحضير حالياً")}
            </div>
          ) : preparing.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              action="dispensing"
              actionLabel={t("Hand Off to Pharmacist", "تسليم للصيدلاني")}
              nextStatus="dispensing"
              accentColor="border-l-amber-400"
            />
          ))}
        </TabsContent>

        <TabsContent value="dispensing" className="space-y-3">
          {!dispensing?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("No requests sent to pharmacist yet", "لم يُرسل أي طلب للصيدلاني بعد")}
            </div>
          ) : dispensing.map(req => (
            <Card key={req.id} className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm">#{req.id} — {req.requester_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}
                    </div>
                    {req.pharmacy_notes && (
                      <div className="text-xs text-muted-foreground mt-1 italic">{req.pharmacy_notes}</div>
                    )}
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                    {t("With Pharmacist", "مع الصيدلاني")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
