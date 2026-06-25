import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useListRequests, useCreateRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Download, Upload, Plus, CheckCircle } from "lucide-react";

const CSV_TEMPLATE = `requester_name,requester_phone,medicine_en,quantity,notes,urgency
John Doe,+966500000000,Metformin 500mg,60,30-day supply,normal
Jane Smith,+966500000001,Atorvastatin 20mg,30,,critical`;

export default function DataEntryPortal() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [csvText, setCsvText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; status: "ok" | "err" }>>([]);

  const { data: recent, refetch, isLoading } = useListRequests({ limit: 20 });
  const { mutateAsync: createRequest } = useCreateRequest();

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chronicmed_bulk_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function processCsv() {
    const lines = csvText.trim().split("\n").filter(l => l.trim() && !l.startsWith("requester_name"));
    if (!lines.length) {
      toast({ title: t("No data to process", "لا بيانات للمعالجة"), variant: "destructive" });
      return;
    }
    setProcessing(true);
    setResults([]);
    const newResults: Array<{ name: string; status: "ok" | "err" }> = [];

    for (const line of lines) {
      const cols = line.split(",").map(c => c.trim());
      const [name, phone, medicine, qty, notes, urgency] = cols;
      if (!name || !phone || !medicine) {
        newResults.push({ name: name || "Unknown", status: "err" });
        continue;
      }
      try {
        await createRequest({
          data: {
            requester_name: name,
            requester_phone: phone,
            is_for_relative: false,
            medicines: [{ name_en: medicine, quantity: parseInt(qty ?? "1") || 1, notes: notes || null }],
            urgency: (urgency === "critical" ? "critical" : "normal") as any,
          } as any,
        });
        newResults.push({ name, status: "ok" });
      } catch {
        newResults.push({ name, status: "err" });
      }
    }

    setResults(newResults);
    setProcessing(false);
    refetch();
    const okCount = newResults.filter(r => r.status === "ok").length;
    toast({
      title: t(`${okCount} of ${newResults.length} records imported`, `تم استيراد ${okCount} من ${newResults.length} سجل`),
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Data Entry Operator Portal", "بوابة موظف إدخال البيانات")}
        </div>
        <h1 className="text-2xl font-bold">{t("Record Management & Bulk Processing", "إدارة السجلات والمعالجة المجمعة")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Upload CSV templates for bulk prescription entry or manage historical audit records.", "رفع قوالب CSV للإدخال المجمع للوصفات أو إدارة سجلات التدقيق.")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* CSV Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              {t("Bulk CSV Import", "استيراد CSV مجمع")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" />
                {t("Download Template", "تنزيل القالب")}
              </Button>
            </div>
            <textarea
              className="w-full h-36 text-xs font-mono border border-input rounded-md p-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("Paste CSV data here (or use template above)...\nrequester_name,requester_phone,medicine_en,quantity,notes,urgency", "الصق بيانات CSV هنا...")}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
            />
            {results.length > 0 && (
              <div className="border border-border rounded p-2 space-y-1 max-h-28 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${r.status === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                    {r.status === "ok" ? "✓" : "✗"} {r.name}
                  </div>
                ))}
              </div>
            )}
            <Button
              className="w-full gap-1.5"
              onClick={processCsv}
              disabled={processing || !csvText.trim()}
            >
              <Plus className="w-4 h-4" />
              {processing ? t("Processing...", "جاري المعالجة...") : t("Import Records", "استيراد السجلات")}
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {t("Recent Submissions", "الطلبات الحديثة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recent?.map(req => (
                  <div key={req.id} className="flex items-center justify-between text-xs border-b border-border pb-1.5">
                    <div>
                      <span className="font-medium">#{req.id}</span>
                      <span className="text-muted-foreground ml-2">{req.requester_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        req.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        req.status === "approved" ? "bg-green-100 text-green-800" :
                        req.status === "rejected" ? "bg-red-100 text-red-800" :
                        "bg-slate-100 text-slate-700"
                      }`}>{req.status}</span>
                    </div>
                  </div>
                ))}
                {!recent?.length && (
                  <div className="text-center py-6 text-muted-foreground text-sm">{t("No records yet", "لا سجلات بعد")}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info panel */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <div className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            {t("CSV Format Guide", "دليل تنسيق CSV")}
          </div>
          <div className="font-mono text-xs text-slate-600 space-y-1">
            <div>requester_name, requester_phone, medicine_en, quantity, notes, urgency</div>
            <div className="text-slate-400">— urgency: normal | critical</div>
            <div className="text-slate-400">— quantity: integer (e.g. 30, 60)</div>
            <div className="text-slate-400">— notes: optional free text</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
