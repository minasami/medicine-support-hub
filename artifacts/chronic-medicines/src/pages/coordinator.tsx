import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useUpdateRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Truck, CheckCircle, PackageCheck, MapPin, PenLine } from "lucide-react";

export default function CoordinatorPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: packaged, refetch: refetchPackaged } = useListRequests({ status: "packaged" as any, limit: 100 });
  const { data: inTransit, refetch: refetchTransit } = useListRequests({ status: "in_transit" as any, limit: 100 });
  const { data: delivered, refetch: refetchDelivered } = useListRequests({ status: "delivered" as any, limit: 100 });
  const { data: completed, refetch: refetchCompleted } = useListRequests({ status: "completed" as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  async function handleAction(id: number, status: "in_transit" | "delivered" | "completed") {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      await updateRequest({
        id,
        data: {
          status,
          ...(notes[id] ? { coordinator_notes: notes[id] } : {}),
        },
      });
      const messages: Record<string, string> = {
        in_transit: t("Bundle Retrieved — In Transit", "تم الاستلام — في الطريق"),
        delivered: t("Marked as Delivered", "تم تحديد التوصيل"),
        completed: t("Request Fully Completed", "اكتمل الطلب بالكامل"),
      };
      toast({ title: messages[status] });
      setNotes(n => { const c = { ...n }; delete c[id]; return c; });
      refetchPackaged(); refetchTransit(); refetchDelivered(); refetchCompleted();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function RequestCard({ req, actions }: { req: any; actions: Array<{ label: string; labelAr: string; status: "in_transit" | "delivered" | "completed"; className?: string }> }) {
    const n = notes[req.id] ?? "";
    return (
      <Card className={`border-l-4 ${req.urgency === "critical" ? "border-l-red-500" : "border-l-sky-400"}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Request #{req.id}</span>
                {req.urgency === "critical" && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                    {t("CRITICAL", "حرج")}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{req.requester_name}</div>
              <div className="text-xs text-muted-foreground">{req.requester_phone}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</div>
              {req.package_qr && (
                <div className="text-xs font-mono text-muted-foreground mt-1">QR: {req.package_qr}</div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1">{t("Contents", "المحتويات")}</div>
            <div className="space-y-1">
              {(req.medicines as any[]).map((m: any, i: number) => (
                <div key={i} className="flex justify-between text-xs bg-sky-50 rounded px-2 py-1">
                  <span>{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                  <span className="text-muted-foreground">x{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-500" />
            <span>
              {req.is_for_relative
                ? t(`Deliver to: ${req.requester_name} (for ${req.patient_name})`, `توصيل إلى: ${req.requester_name} (لصالح ${req.patient_name})`)
                : t(`Deliver to: ${req.requester_name}`, `توصيل إلى: ${req.requester_name}`)}
            </span>
          </div>

          {req.coordinator_notes && (
            <div className="bg-sky-50 border border-sky-200 rounded p-2 mb-2 text-xs text-sky-800">
              <PenLine className="w-3 h-3 inline mr-1" />
              {req.coordinator_notes}
            </div>
          )}

          <Textarea
            placeholder={t("Coordinator notes / signature log...", "ملاحظات المنسق / سجل التوقيع...")}
            value={n}
            onChange={e => setNotes(ns => ({ ...ns, [req.id]: e.target.value }))}
            className="mb-3 text-sm min-h-[50px]"
          />

          <div className="flex gap-2">
            {actions.map(({ label, labelAr, status, className }) => (
              <Button
                key={status}
                size="sm"
                className={`flex-1 gap-1.5 ${className ?? ""}`}
                onClick={() => handleAction(req.id, status)}
                disabled={loading[req.id]}
              >
                {status === "in_transit" && <Truck className="w-3.5 h-3.5" />}
                {status === "delivered" && <PackageCheck className="w-3.5 h-3.5" />}
                {status === "completed" && <CheckCircle className="w-3.5 h-3.5" />}
                {language === "en" ? label : labelAr}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Delivery Man Portal", "بوابة عامل التوصيل")}
        </div>
        <h1 className="text-2xl font-bold">{t("Delivery Queue", "قائمة التوصيل")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Retrieve certified bundles, manage on-premises routing, and log final handoffs.", "استلام الطرود المعتمدة وإدارة التوصيل وتسجيل عمليات التسليم النهائية.")}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-sky-800">{packaged?.length ?? "—"}</div>
            <div className="text-xs text-sky-700 font-medium mt-1">{t("Ready Pickup", "جاهز للاستلام")}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-800">{inTransit?.length ?? "—"}</div>
            <div className="text-xs text-blue-700 font-medium mt-1">{t("In Transit", "في الطريق")}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-800">{delivered?.length ?? "—"}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">{t("Delivered", "تم التوصيل")}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{completed?.length ?? "—"}</div>
            <div className="text-xs text-slate-700 font-medium mt-1">{t("Completed", "مكتمل")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="packaged">
        <TabsList className="mb-4">
          <TabsTrigger value="packaged">{t("Pickup", "للاستلام")} {packaged?.length ? `(${packaged.length})` : ""}</TabsTrigger>
          <TabsTrigger value="in_transit">{t("In Transit", "في الطريق")} {inTransit?.length ? `(${inTransit.length})` : ""}</TabsTrigger>
          <TabsTrigger value="delivered">{t("Delivered", "تم التوصيل")}</TabsTrigger>
          <TabsTrigger value="completed">{t("Completed", "مكتمل")}</TabsTrigger>
        </TabsList>
        <TabsContent value="packaged" className="space-y-3">
          {!packaged?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No packages ready for pickup", "لا طرود جاهزة للاستلام")}</div>
          ) : (
            packaged.map(req => (
              <RequestCard key={req.id} req={req} actions={[
                { label: "Acknowledge & Retrieve", labelAr: "استلام وتأكيد", status: "in_transit", className: "bg-sky-600 hover:bg-sky-700" }
              ]} />
            ))
          )}
        </TabsContent>
        <TabsContent value="in_transit" className="space-y-3">
          {!inTransit?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No active deliveries", "لا توصيلات نشطة")}</div>
          ) : (
            inTransit.map(req => (
              <RequestCard key={req.id} req={req} actions={[
                { label: "Confirm Delivered", labelAr: "تأكيد التوصيل", status: "delivered", className: "bg-emerald-600 hover:bg-emerald-700" }
              ]} />
            ))
          )}
        </TabsContent>
        <TabsContent value="delivered" className="space-y-3">
          {!delivered?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No delivered requests", "لا طلبات موصلة")}</div>
          ) : (
            delivered.map(req => (
              <RequestCard key={req.id} req={req} actions={[
                { label: "Mark Completed", labelAr: "تحديد كمكتمل", status: "completed" }
              ]} />
            ))
          )}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3">
          {!completed?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No completed requests yet", "لا طلبات مكتملة بعد")}</div>
          ) : (
            completed.map(req => (
              <Card key={req.id} className="border-l-4 border-l-slate-400">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm">#{req.id} — {req.requester_name}</div>
                      <div className="text-xs text-muted-foreground">{(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}</div>
                      {req.coordinator_notes && <div className="text-xs text-slate-500 mt-1 italic">{req.coordinator_notes}</div>}
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full">{t("Completed", "مكتمل")}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
