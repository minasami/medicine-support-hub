import { useEffect, useState } from "react";
import { Link } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, CheckCircle, Truck, XCircle } from "lucide-react";

type RequestRow = {
  id: number;
  tracking_code: string;
  status: string;
  urgency: string;
  medicines: Array<{ name_en?: string; quantity?: number; notes?: string }>;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  dispensing: "Dispensing",
  dispensed: "Dispensed",
  packaging: "Packaging",
  packaged: "Packaged",
  in_transit: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STEPS = [
  { key: "pending",    en: "Submitted",          ar: "مُقدَّم",            icon: Clock },
  { key: "approved",   en: "Approved",           ar: "موافق عليه",        icon: CheckCircle },
  { key: "dispensed",  en: "Dispensed",           ar: "تم الصرف",           icon: Package },
  { key: "packaged",   en: "Packaged",            ar: "معبأ",               icon: Package },
  { key: "in_transit", en: "Out for Delivery",    ar: "في الطريق",          icon: Truck },
  { key: "delivered",  en: "Delivered",           ar: "تم التوصيل",         icon: CheckCircle },
];

const ORDER_MAP: Record<string, number> = {
  pending: 0, under_review: 0, approved: 1, rejected: 1, dispensing: 1, dispensed: 2,
  packaging: 3, packaged: 3, in_transit: 4, delivered: 5, completed: 5,
};

function iconFor(status: string) {
  if (["delivered", "completed"].includes(status)) return CheckCircle;
  if (["in_transit"].includes(status)) return Truck;
  if (["dispensing", "dispensed", "packaging", "packaged"].includes(status)) return Package;
  return Clock;
}

export default function PatientTrackPage() {
  const { isAuthenticated, supabaseFetch } = usePatientAuth();
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    supabaseFetch<RequestRow[]>("/rest/v1/medicine_requests?select=id,tracking_code,status,urgency,medicines,created_at,updated_at&order=created_at.desc")
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load requests"))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Track your medicine requests</CardTitle>
            <CardDescription>Sign in to see your current and previous requests.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild><Link href="/account">Sign in</Link></Button>
            <Button asChild variant="outline"><Link href="/request">New request</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Requests</h1>
          <p className="text-muted-foreground">Track your current requests and review previous orders.</p>
        </div>
        <Button asChild><Link href="/request">New request</Link></Button>
      </div>

      {loading && <p className="text-muted-foreground">Loading your requests...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !rows.length && !error && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No requests yet.</CardContent></Card>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const Icon = iconFor(row.status);
          const stepIdx = ORDER_MAP[row.status] ?? 0;
          const isRejected = row.status === "rejected" || row.status === "cancelled";

          return (
            <Card key={row.id} className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-blue-600 animate-pulse" />
                      <div className="font-bold text-slate-800">Request #{row.id}</div>
                      <Badge variant="secondary" className="capitalize">
                        {statusLabels[row.status] ?? row.status}
                      </Badge>
                      {row.urgency === "critical" && <Badge variant="destructive">Critical</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Submitted {new Date(row.created_at).toLocaleString()} • Last updated {new Date(row.updated_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded inline-block font-mono">
                      Tracking code: {row.tracking_code}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">{t("Requested Medicines:", "الأدوية المطلوبة:")}</div>
                  {row.medicines?.map((medicine, index) => (
                    <div key={index} className="flex justify-between gap-3 text-sm border-b border-dashed border-slate-100 pb-1 last:border-0 last:pb-0">
                      <span className="font-medium text-slate-700">{medicine.name_en ?? "Medicine"}</span>
                      <span className="text-muted-foreground">Qty: {medicine.quantity ?? 1}</span>
                    </div>
                  ))}
                </div>

                {isRejected ? (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-red-800">
                        {row.status === "rejected" ? t("Request Rejected", "تم رفض الطلب") : t("Request Cancelled", "تم إلغاء الطلب")}
                      </div>
                      <div className="text-xs text-red-700 mt-1">
                        {t(
                          "This request cannot be fulfilled. Please contact the pharmacy branch for further information.",
                          "تعذر تنفيذ هذا الطلب. يرجى التواصل مع فرع الصيدلية للمزيد من المعلومات."
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Horizontal Timeline */}
                    <div className="hidden md:flex items-start justify-between w-full mt-6 pt-5 border-t">
                      {STATUS_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const done = idx <= stepIdx;
                        const current = idx === stepIdx;
                        return (
                          <div key={step.key} className="flex-1 flex flex-col items-center relative">
                            {idx < STATUS_STEPS.length - 1 && (
                              <div className={`absolute top-4 left-1/2 right-[-50%] h-0.5 z-0 ${
                                idx < stepIdx ? "bg-blue-600" : "bg-slate-100"
                              }`} />
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
                              done ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-50 text-slate-400 border border-slate-200"
                            } ${current ? "ring-2 ring-blue-400 ring-offset-2 scale-110" : ""}`}>
                              <StepIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] mt-2 font-semibold text-center max-w-[76px] leading-tight ${
                              done ? "text-blue-700" : "text-slate-400"
                            }`}>
                              {t(step.en, step.ar)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Vertical Timeline */}
                    <div className="flex md:hidden flex-col gap-4 mt-6 pt-5 border-t pl-2">
                      {STATUS_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const done = idx <= stepIdx;
                        const current = idx === stepIdx;
                        return (
                          <div key={step.key} className="flex items-center gap-3.5 relative">
                            {idx < STATUS_STEPS.length - 1 && (
                              <div className={`absolute left-4 top-8 bottom-[-16px] w-0.5 z-0 ${
                                idx < stepIdx ? "bg-blue-600" : "bg-slate-100"
                              }`} />
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
                              done ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-50 text-slate-400 border border-slate-200"
                            } ${current ? "ring-2 ring-blue-400 ring-offset-2 scale-110" : ""}`}>
                              <StepIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-xs font-semibold ${
                              done ? "text-blue-700 font-bold" : "text-slate-400"
                            }`}>
                              {t(step.en, step.ar)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
