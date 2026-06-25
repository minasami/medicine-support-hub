import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useUpdateRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pill, CheckCircle, Package, ShieldAlert, QrCode } from "lucide-react";

const DRUG_INTERACTIONS: Record<string, string[]> = {
  "Warfarin":    ["Aspirin", "Ibuprofen", "Metronidazole"],
  "Metformin":   ["Alcohol", "Contrast dye"],
  "Lisinopril":  ["Potassium supplements", "NSAIDs"],
};

function checkInteractions(medicines: any[]): string[] {
  const names = medicines.map((m: any) => m.name_en);
  const warnings: string[] = [];
  names.forEach(drug => {
    (DRUG_INTERACTIONS[drug] ?? []).forEach(i => {
      if (names.includes(i)) warnings.push(`${drug} ↔ ${i}`);
    });
  });
  return [...new Set(warnings)];
}

interface PkgForm { batch: string; bin: string; qr: string; notes: string }
const emptyForm = (): PkgForm => ({ batch: "", bin: "", qr: "", notes: "" });

export default function PharmacistPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<number, PkgForm>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const { data: dispensing,  refetch: refetchDispensing,  isLoading: loadDsp  } =
    useListRequests({ status: "dispensing"  as any, limit: 100 });
  const { data: dispensed,   refetch: refetchDispensed                          } =
    useListRequests({ status: "dispensed"   as any, limit: 100 });
  const { data: packaging,   refetch: refetchPackaging                          } =
    useListRequests({ status: "packaging"   as any, limit: 100 });
  const { data: packaged,    refetch: refetchPackaged                           } =
    useListRequests({ status: "packaged"    as any, limit: 100 });
  const { mutateAsync: updateRequest } = useUpdateRequest();

  function getForm(id: number) { return form[id] ?? emptyForm(); }
  function setField(id: number, field: keyof PkgForm, value: string) {
    setForm(f => ({ ...f, [id]: { ...getForm(id), [field]: value } }));
  }

  async function handleAction(
    id: number,
    status: "dispensed" | "packaging" | "packaged",
  ) {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const f = getForm(id);
      await updateRequest({
        id,
        data: {
          status,
          ...(f.notes  ? { pharmacy_notes: f.notes }  : {}),
          ...(f.batch  ? { batch_serial: f.batch }    : {}),
          ...(f.bin    ? { bin_location: f.bin }      : {}),
          ...(f.qr     ? { package_qr: f.qr }         : {}),
        },
      });
      const labels: Record<string, string> = {
        dispensed:  t("Clinically Dispensed ✓",  "تم الصرف السريري ✓"),
        packaging:  t("Packaging Started",         "بدأت التعبئة"),
        packaged:   t("Package Certified Ready",   "الطرد جاهز للتسليم ✓"),
      };
      toast({ title: labels[status] });
      setForm(f => { const c = { ...f }; delete c[id]; return c; });
      refetchDispensing(); refetchDispensed(); refetchPackaging(); refetchPackaged();
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function RxCard({ req }: { req: any }) {
    const warnings = checkInteractions(req.medicines ?? []);
    const f = getForm(req.id);
    return (
      <Card className={`border-l-4 ${warnings.length ? "border-l-red-500" : "border-l-orange-400"}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-sm">Rx #{req.id}</span>
                {req.urgency === "critical" && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                    {t("CRITICAL", "حرج")}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{req.requester_name}</div>
            </div>
            <div className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</div>
          </div>

          {warnings.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {t("Drug Interaction Alert", "تحذير تفاعل الأدوية")}
              </div>
              {warnings.map(w => <div key={w} className="text-xs text-red-600">⚠ {w}</div>)}
            </div>
          )}

          <div className="space-y-1 mb-3">
            {(req.medicines as any[]).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm bg-orange-50 rounded px-3 py-1.5">
                <span className="font-medium">{language === "en" ? m.name_en : (m.name_ar || m.name_en)}</span>
                <span className="text-muted-foreground text-xs">×{m.quantity}</span>
              </div>
            ))}
          </div>

          {/* Batch / bin / QR capture */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("Batch Serial", "رقم الدفعة")}</label>
              <Input
                placeholder="e.g. BT-2024-001"
                value={f.batch}
                onChange={e => setField(req.id, "batch", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("Bin Location", "موقع الصندوق")}</label>
              <Input
                placeholder="e.g. A3-B2"
                value={f.bin}
                onChange={e => setField(req.id, "bin", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <Textarea
            placeholder={t("Clinical dispensing notes (interactions, substitutions)…", "ملاحظات الصرف السريري…")}
            value={f.notes}
            onChange={e => setField(req.id, "notes", e.target.value)}
            className="mb-3 text-sm min-h-[50px]"
          />

          <Button
            size="sm"
            className="w-full gap-1.5 bg-orange-600 hover:bg-orange-700"
            onClick={() => handleAction(req.id, "dispensed")}
            disabled={loading[req.id]}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {t("Clinical Sign-Off & Dispense", "تأكيد الصرف السريري")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  function PackagingCard({ req, mode }: { req: any; mode: "dispense" | "packaging" }) {
    const f = getForm(req.id);
    return (
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-bold text-sm">#{req.id} — {req.requester_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}
              </div>
              {req.batch_serial && <div className="text-xs text-muted-foreground">{t("Batch:", "الدفعة:")} {req.batch_serial}</div>}
              {req.bin_location && <div className="text-xs text-muted-foreground">{t("Bin:", "الصندوق:")} {req.bin_location}</div>}
            </div>
          </div>

          {mode === "dispense" && (
            <>
              <Input
                placeholder={t("QR / Seal tag code", "رمز ختم الطرد")}
                value={f.qr}
                onChange={e => setField(req.id, "qr", e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <Button
                size="sm"
                className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAction(req.id, "packaging")}
                disabled={loading[req.id]}
              >
                <Package className="w-3.5 h-3.5" />
                {t("Start Packaging", "بدء التعبئة")}
              </Button>
            </>
          )}

          {mode === "packaging" && (
            <>
              <Input
                placeholder={t("QR / Seal tag code", "رمز ختم الطرد")}
                value={f.qr}
                onChange={e => setField(req.id, "qr", e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <Button
                size="sm"
                className="w-full gap-1.5 bg-teal-600 hover:bg-teal-700"
                onClick={() => handleAction(req.id, "packaged")}
                disabled={loading[req.id]}
              >
                <QrCode className="w-3.5 h-3.5" />
                {t("Certify Package Ready", "اعتماد جاهزية الطرد")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Pharmacist Portal", "بوابة الصيدلاني")}
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pill className="w-6 h-6 text-orange-600" />
          {t("Clinical Dispensing & Packaging", "الصرف السريري والتعبئة")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t(
            "Verify drug interactions, record batch identifiers, sign off clinically, then seal and certify packages for delivery.",
            "تحقق من التفاعلات الدوائية وسجّل معرفات الدفعة وفوّض الصرف السريري ثم أغلق الطرود واعتمد جاهزيتها للتوصيل."
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: t("Awaiting Review", "بانتظار المراجعة"), count: dispensing?.length, color: "orange" },
          { label: t("Dispensed", "تم الصرف"),              count: dispensed?.length,  color: "amber" },
          { label: t("Packaging",  "قيد التعبئة"),          count: packaging?.length,  color: "teal" },
          { label: t("Packaged",   "جاهز للتوصيل"),         count: packaged?.length,   color: "emerald" },
        ].map(({ label, count, color }) => (
          <Card key={label} className={`bg-${color}-50 border-${color}-200`}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold text-${color}-800`}>{count ?? "—"}</div>
              <div className={`text-xs text-${color}-700 font-medium mt-1`}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="dispensing">
        <TabsList className="mb-4">
          <TabsTrigger value="dispensing">
            {t("Review Queue", "قائمة المراجعة")} {dispensing?.length ? `(${dispensing.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="dispensed">
            {t("Dispensed", "تم الصرف")} {dispensed?.length ? `(${dispensed.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="packaging">
            {t("Packaging", "قيد التعبئة")} {packaging?.length ? `(${packaging.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="packaged">{t("Packaged", "جاهز")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dispensing" className="space-y-3">
          {loadDsp ? (
            [1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)
          ) : !dispensing?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-orange-300" />
              <div className="font-medium text-sm">{t("No prescriptions awaiting clinical review", "لا وصفات بانتظار المراجعة السريرية")}</div>
            </div>
          ) : dispensing.map(req => <RxCard key={req.id} req={req} />)}
        </TabsContent>

        <TabsContent value="dispensed" className="space-y-3">
          {!dispensed?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("No dispensed records", "لا سجلات صرف")}
            </div>
          ) : dispensed.map(req => <PackagingCard key={req.id} req={req} mode="dispense" />)}
        </TabsContent>

        <TabsContent value="packaging" className="space-y-3">
          {!packaging?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("No packages in progress", "لا طرود قيد التعبئة")}
            </div>
          ) : packaging.map(req => <PackagingCard key={req.id} req={req} mode="packaging" />)}
        </TabsContent>

        <TabsContent value="packaged" className="space-y-3">
          {!packaged?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("No packaged requests", "لا طرود جاهزة")}
            </div>
          ) : packaged.map(req => (
            <Card key={req.id} className="border-l-4 border-l-teal-500">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm">#{req.id} — {req.requester_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}
                    </div>
                    {req.package_qr && <div className="text-xs text-muted-foreground">{t("QR:", "رمز:")} {req.package_qr}</div>}
                  </div>
                  <span className="text-xs bg-teal-100 text-teal-800 font-medium px-2 py-1 rounded-full">
                    {t("Ready for Delivery", "جاهز للتوصيل")}
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
