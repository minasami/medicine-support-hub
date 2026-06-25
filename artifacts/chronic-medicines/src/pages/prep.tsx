import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useUpdateRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Package, QrCode, ShieldCheck, ArrowRight } from "lucide-react";

export default function PrepManagerPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: dispensed, refetch: refetchDispensed } = useListRequests({ status: "dispensed" as any, limit: 100 });
  const { data: packaging, refetch: refetchPackaging } = useListRequests({ status: "packaging" as any, limit: 100 });
  const { data: packaged, refetch: refetchPackaged } = useListRequests({ status: "packaged" as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  async function handleAction(id: number, status: "packaging" | "packaged") {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const qr = qrCodes[id];
      await updateRequest({
        id,
        data: {
          status,
          ...(qr ? { package_qr: qr } : {}),
        },
      });
      toast({
        title: status === "packaging"
          ? t("Packaging Started", "بدأت التعبئة")
          : t("Package Certified Ready", "تم اعتماد جاهزية الطرد"),
      });
      setQrCodes(q => { const c = { ...q }; delete c[id]; return c; });
      refetchDispensed(); refetchPackaging(); refetchPackaged();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function generateQR(id: number) {
    const code = `CM-${id}-${Date.now().toString(36).toUpperCase()}`;
    setQrCodes(q => ({ ...q, [id]: code }));
  }

  function RequestCard({ req, mode }: { req: any; mode: "dispensed" | "packaging" }) {
    const qr = qrCodes[req.id] ?? req.package_qr ?? "";
    return (
      <Card className="border-l-4 border-l-emerald-500">
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
                <div key={i} className="flex justify-between text-xs bg-emerald-50 rounded px-2 py-1">
                  <span>{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                  <span className="text-muted-foreground">x{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {req.batch_serial && (
            <div className="text-xs text-muted-foreground mb-1">{t("Batch:", "الدفعة:")} {req.batch_serial} | {t("Bin:", "الصندوق:")} {req.bin_location}</div>
          )}

          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              <QrCode className="w-3 h-3 inline mr-1" />
              {t("QR / Package Tag", "رمز QR / وسم الطرد")}
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="QR-2024-XXXX"
                value={qr}
                onChange={e => setQrCodes(q => ({ ...q, [req.id]: e.target.value }))}
                className="h-8 text-sm font-mono"
              />
              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => generateQR(req.id)}>
                {t("Generate", "توليد")}
              </Button>
            </div>
          </div>

          {/* Safety checklist */}
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mb-3">
            <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {t("Safety Compliance", "الامتثال للسلامة")}
            </div>
            <div className="space-y-0.5 text-xs text-emerald-700">
              <div>&#10003; {t("Safety-insulated packaging", "تعبئة عازلة للسلامة")}</div>
              <div>&#10003; {t("Tamper-evident seal", "ختم واضح العبث")}</div>
              <div>&#10003; {t("QR tag affixed", "رمز QR مُثبَّت")}</div>
            </div>
          </div>

          {mode === "dispensed" && (
            <Button
              size="sm"
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleAction(req.id, "packaging")}
              disabled={loading[req.id]}
            >
              <Package className="w-3.5 h-3.5" />
              {t("Start Packaging", "بدء التعبئة")}
            </Button>
          )}

          {mode === "packaging" && (
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={() => handleAction(req.id, "packaged")}
              disabled={loading[req.id] || !qr}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {t("Certify Package Ready", "اعتماد جاهزية الطرد")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Prep Operations Manager Portal", "بوابة مدير عمليات التحضير")}
        </div>
        <h1 className="text-2xl font-bold">{t("Packaging Queue", "قائمة التعبئة")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Seal dispensed medications in safety-insulated QR-tagged packages and certify readiness.", "إغلاق الأدوية الموزعة في عبوات عازلة مع رموز QR واعتماد الجاهزية.")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-800">{dispensed?.length ?? "—"}</div>
            <div className="text-xs text-amber-700 font-medium mt-1">{t("Awaiting Packaging", "بانتظار التعبئة")}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-800">{packaging?.length ?? "—"}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">{t("In Packaging", "قيد التعبئة")}</div>
          </CardContent>
        </Card>
        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-sky-800">{packaged?.length ?? "—"}</div>
            <div className="text-xs text-sky-700 font-medium mt-1">{t("Ready for Pickup", "جاهز للاستلام")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dispensed">
        <TabsList className="mb-4">
          <TabsTrigger value="dispensed">{t("To Package", "للتعبئة")} {dispensed?.length ? `(${dispensed.length})` : ""}</TabsTrigger>
          <TabsTrigger value="packaging">{t("In Packaging", "قيد التعبئة")} {packaging?.length ? `(${packaging.length})` : ""}</TabsTrigger>
          <TabsTrigger value="packaged">{t("Certified Ready", "معتمد جاهز")}</TabsTrigger>
        </TabsList>
        <TabsContent value="dispensed" className="space-y-3">
          {!dispensed?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No dispensed requests awaiting packaging", "لا طلبات بانتظار التعبئة")}</div>
          ) : (
            dispensed.map(req => <RequestCard key={req.id} req={req} mode="dispensed" />)
          )}
        </TabsContent>
        <TabsContent value="packaging" className="space-y-3">
          {!packaging?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("None currently being packaged", "لا شيء قيد التعبئة")}</div>
          ) : (
            packaging.map(req => <RequestCard key={req.id} req={req} mode="packaging" />)
          )}
        </TabsContent>
        <TabsContent value="packaged" className="space-y-3">
          {!packaged?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("No certified packages yet", "لا طرود معتمدة بعد")}</div>
          ) : (
            packaged.map(req => (
              <Card key={req.id} className="border-l-4 border-l-sky-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm">#{req.id} — {req.requester_name}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{req.package_qr}</div>
                      <div className="text-xs text-muted-foreground">{(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}</div>
                    </div>
                    <span className="text-xs bg-sky-100 text-sky-800 font-medium px-2 py-0.5 rounded-full">{t("Ready", "جاهز")}</span>
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
