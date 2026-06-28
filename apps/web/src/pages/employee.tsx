import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { useListRequests } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, CheckCircle, XCircle, Truck, Package, FlaskConical } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: React.ElementType }> = {
  pending:      { label: "Pending Review", labelAr: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved:     { label: "Approved", labelAr: "موافق عليه", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  rejected:     { label: "Rejected", labelAr: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
  dispensing:   { label: "Dispensing", labelAr: "جاري الصرف", color: "bg-amber-100 text-amber-800", icon: FlaskConical },
  dispensed:    { label: "Dispensed", labelAr: "تم الصرف", color: "bg-amber-200 text-amber-900", icon: FlaskConical },
  packaging:    { label: "Packaging", labelAr: "جاري التعبئة", color: "bg-emerald-100 text-emerald-800", icon: Package },
  packaged:     { label: "Packaged", labelAr: "تمت التعبئة", color: "bg-emerald-200 text-emerald-900", icon: Package },
  in_transit:   { label: "In Transit", labelAr: "في الطريق", color: "bg-sky-100 text-sky-800", icon: Truck },
  delivered:    { label: "Delivered", labelAr: "تم التوصيل", color: "bg-green-100 text-green-800", icon: CheckCircle },
  completed:    { label: "Completed", labelAr: "مكتمل", color: "bg-green-200 text-green-900", icon: CheckCircle },
  preparing:    { label: "Preparing", labelAr: "قيد التحضير", color: "bg-amber-100 text-amber-800", icon: FlaskConical },
  ready:        { label: "Ready", labelAr: "جاهز", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  closed:       { label: "Closed", labelAr: "مغلق", color: "bg-slate-100 text-slate-700", icon: CheckCircle },
};

const PIPELINE = [
  { key: "pending", label: "Pending", labelAr: "بانتظار المراجعة" },
  { key: "approved", label: "Approved", labelAr: "موافق عليه" },
  { key: "dispensed", label: "Dispensed", labelAr: "تم الصرف" },
  { key: "packaged", label: "Packaged", labelAr: "معبأ" },
  { key: "in_transit", label: "In Transit", labelAr: "في الطريق" },
  { key: "delivered", label: "Delivered", labelAr: "تم التوصيل" },
];

export default function EmployeePortal() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const { data: requests, isLoading } = useListRequests({ limit: 100 });

  function getActivePipelineStep(status: string) {
    const order = ["pending", "approved", "dispensing", "dispensed", "packaging", "packaged", "in_transit", "delivered", "completed"];
    return order.indexOf(status);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {t("Employee Portal", "بوابة الموظف")}
          </div>
          <h1 className="text-2xl font-bold">{t("My Benefit Requests", "طلبات مزاياي")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("Track your medicine dispensation requests through the care delivery pipeline.", "تتبع طلبات صرف أدويتك عبر خط تقديم الرعاية.")}
          </p>
        </div>
        <Button onClick={() => navigate("/request")} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          {t("New Request", "طلب جديد")}
        </Button>
      </div>

      {/* Pipeline legend */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100/30 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wider">
            {t("Care Delivery Pipeline", "خط تقديم الرعاية")}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE.map((step, i) => (
              <div key={step.key} className="flex items-center gap-2">
                <div className="text-xs px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 font-medium">
                  {language === "en" ? step.label : step.labelAr}
                </div>
                {i < PIPELINE.length - 1 && <span className="text-blue-300 text-sm">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requests list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !requests?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium">{t("No requests yet", "لا توجد طلبات بعد")}</div>
          <div className="text-sm mt-1">{t("Submit your first medicine request to get started.", "قدم طلب أدويتك الأول للبدء.")}</div>
          <Button onClick={() => navigate("/request")} className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            {t("New Request", "طلب جديد")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG["pending"];
            const Icon = cfg.icon;
            const isUrgent = (req as any).urgency === "critical";
            const pipeStep = getActivePipelineStep(req.status);

            return (
              <Card
                key={req.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/dashboard/request/${req.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">#{req.id}</span>
                        {isUrgent && (
                          <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                            {t("CRITICAL", "حرج")}
                          </span>
                        )}
                        {(req as any).wet_signature_required && (
                          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                            {t("Wet Signature", "توقيع فعلي")}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {req.is_for_relative
                          ? t(`For: ${req.patient_name ?? "Relative"} (${req.patient_relation ?? ""})`, `لصالح: ${req.patient_name ?? "قريب"} (${req.patient_relation ?? ""})`)
                          : t("For: Myself", "لنفسي")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(req.medicines as any[]).map((m: any) => m.name_en).join(", ")}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {language === "en" ? cfg.label : cfg.labelAr}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {/* Mini pipeline bar */}
                  {pipeStep >= 0 && (
                    <div className="mt-3 flex gap-1">
                      {[0,1,2,3,4,5,6].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i <= pipeStep ? "bg-blue-500" : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
