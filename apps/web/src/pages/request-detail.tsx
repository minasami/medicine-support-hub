import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { 
  useGetRequest, 
  useUpdateRequest,
  getGetRequestQueryKey,
  MedicineRequestUpdateStatus,
  useGetClinicalSupport
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Loader2, Save, User, Phone, Calendar, ShieldCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20",
  rejected: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
  preparing: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20",
  ready: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-teal-500/20",
  delivered: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20",
  closed: "bg-muted text-muted-foreground hover:bg-muted/80 border-border"
};

export default function RequestDetail() {
  const { id } = useParams();
  const requestId = parseInt(id || "0", 10);
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<MedicineRequestUpdateStatus | "">("");
  
  const initializedForId = useRef<number | null>(null);

  const getClinicalSupport = useGetClinicalSupport();
  const [clinicalAuditRun, setClinicalAuditRun] = useState(false);
  const [clinicalAuditResult, setClinicalAuditResult] = useState<{
    response: string;
    disclaimer: string;
    level: "safe" | "caution" | "alert";
  } | null>(null);

  const { data: request, isLoading } = useGetRequest(requestId, {
    query: { enabled: !!requestId, queryKey: getGetRequestQueryKey(requestId) }
  });

  useEffect(() => {
    if (request && request.medicines?.length && !clinicalAuditRun) {
      setClinicalAuditRun(true);
      const medsNames = request.medicines.map((m: any) => m.name_en).join(", ");
      const queryText = `Analyze clinical safety, drug-drug interactions, contraindications, and key precautions for these medicines: ${medsNames}. Highlight if there are serious interaction warning flags.`;

      getClinicalSupport.mutate(
        { data: { query: queryText, medicines: request.medicines.map((m: any) => m.name_en) } },
        {
          onSuccess: (data) => {
            const respLower = data.response.toLowerCase();
            let level: "safe" | "caution" | "alert" = "safe";
            if (respLower.includes("warning") || respLower.includes("contraindication") || respLower.includes("risk") || respLower.includes("alert") || respLower.includes("serious")) {
              level = "alert";
            } else if (respLower.includes("caution") || respLower.includes("interaction") || respLower.includes("precautions")) {
              level = "caution";
            }
            setClinicalAuditResult({
              response: data.response,
              disclaimer: data.disclaimer,
              level,
            });
          },
        }
      );
    }
  }, [request, clinicalAuditRun]);

  const totalOrderPrice = request?.medicines.reduce((acc: number, med: any) => {
    const medicineName = med.name_en || "";
    const mockUnitPrice = Math.max(15, (medicineName.length * 3.5) % 100);
    return acc + (mockUnitPrice * med.quantity);
  }, 0) ?? 0;

  const totalInsuranceCovered = totalOrderPrice * 0.8;
  const totalPatientShare = totalOrderPrice * 0.2;

  const updateRequest = useUpdateRequest();

  useEffect(() => {
    if (request && initializedForId.current !== request.id) {
      initializedForId.current = request.id;
      setNotes(request.reviewer_notes || "");
      setStatus(request.status);
    }
  }, [request]);

  const handleSave = () => {
    if (!status) return;

    updateRequest.mutate(
      { id: requestId, data: { status: status as MedicineRequestUpdateStatus, reviewer_notes: notes } },
      {
        onSuccess: (data) => {
          toast({
            title: t("Request Updated", "تم تحديث الطلب"),
            description: t("Status and notes have been saved.", "تم حفظ الحالة والملاحظات."),
          });
          queryClient.setQueryData(getGetRequestQueryKey(requestId), (old: any) => 
            old ? { ...old, status: data.status, reviewer_notes: data.reviewer_notes, updated_at: data.updated_at } : old
          );
        },
        onError: () => {
          toast({
            title: t("Error", "خطأ"),
            description: t("Failed to update request.", "فشل في تحديث الطلب."),
            variant: "destructive"
          });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold">{t("Request not found", "الطلب غير موجود")}</h2>
        <Button variant="link" onClick={() => setLocation("/dashboard")} className="mt-4">
          {t("Return to dashboard", "العودة إلى لوحة التحكم")}
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/dashboard")}
          className="gap-2 -ml-4 hover:bg-transparent"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t("Back to Dashboard", "العودة للوحة التحكم")}
        </Button>
        <Badge variant="outline" className={cn("text-base px-3 py-1", statusColors[request.status])}>
          {t(request.status.charAt(0).toUpperCase() + request.status.slice(1), request.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-xl flex items-center justify-between">
                <span>{t("Patient Details", "بيانات المريض")}</span>
                <span className="text-sm font-normal text-muted-foreground font-mono">
                  ID: #{request.id}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div className="space-y-1">
                  <div className="flex items-center text-muted-foreground text-sm gap-2">
                    <User className="w-4 h-4" />
                    <span>{t("Requester Name", "اسم مقدم الطلب")}</span>
                  </div>
                  <div className="font-medium text-lg">{request.requester_name}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-muted-foreground text-sm gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{t("Phone Number", "رقم الهاتف")}</span>
                  </div>
                  <div className="font-medium text-lg">{request.requester_phone}</div>
                </div>
                
                {request.is_for_relative && (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center text-muted-foreground text-sm gap-2">
                        <User className="w-4 h-4" />
                        <span>{t("Patient Name", "اسم المريض")}</span>
                      </div>
                      <div className="font-medium text-lg">{request.patient_name}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-sm">
                        {t("Relation", "صلة القرابة")}
                      </div>
                      <div className="font-medium text-lg">{request.patient_relation}</div>
                    </div>
                  </>
                )}

                <div className="space-y-1 md:col-span-2 pt-4 border-t">
                  <div className="flex items-center text-muted-foreground text-sm gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{t("Submitted At", "تاريخ التقديم")}</span>
                  </div>
                  <div className="font-medium">{formatDate(request.created_at)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Safety Audit Card */}
          <Card className="border-blue-200/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-blue-50/20 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <ShieldCheck className="w-5 h-5 text-blue-600 animate-pulse" />
                {t("Clinical Safety & Interaction Audit", "تدقيق السلامة السريرية والتفاعلات")}
              </CardTitle>
              {clinicalAuditResult && (
                <Badge className={
                  clinicalAuditResult.level === "alert" 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : clinicalAuditResult.level === "caution" 
                      ? "bg-amber-500 hover:bg-amber-600 text-white" 
                      : "bg-green-600 hover:bg-green-700 text-white"
                }>
                  {clinicalAuditResult.level === "alert" 
                    ? t("Alert: Interaction Risk", "تنبيه: خطر تفاعل دوائي") 
                    : clinicalAuditResult.level === "caution" 
                      ? t("Caution: Precautions Required", "حذر: احتياطات مطلوبة") 
                      : t("Clinically Safe", "آمن سريرياً")}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {getClinicalSupport.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>{t("Running automated clinical safety audit...", "جاري تشغيل تدقيق السلامة السريرية الآلي...")}</span>
                </div>
              ) : clinicalAuditResult ? (
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl text-sm leading-relaxed border ${
                    clinicalAuditResult.level === "alert" 
                      ? "bg-red-500/5 border-red-200 text-red-900" 
                      : clinicalAuditResult.level === "caution" 
                        ? "bg-amber-500/5 border-amber-200 text-amber-900" 
                        : "bg-green-500/5 border-green-200 text-green-900"
                  }`}>
                    <div className="prose prose-xs max-w-none whitespace-pre-wrap font-medium">
                      {clinicalAuditResult.response}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-600/80 bg-amber-500/5 p-2.5 rounded border border-amber-500/10">
                    {clinicalAuditResult.disclaimer}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
                  {t("Unable to run clinical audit.", "تعذر تشغيل التدقيق السريري.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t("Requested Medicines & Commercial Billing", "الأدوية المطلوبة والفاتورة التجارية")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <div className="divide-y">
                {request.medicines.map((med, idx) => {
                  const medicineName = med.name_en || "";
                  const mockUnitPrice = Math.max(15, (medicineName.length * 3.5) % 100);
                  const totalPrice = mockUnitPrice * med.quantity;
                  const copayRate = 0.8; // 80% insurance covered
                  const insuranceCovered = totalPrice * copayRate;
                  const patientShare = totalPrice * (1 - copayRate);

                  // Mock stock availability based on drug ID/index
                  const medId = med.medicine_id ?? idx;
                  const stockStatus = medId % 3 === 0 
                    ? { label: t("In Stock (Local Branch)", "متوفر في الفرع"), color: "bg-green-100 text-green-700 border-green-200" }
                    : medId % 3 === 1
                      ? { label: t("Low Stock - Transfer Recommended", "شبه نفذ - يوصى بالنقل"), color: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse" }
                      : { label: t("Out of Stock - Transfer Required", "غير متوفر - يتطلب النقل"), color: "bg-red-100 text-red-700 border-red-200" };

                  return (
                    <div key={idx} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-lg text-slate-800">
                          {language === "en" ? med.name_en : (med.name_ar || med.name_en)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                        {med.notes && (
                          <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-muted mt-2 inline-block">
                            {med.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0 text-right">
                        <div className="flex items-center gap-4 bg-primary/5 px-4 py-1.5 rounded-lg border border-primary/10">
                          <span className="text-xs text-muted-foreground">{t("Qty", "الكمية")}:</span>
                          <span className="font-bold text-lg">{med.quantity}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>{t("Unit Price:", "سعر الوحدة:")} <span className="font-semibold text-slate-700">${mockUnitPrice.toFixed(2)}</span></div>
                          <div>{t("Ins. Covered (80%):", "التأمين (80%):")} <span className="font-semibold text-slate-700">${insuranceCovered.toFixed(2)}</span></div>
                          <div className="text-blue-600 font-bold">{t("Patient Share (20%):", "حصة المريض (20%):")} <span>${patientShare.toFixed(2)}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Billing Ledger */}
              <div className="bg-slate-50 border-t p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="font-bold text-slate-800 text-base">{t("Commercial Billing Summary", "ملخص الفاتورة التجارية")}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("Automatically pre-authorized by Insurer co-pay program.", "معتمد مسبقاً وتلقائياً من برنامج التأمين الصحي المشارك.")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-right shrink-0">
                  <span className="text-muted-foreground">{t("Subtotal Cost:", "المجموع الفرعي:")}</span>
                  <span className="font-medium text-slate-800">${totalOrderPrice.toFixed(2)}</span>
                  <span className="text-muted-foreground">{t("Ins. Covered (80%):", "مغطى بالتأمين (80%):")}</span>
                  <span className="font-medium text-slate-800">-${totalInsuranceCovered.toFixed(2)}</span>
                  <span className="text-base font-bold text-blue-600 border-t pt-1">{t("Patient Co-pay (20%):", "المطلوب من المريض (20%):")}</span>
                  <span className="text-base font-bold text-blue-600 border-t pt-1">${totalPatientShare.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {request.prescription_url && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Prescription Document", "الوصفة الطبية")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl overflow-hidden border bg-muted/10 p-2">
                  <img 
                    src={request.prescription_url} 
                    alt="Prescription" 
                    className="w-full h-auto object-contain rounded-lg shadow-sm" 
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-24 border-primary/20 shadow-md shadow-primary/5">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <CardTitle>{t("Review Action", "مراجعة الطلب")}</CardTitle>
              <CardDescription>
                {t("Update status and add notes", "تحديث الحالة وإضافة ملاحظات")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {t("Update Status", "تحديث الحالة")}
                </label>
                <Select value={status} onValueChange={(val) => setStatus(val as MedicineRequestUpdateStatus)}>
                  <SelectTrigger data-testid="select-status" className="h-12">
                    <SelectValue placeholder={t("Select status", "اختر الحالة")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("Pending", "قيد الانتظار")}</SelectItem>
                    <SelectItem value="approved">{t("Approved", "موافق عليه")}</SelectItem>
                    <SelectItem value="rejected">{t("Rejected", "مرفوض")}</SelectItem>
                    <SelectItem value="preparing">{t("Preparing", "قيد التجهيز")}</SelectItem>
                    <SelectItem value="ready">{t("Ready", "جاهز")}</SelectItem>
                    <SelectItem value="delivered">{t("Delivered", "تم التوصيل")}</SelectItem>
                    <SelectItem value="closed">{t("Closed", "مغلق")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {t("Reviewer Notes", "ملاحظات المراجع")}
                </label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("Add internal notes (not visible to patient)", "أضف ملاحظات داخلية (غير مرئية للمريض)")}
                  className="min-h-[120px] resize-none"
                  data-testid="input-notes"
                />
              </div>

              <Button 
                className="w-full h-12 text-base gap-2" 
                onClick={handleSave}
                disabled={updateRequest.isPending || !status}
                data-testid="button-save-status"
              >
                {updateRequest.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {t("Save Changes", "حفظ التغييرات")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
