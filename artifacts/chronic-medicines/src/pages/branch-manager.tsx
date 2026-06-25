import { useLanguage } from "@/lib/i18n";
import { useGetDashboardSummary, useGetRecentActivity, useListRequests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, TrendingUp, Users, CheckCircle, AlertTriangle, Activity, Package, AlertCircle } from "lucide-react";

const STAFF_MOCK = [
  { name: "Dr. Sarah Al-Mansouri", role: "Reviewer", status: "active", requests: 12 },
  { name: "Ahmad Khalil", role: "Pharmacist", status: "active", requests: 8 },
  { name: "Fatima Hassan", role: "Pharmacy Assistant", status: "active", requests: 15 },
  { name: "Dr. Omar Nasser", role: "Physician", status: "active", requests: 7 },
  { name: "Khalid Al-Rashid", role: "Delivery Man", status: "on-route", requests: 4 },
  { name: "Layla Mahmoud", role: "Cosmetician", status: "break", requests: 3 },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  "on-route": "bg-sky-100 text-sky-800",
  break: "bg-amber-100 text-amber-800",
  offline: "bg-slate-100 text-slate-600",
};

// Inventory mock data — quantities below reorder threshold
const INVENTORY_MOCK = [
  { name: "Metformin 500mg", nameAr: "ميتفورمين 500 ملغ", stock: 42, reorder: 50, unit: "tablets", status: "low" },
  { name: "Amlodipine 5mg", nameAr: "أملوديبين 5 ملغ", stock: 78, reorder: 60, unit: "tablets", status: "ok" },
  { name: "Lisinopril 10mg", nameAr: "ليسينوبريل 10 ملغ", stock: 12, reorder: 40, unit: "tablets", status: "critical" },
  { name: "Atorvastatin 20mg", nameAr: "أتورفاستاتين 20 ملغ", stock: 95, reorder: 50, unit: "tablets", status: "ok" },
  { name: "Losartan 50mg", nameAr: "لوسارتان 50 ملغ", stock: 18, reorder: 40, unit: "tablets", status: "critical" },
  { name: "Levothyroxine 50mcg", nameAr: "ليفوثيروكسين 50 ميكروغرام", stock: 64, reorder: 40, unit: "tablets", status: "ok" },
  { name: "Insulin Glargine", nameAr: "إنسولين جلارجين", stock: 5, reorder: 15, unit: "pens", status: "critical" },
  { name: "Salbutamol Inhaler", nameAr: "سالبوتامول بخاخ", stock: 22, reorder: 25, unit: "units", status: "low" },
];

const INV_STATUS = {
  ok:       { label: "OK",       labelAr: "جيد",      color: "bg-emerald-500" },
  low:      { label: "Low",      labelAr: "منخفض",   color: "bg-amber-500" },
  critical: { label: "Critical", labelAr: "حرج",      color: "bg-red-500" },
};

export default function BranchManagerPortal() {
  const { t, language } = useLanguage();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity({ limit: 8 });
  const { data: pending } = useListRequests({ status: "pending" as any, limit: 100 });

  const sum = summary as any;
  const criticalCount = (pending ?? []).filter((r: any) => r.urgency === "critical").length;

  const criticalInventory = INVENTORY_MOCK.filter(i => i.status === "critical").length;
  const lowInventory = INVENTORY_MOCK.filter(i => i.status === "low").length;

  const PIPELINE = [
    { key: "pending", labelEn: "Pending", labelAr: "قيد الانتظار", color: "bg-yellow-500", count: sum?.pending ?? 0 },
    { key: "approved", labelEn: "Approved", labelAr: "موافق عليه", color: "bg-blue-500", count: sum?.approved ?? 0 },
    { key: "dispensed", labelEn: "Dispensed", labelAr: "تم الصرف", color: "bg-amber-500", count: sum?.dispensed ?? 0 },
    { key: "packaged", labelEn: "Packaged", labelAr: "معبأ", color: "bg-emerald-500", count: sum?.packaged ?? 0 },
    { key: "delivered", labelEn: "Delivered", labelAr: "تم التوصيل", color: "bg-green-600", count: (sum?.delivered ?? 0) + (sum?.completed ?? 0) },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {t("Branch Manager Portal", "بوابة مدير الفرع")}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-teal-600" />
            {t("Branch Operations Overview", "نظرة عامة على عمليات الفرع")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("Monitor branch KPIs, staff activity, inventory, and request pipeline.", "راقب مؤشرات الفرع ونشاط الموظفين والمخزون وخط أنابيب الطلبات.")}
          </p>
        </div>
        {(criticalCount > 0 || criticalInventory > 0) && (
          <div className="flex flex-col gap-2">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" />
                {criticalCount} {t("Critical Requests", "طلبات حرجة")}
              </div>
            )}
            {criticalInventory > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-semibold text-orange-700">
                <AlertCircle className="w-4 h-4" />
                {criticalInventory} {t("Items Out of Stock", "عناصر نفدت من المخزون")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {isLoading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24" />) : (
          <>
            <Card className="bg-gradient-to-br from-teal-700 to-teal-800 text-white border-0">
              <CardContent className="p-5">
                <div className="text-3xl font-bold">{sum?.total ?? 0}</div>
                <div className="text-teal-200 text-xs mt-1">{t("Total Requests", "إجمالي الطلبات")}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-5">
                <div className="text-3xl font-bold text-yellow-800">{sum?.pending ?? 0}</div>
                <div className="text-yellow-700 text-xs mt-1">{t("Pending Review", "بانتظار المراجعة")}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-5">
                <div className="text-3xl font-bold text-emerald-800">{(sum?.delivered ?? 0) + (sum?.completed ?? 0)}</div>
                <div className="text-emerald-700 text-xs mt-1">{t("Fulfilled", "مُنجز")}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-5">
                <div className="text-3xl font-bold text-red-800">{criticalCount}</div>
                <div className="text-red-700 text-xs mt-1">{t("Critical Cases", "حالات حرجة")}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Row 2: Pipeline + Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              {t("Pipeline Status", "حالة خط الأنابيب")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PIPELINE.map(p => (
                <div key={p.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{language === "en" ? p.labelEn : p.labelAr}</span>
                    <span className="font-bold">{p.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded overflow-hidden">
                    <div className={`h-full ${p.color} rounded`} style={{ width: `${Math.min((p.count / (sum?.total || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              {t("Staff on Duty", "الموظفون في الدوام")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {STAFF_MOCK.map(s => (
                <div key={s.name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center font-bold text-xs">
                      {s.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.requests} req</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? ""}`}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Inventory Snapshot + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-teal-600" />
              {t("Inventory Snapshot", "لقطة المخزون")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {INVENTORY_MOCK.map(item => {
                const pct = Math.min((item.stock / item.reorder) * 100, 100);
                const cfg = INV_STATUS[item.status as keyof typeof INV_STATUS];
                return (
                  <div key={item.name} className="py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{language === "en" ? item.name : item.nameAr}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{item.stock}/{item.reorder} {item.unit}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold text-white ${cfg.color}`}>
                          {language === "en" ? cfg.label : cfg.labelAr}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${cfg.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{criticalInventory} {t("critical", "حرج")}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{lowInventory} {t("low", "منخفض")}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{INVENTORY_MOCK.length - criticalInventory - lowInventory} {t("OK", "جيد")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              {t("Recent Activity", "النشاط الأخير")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activity?.map(a => (
                <div key={a.id} className="flex items-start justify-between text-xs border-b pb-1.5">
                  <div>
                    <span className="font-medium">#{a.request_id}</span>
                    <span className="text-muted-foreground ml-1">{a.action}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
              {!activity?.length && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CheckCircle className="w-8 h-8 mx-auto mb-1 text-emerald-400" />
                  {t("No activity yet", "لا نشاط بعد")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
