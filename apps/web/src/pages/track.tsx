import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useTrackRequest } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Clock, CheckCircle, Package, Truck, AlertTriangle } from "lucide-react";

const STATUS_STEPS = [
  { key: "pending",    en: "Submitted",          ar: "مُقدَّم",            icon: Clock },
  { key: "approved",   en: "Clinically Approved", ar: "موافق عليه سريرياً", icon: CheckCircle },
  { key: "dispensed",  en: "Dispensed",           ar: "تم الصرف",           icon: Package },
  { key: "packaged",   en: "Packaged",            ar: "معبأ",               icon: Package },
  { key: "in_transit", en: "Out for Delivery",    ar: "في الطريق",          icon: Truck },
  { key: "delivered",  en: "Delivered",           ar: "تم التوصيل",         icon: CheckCircle },
];

const ORDER_MAP: Record<string, number> = {
  pending: 0, approved: 1, rejected: 1, dispensing: 1, dispensed: 2,
  packaging: 3, packaged: 3, in_transit: 4, delivered: 5, completed: 5,
};

export default function TrackOrder() {
  const { t, language } = useLanguage();
  const [input, setInput] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);

  const { data: track, isLoading, isError } = useTrackRequest(
    requestId ?? 0,
    { query: { enabled: requestId !== null && requestId > 0, queryKey: ["track", requestId] } }
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(input.trim(), 10);
    if (Number.isFinite(id) && id > 0) {
      setRequestId(id);
    } else {
      setRequestId(null);
    }
  }

  const stepIdx   = track ? (ORDER_MAP[track.status] ?? 0) : 0;
  const isRejected = track?.status === "rejected";

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 mb-4">
          <Truck className="w-3.5 h-3.5" />
          {t("Order Tracking", "تتبع الطلب")}
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t("Track Your Request", "تتبع طلبك")}
        </h1>
        <p className="text-slate-500">
          {t(
            "Enter your request number (shown on your submission confirmation).",
            "أدخل رقم طلبك (يظهر في تأكيد التقديم)."
          )}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-10 h-12"
            placeholder={t("Request number (e.g. 42)…", "رقم الطلب (مثال: 42)…")}
            value={input}
            onChange={e => setInput(e.target.value)}
            type="number"
            min={1}
          />
        </div>
        <Button type="submit" className="h-12 px-6 bg-blue-600 hover:bg-blue-700">
          {t("Track", "تتبع")}
        </Button>
      </form>

      {isLoading && (
        <div className="text-center py-12 text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-3 animate-pulse text-blue-300" />
          <p>{t("Looking up your request…", "جارٍ البحث عن طلبك…")}</p>
        </div>
      )}

      {!isLoading && requestId && isError && (
        <div className="text-center py-12 text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">{t("Request not found", "الطلب غير موجود")}</p>
          <p className="text-sm mt-1">{t("Double-check the request number.", "تحقق من رقم الطلب مرة أخرى.")}</p>
        </div>
      )}

      {!isLoading && track && (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-bold text-slate-900 text-lg">
                  {t("Request", "الطلب")} #{track.id}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t("Submitted", "تم التقديم")} {new Date(track.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
                isRejected
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-blue-100 text-blue-700 border-blue-200"
              }`}>
                {track.status.replace(/_/g, " ").toUpperCase()}
              </div>
            </div>

            {isRejected ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  {t("Request Not Approved", "الطلب غير موافق عليه")}
                </div>
                <p className="text-red-600 text-sm">
                  {t(
                    "Please contact your pharmacy branch for further information.",
                    "يرجى التواصل مع فرع الصيدلية للمزيد من المعلومات."
                  )}
                </p>
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
                          done ? "text-blue-700 font-bold" : "text-slate-400"
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

            <p className="text-xs text-slate-400 mt-4 text-center">
              {t("Last updated", "آخر تحديث")}: {new Date(track.updated_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
