import { useEffect, useState } from "react";
import { Link } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

const STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["Submitted", "مُقدَّم"],
  under_review: ["Under review", "قيد المراجعة"],
  approved: ["Approved", "موافق عليه"],
  rejected: ["Rejected", "مرفوض"],
  dispensing: ["Dispensing", "جاري الصرف"],
  dispensed: ["Dispensed", "تم الصرف"],
  packaging: ["Packaging", "جاري التعبئة"],
  packaged: ["Packaged", "معبأ"],
  in_transit: ["Out for delivery", "في الطريق"],
  delivered: ["Delivered", "تم التوصيل"],
  completed: ["Completed", "مكتمل"],
  cancelled: ["Cancelled", "ملغى"],
};

const STATUS_STEPS = [
  { key: "pending", en: "Submitted", ar: "مُقدَّم", icon: Clock },
  { key: "approved", en: "Approved", ar: "موافق عليه", icon: CheckCircle },
  { key: "dispensed", en: "Dispensed", ar: "تم الصرف", icon: Package },
  { key: "packaged", en: "Packaged", ar: "معبأ", icon: Package },
  { key: "in_transit", en: "Out for Delivery", ar: "في الطريق", icon: Truck },
  { key: "delivered", en: "Delivered", ar: "تم التوصيل", icon: CheckCircle },
];

const ORDER_MAP: Record<string, number> = {
  pending: 0,
  under_review: 0,
  approved: 1,
  rejected: 1,
  dispensing: 1,
  dispensed: 2,
  packaging: 3,
  packaged: 3,
  in_transit: 4,
  delivered: 5,
  completed: 5,
};

function iconFor(status: string) {
  if (["delivered", "completed"].includes(status)) return CheckCircle;
  if (["in_transit"].includes(status)) return Truck;
  if (["dispensing", "dispensed", "packaging", "packaged"].includes(status))
    return Package;
  if (["rejected", "cancelled"].includes(status)) return XCircle;
  return Clock;
}

export default function PatientTrackPage() {
  const { isAuthenticated, supabaseFetch } = usePatientAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    supabaseFetch<RequestRow[]>(
      "/rest/v1/medicine_requests?select=id,tracking_code,status,urgency,medicines,created_at,updated_at&order=created_at.desc",
    )
      .then(setRows)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : t("Could not load requests", "تعذّر تحميل الطلبات"),
        ),
      )
      .finally(() => setLoading(false));
  }, [isAuthenticated, supabaseFetch, t]);

  const statusText = (status: string) => {
    const pair = STATUS_LABELS[status];
    return pair ? t(pair[0], pair[1]) : status;
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("Track your medicine requests", "تتبّع طلبات أدويتك")}
            </CardTitle>
            <CardDescription>
              {t(
                "Sign in to see your current and previous requests.",
                "سجّل الدخول لعرض طلباتك الحالية والسابقة.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/account">{t("Sign in", "تسجيل الدخول")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/request">{t("New request", "طلب جديد")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t("My Requests", "طلباتي")}</h1>
          <p className="text-muted-foreground">
            {t(
              "Track your current requests and review previous orders.",
              "تتبّع طلباتك الحالية وراجع الطلبات السابقة.",
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/request">{t("New request", "طلب جديد")}</Link>
        </Button>
      </div>

      {loading && (
        <p className="text-muted-foreground">
          {t("Loading your requests...", "جاري تحميل طلباتك...")}
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !rows.length && !error && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("No requests yet.", "لا توجد طلبات بعد.")}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const Icon = iconFor(row.status);
          const stepIdx = ORDER_MAP[row.status] ?? 0;
          const isRejected =
            row.status === "rejected" || row.status === "cancelled";

          return (
            <Card key={row.id} className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-5 w-5 text-blue-600" />
                      <div className="font-bold text-slate-800">
                        {t("Request", "طلب")} #{row.id}
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {statusText(row.status)}
                      </Badge>
                      {row.urgency === "critical" && (
                        <Badge variant="destructive">
                          {t("Critical", "حرج")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("Submitted", "قُدِّم")}{" "}
                      {new Date(row.created_at).toLocaleString()} •{" "}
                      {t("Last updated", "آخر تحديث")}{" "}
                      {new Date(row.updated_at).toLocaleString()}
                    </div>
                    {row.tracking_code && (
                      <div className="text-xs font-mono text-slate-600">
                        {t("Tracking", "التتبّع")}: {row.tracking_code}
                      </div>
                    )}
                    <ul className="text-sm text-slate-700 space-y-1 pt-1">
                      {(row.medicines || []).map((med, idx) => (
                        <li key={idx}>
                          {med.name_en || t("Medicine", "دواء")}
                          {med.quantity ? ` × ${med.quantity}` : ""}
                          {med.notes ? ` — ${med.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {!isRejected && (
                  <>
                    <div className="hidden md:flex items-start justify-between gap-2 mt-6 pt-5 border-t">
                      {STATUS_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const done = idx <= stepIdx;
                        const current = idx === stepIdx;
                        return (
                          <div
                            key={step.key}
                            className="flex flex-col items-center flex-1 relative"
                          >
                            {idx < STATUS_STEPS.length - 1 && (
                              <div
                                className={`absolute left-1/2 top-4 h-0.5 w-full z-0 ${
                                  idx < stepIdx ? "bg-blue-600" : "bg-slate-100"
                                }`}
                              />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
                                done
                                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                  : "bg-slate-50 text-slate-400 border border-slate-200"
                              } ${current ? "ring-2 ring-blue-400 ring-offset-2 scale-110" : ""}`}
                            >
                              <StepIcon className="w-3.5 h-3.5" />
                            </div>
                            <span
                              className={`text-[10px] mt-2 font-semibold text-center max-w-[76px] leading-tight ${
                                done ? "text-blue-700" : "text-slate-400"
                              }`}
                            >
                              {t(step.en, step.ar)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex md:hidden flex-col gap-4 mt-6 pt-5 border-t pl-2">
                      {STATUS_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const done = idx <= stepIdx;
                        const current = idx === stepIdx;
                        return (
                          <div
                            key={step.key}
                            className="flex items-center gap-3.5 relative"
                          >
                            {idx < STATUS_STEPS.length - 1 && (
                              <div
                                className={`absolute left-4 top-8 bottom-[-16px] w-0.5 z-0 ${
                                  idx < stepIdx ? "bg-blue-600" : "bg-slate-100"
                                }`}
                              />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
                                done
                                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                  : "bg-slate-50 text-slate-400 border border-slate-200"
                              } ${current ? "ring-2 ring-blue-400 ring-offset-2 scale-110" : ""}`}
                            >
                              <StepIcon className="w-3.5 h-3.5" />
                            </div>
                            <span
                              className={`text-xs font-semibold ${
                                done
                                  ? "text-blue-700 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              {t(step.en, step.ar)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {isRejected && (
                  <p className="mt-4 text-sm text-red-600 font-medium">
                    {t(
                      "This request was closed without delivery.",
                      "أُغلق هذا الطلب دون توصيل.",
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
