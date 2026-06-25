import { useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { useGetDashboardSummary, useGetRecentActivity, useListRequests, getListRequestsQueryKey, getGetDashboardSummaryQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Clock, CheckCircle2, XCircle, Package, Truck, Inbox, ChevronRight, PackageOpen } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20",
  rejected: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
  preparing: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20",
  ready: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-teal-500/20",
  delivered: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20",
  closed: "bg-muted text-muted-foreground hover:bg-muted/80 border-border"
};

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity(
    { limit: 5 },
    { query: { queryKey: getGetRecentActivityQueryKey({ limit: 5 }) } }
  );

  const queryStatus = statusFilter === "all" ? undefined : (statusFilter as any);
  const { data: requests, isLoading: loadingRequests } = useListRequests(
    { status: queryStatus },
    { query: { queryKey: getListRequestsQueryKey({ status: queryStatus }) } }
  );

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("Reviewer Dashboard", "لوحة المراجع")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("Manage and process chronic medicine requests.", "إدارة ومعالجة طلبات أدوية الأمراض المزمنة.")}
          </p>
        </div>
        <Link href="/clinical-assistant" data-testid="link-clinical-assistant">
          <Badge variant="outline" className="px-4 py-2 text-sm bg-primary/5 hover:bg-primary/10 transition-colors border-primary/20 text-primary cursor-pointer gap-2">
            <Activity className="w-4 h-4" />
            {t("Open Clinical Assistant", "فتح المساعد السريري")}
          </Badge>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        {loadingSummary ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card className="col-span-2 lg:col-span-1 bg-primary/5 border-primary/20">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Inbox className="w-4 h-4" /> {t("Total", "الإجمالي")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.total || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> {t("Pending", "قيد الانتظار")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.pending || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" /> {t("Approved", "موافق عليه")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.approved || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" /> {t("Preparing", "قيد التجهيز")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.preparing || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <PackageOpen className="w-4 h-4 text-teal-500" /> {t("Ready", "جاهز")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.ready || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4 text-green-500" /> {t("Delivered", "تم التوصيل")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.delivered || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t("Closed", "مغلق")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.closed || 0}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> {t("Rejected", "مرفوض")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{summary?.rejected || 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <div className="overflow-x-auto pb-2 -mb-2">
              <TabsList className="w-auto inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
                <TabsTrigger value="all" data-testid="tab-all">{t("All Requests", "كل الطلبات")}</TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">{t("Pending", "قيد الانتظار")}</TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">{t("Approved", "موافق عليه")}</TabsTrigger>
                <TabsTrigger value="preparing" data-testid="tab-preparing">{t("Preparing", "قيد التجهيز")}</TabsTrigger>
                <TabsTrigger value="ready" data-testid="tab-ready">{t("Ready", "جاهز")}</TabsTrigger>
                <TabsTrigger value="delivered" data-testid="tab-delivered">{t("Delivered", "تم التوصيل")}</TabsTrigger>
                <TabsTrigger value="closed" data-testid="tab-closed">{t("Closed", "مغلق")}</TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-6 space-y-4">
              {loadingRequests ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6 h-24" />
                  </Card>
                ))
              ) : requests?.length === 0 ? (
                <div className="text-center py-12 border rounded-xl bg-muted/20">
                  <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium text-muted-foreground">{t("No requests found", "لم يتم العثور على طلبات")}</p>
                </div>
              ) : (
                requests?.map((req) => (
                  <Link key={req.id} href={`/dashboard/request/${req.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-lg">{req.requester_name}</span>
                            <Badge variant="outline" className={statusColors[req.status]}>
                              {t(req.status.charAt(0).toUpperCase() + req.status.slice(1), req.status)}
                            </Badge>
                            {req.is_for_relative && (
                              <Badge variant="secondary" className="text-xs">
                                {t("For relative", "لقريب")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex gap-4">
                            <span>{req.medicines.length} {t("medicines", "أدوية")}</span>
                            <span>•</span>
                            <span>{formatDate(req.created_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors rtl:rotate-180" />
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t("Recent Activity", "النشاط الأخير")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="w-2 h-2 rounded-full mt-2" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("No recent activity", "لا يوجد نشاط أخير")}</p>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-1.5 rtl:before:mr-1.5 rtl:before:ml-auto before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                  {activity?.map((act) => (
                    <div key={act.id} className="relative flex items-start gap-4">
                      <div className="absolute left-0 rtl:left-auto rtl:right-0 w-3 h-3 rounded-full bg-primary/20 border-2 border-background mt-1.5 z-10" />
                      <div className="flex-1 ml-6 rtl:ml-0 rtl:mr-6">
                        <p className="text-sm font-medium">
                          {act.requester_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {act.action} • <span className="font-mono text-[10px]">{formatDate(act.created_at)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
