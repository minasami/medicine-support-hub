import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListRequests,
  useListAdminUsers,
  useCreateAdminUser,
  useUpdateAdminUser,
  useListAdminBranches,
  useCreateAdminBranch,
  getListAdminUsersQueryKey,
  getListAdminBranchesQueryKey,
  CreateStaffUserRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Activity, Database, BarChart3, Users, GitBranch, Plus, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const PIPELINE_STAGES = [
  { key: "pending",    label: "Pending",    labelAr: "قيد الانتظار",    color: "bg-yellow-500" },
  { key: "approved",   label: "Approved",   labelAr: "موافق عليه",      color: "bg-blue-500" },
  { key: "dispensing", label: "Dispensing", labelAr: "جاري الصرف",      color: "bg-amber-400" },
  { key: "dispensed",  label: "Dispensed",  labelAr: "تم الصرف",        color: "bg-amber-600" },
  { key: "packaging",  label: "Packaging",  labelAr: "جاري التعبئة",    color: "bg-emerald-400" },
  { key: "packaged",   label: "Packaged",   labelAr: "معبأ",             color: "bg-emerald-600" },
  { key: "in_transit", label: "In Transit", labelAr: "في الطريق",       color: "bg-sky-500" },
  { key: "delivered",  label: "Delivered",  labelAr: "تم التوصيل",      color: "bg-green-500" },
  { key: "completed",  label: "Completed",  labelAr: "مكتمل",           color: "bg-green-700" },
  { key: "rejected",   label: "Rejected",   labelAr: "مرفوض",           color: "bg-red-500" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  dispensing: "bg-amber-100 text-amber-800",
  dispensed: "bg-amber-200 text-amber-900",
  packaging: "bg-emerald-100 text-emerald-800",
  packaged: "bg-emerald-200 text-emerald-900",
  in_transit: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-200 text-green-900",
  closed: "bg-slate-100 text-slate-700",
};

const ALL_ROLES = [
  "REVIEWER", "PHYSICIAN", "PHARMACY_ASSISTANT", "PHARMACIST",
  "DELIVERY_MAN", "BRANCH_MANAGER", "COSMETICIAN",
  "DATA_ENTRY", "PLATFORM_ADMIN",
];

const ROLE_COLORS: Record<string, string> = {
  REVIEWER: "bg-violet-100 text-violet-800",
  PHYSICIAN: "bg-blue-100 text-blue-800",
  PHARMACY_ASSISTANT: "bg-amber-100 text-amber-800",
  PHARMACIST: "bg-orange-100 text-orange-800",
  DELIVERY_MAN: "bg-sky-100 text-sky-800",
  BRANCH_MANAGER: "bg-teal-100 text-teal-800",
  COSMETICIAN: "bg-pink-100 text-pink-800",
  DATA_ENTRY: "bg-slate-100 text-slate-800",
  PLATFORM_ADMIN: "bg-rose-100 text-rose-800",
};

export default function AdminPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity({ limit: 15 });
  const { data: allRequests, isLoading: loadingRequests } = useListRequests({ limit: 200 });

  const { data: users = [], isLoading: loadingUsers } = useListAdminUsers();
  const { data: branches = [] } = useListAdminBranches();

  const { mutateAsync: createUser } = useCreateAdminUser();
  const { mutateAsync: updateUser } = useUpdateAdminUser();
  const { mutateAsync: createBranch } = useCreateAdminBranch();

  const [newUser, setNewUser] = useState({
    username: "", password: "", display_name: "", role: "REVIEWER", branch_id: "",
  });
  const [addingUser, setAddingUser] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  const [newBranch, setNewBranch] = useState({ name: "", name_ar: "", manager_id: "" });
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);

  const sum = summary as any;

  function exportCSV() {
    if (!allRequests?.length) return;
    const headers = ["ID", "Requester", "Phone", "Status", "Urgency", "Medicines", "Department", "Created"];
    const rows = allRequests.map(r => [
      r.id, r.requester_name, r.requester_phone, r.status,
      (r as any).urgency ?? "normal",
      (r.medicines as any[]).map((m: any) => m.name_en).join("; "),
      (r as any).employee_department ?? "",
      new Date(r.created_at).toISOString(),
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chronicmed_export_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    try {
      await createUser({
        data: {
          username: newUser.username,
          password: newUser.password,
          display_name: newUser.display_name,
          role: newUser.role as CreateStaffUserRole,
          branch_id: newUser.branch_id ? Number(newUser.branch_id) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      setUserDialogOpen(false);
      setNewUser({ username: "", password: "", display_name: "", role: "REVIEWER", branch_id: "" });
      toast({ title: t("User created", "تم إنشاء المستخدم") });
    } catch {
      toast({ title: t("Failed to create user", "فشل إنشاء المستخدم"), variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  }

  async function toggleUserActive(user: { id: number; active: boolean }) {
    try {
      await updateUser({ id: user.id, data: { active: !user.active } });
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      toast({
        title: !user.active
          ? t("User activated", "تم تفعيل المستخدم")
          : t("User deactivated", "تم إلغاء تفعيل المستخدم"),
      });
    } catch {
      toast({ title: t("Error", "خطأ"), variant: "destructive" });
    }
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    setAddingBranch(true);
    try {
      await createBranch({
        data: {
          name: newBranch.name,
          name_ar: newBranch.name_ar,
          manager_id: newBranch.manager_id ? Number(newBranch.manager_id) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListAdminBranchesQueryKey() });
      setBranchDialogOpen(false);
      setNewBranch({ name: "", name_ar: "", manager_id: "" });
      toast({ title: t("Branch created", "تم إنشاء الفرع") });
    } catch {
      toast({ title: t("Failed to create branch", "فشل إنشاء الفرع"), variant: "destructive" });
    } finally {
      setAddingBranch(false);
    }
  }

  const maxCount = sum ? Math.max(...PIPELINE_STAGES.map(s => sum[s.key] ?? 0), 1) : 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {t("Platform Administrator Portal", "بوابة مدير المنصة")}
          </div>
          <h1 className="text-2xl font-bold">{t("System Telemetry & Administration", "القياس عن بعد والإدارة")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t(
              "Full organizational view — users, branches, pipeline metrics, and audit logs.",
              "عرض تنظيمي شامل — المستخدمون والفروع ومقاييس خط الأنابيب وسجلات التدقيق."
            )}
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={exportCSV}>
          <Download className="w-4 h-4" />
          {t("Export CSV", "تصدير CSV")}
        </Button>
      </div>

      <Tabs defaultValue="telemetry">
        <TabsList className="mb-6">
          <TabsTrigger value="telemetry" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            {t("Telemetry", "القياس")}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {t("Users", "المستخدمون")}
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            {t("Branches", "الفروع")}
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5">
            <Database className="w-3.5 h-3.5" />
            {t("Raw Records", "السجلات الخام")}
          </TabsTrigger>
        </TabsList>

        {/* ── Telemetry ── */}
        <TabsContent value="telemetry">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {loadingSummary ? [1,2,3,4].map(i => <Skeleton key={i} className="h-20" />) : (
              <>
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
                  <CardContent className="p-4">
                    <div className="text-3xl font-bold">{sum?.total ?? 0}</div>
                    <div className="text-xs text-slate-300 mt-1">{t("Total Requests", "إجمالي الطلبات")}</div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="text-3xl font-bold text-yellow-800">{sum?.pending ?? 0}</div>
                    <div className="text-xs text-yellow-700 mt-1">{t("Pending Review", "قيد المراجعة")}</div>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4">
                    <div className="text-3xl font-bold text-emerald-800">{(sum?.delivered ?? 0) + (sum?.completed ?? 0)}</div>
                    <div className="text-xs text-emerald-700 mt-1">{t("Fulfilled", "تم التنفيذ")}</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="text-3xl font-bold text-red-800">{sum?.rejected ?? 0}</div>
                    <div className="text-xs text-red-700 mt-1">{t("Rejected", "مرفوض")}</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                {t("Pipeline Distribution", "توزيع خط الأنابيب")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PIPELINE_STAGES.map(stage => {
                  const count = sum?.[stage.key] ?? 0;
                  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0;
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground text-right shrink-0">
                        {language === "en" ? stage.label : stage.labelAr}
                      </div>
                      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                        <div className={`h-full ${stage.color} rounded transition-all duration-500`} style={{ width: `${width}%` }} />
                      </div>
                      <div className="w-8 text-xs font-mono text-right font-semibold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                {t("Recent Activity", "النشاط الأخير")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity?.map(a => (
                  <div key={a.id} className="flex items-start justify-between text-xs border-b border-border pb-1.5">
                    <div>
                      <span className="font-medium">#{a.request_id}</span>
                      <span className="text-muted-foreground ml-1">{a.action}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[a.status] ?? "bg-slate-100 text-slate-700"}`}>{a.status}</span>
                  </div>
                ))}
                {!activity?.length && (
                  <div className="text-center py-6 text-muted-foreground text-sm">{t("No activity yet", "لا نشاط بعد")}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Users ── */}
        <TabsContent value="users">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{t("Staff Users", "موظفو المنصة")}</h2>
            <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  {t("Add User", "إضافة مستخدم")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Create Staff User", "إنشاء مستخدم موظف")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{t("Username", "اسم المستخدم")}</label>
                      <Input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} required placeholder="e.g. reviewer2" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{t("Password", "كلمة المرور")}</label>
                      <Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required placeholder="min 4 chars" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t("Display Name", "الاسم المعروض")}</label>
                    <Input value={newUser.display_name} onChange={e => setNewUser(u => ({ ...u, display_name: e.target.value }))} required placeholder="e.g. Dr. Ahmed Al-Hassan" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{t("Role", "الدور")}</label>
                      <select
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                        value={newUser.role}
                        onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                      >
                        {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{t("Branch", "الفرع")}</label>
                      <select
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                        value={newUser.branch_id}
                        onChange={e => setNewUser(u => ({ ...u, branch_id: e.target.value }))}
                      >
                        <option value="">{t("No branch", "بلا فرع")}</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={addingUser}>
                    {addingUser ? t("Creating…", "جاري الإنشاء…") : t("Create User", "إنشاء مستخدم")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingUsers ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{t("User", "المستخدم")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{t("Role", "الدور")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("Branch", "الفرع")}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{t("Status", "الحالة")}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">{t("Actions", "الإجراءات")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr key={user.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.display_name}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-800"}`}>
                          {user.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {user.branch_id ? (branches.find(b => b.id === user.branch_id)?.name ?? `Branch #${user.branch_id}`) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${user.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {user.active ? t("Active", "نشط") : t("Inactive", "غير نشط")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => toggleUserActive(user)}>
                          <PowerOff className="w-3 h-3" />
                          {user.active ? t("Deactivate", "إلغاء التفعيل") : t("Activate", "تفعيل")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      {t("No staff users found", "لا مستخدمين")}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Branches ── */}
        <TabsContent value="branches">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{t("Branches", "الفروع")}</h2>
            <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  {t("Add Branch", "إضافة فرع")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Create Branch", "إنشاء فرع")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddBranch} className="space-y-4 mt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t("Branch Name (English)", "اسم الفرع (إنجليزي)")}</label>
                    <Input value={newBranch.name} onChange={e => setNewBranch(b => ({ ...b, name: e.target.value }))} required placeholder="e.g. North Branch" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t("Branch Name (Arabic)", "اسم الفرع (عربي)")}</label>
                    <Input value={newBranch.name_ar} onChange={e => setNewBranch(b => ({ ...b, name_ar: e.target.value }))} placeholder="مثال: الفرع الشمالي" dir="rtl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{t("Branch Manager", "مدير الفرع")}</label>
                    <select
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      value={newBranch.manager_id}
                      onChange={e => setNewBranch(b => ({ ...b, manager_id: e.target.value }))}
                    >
                      <option value="">{t("No manager assigned", "لا مدير محدد")}</option>
                      {users.filter(u => u.role === "BRANCH_MANAGER" && u.active).map(u => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={addingBranch}>
                    {addingBranch ? t("Creating…", "جاري الإنشاء…") : t("Create Branch", "إنشاء فرع")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(b => (
              <Card key={b.id} className="border hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{b.name}</div>
                      {b.name_ar && <div className="text-sm text-muted-foreground" dir="rtl">{b.name_ar}</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        {users.filter(u => u.branch_id === b.id).length} {t("staff members", "موظف")}
                      </div>
                      {b.manager_id && (
                        <div className="text-xs mt-1 text-teal-700 font-medium">
                          {t("Manager:", "المدير:")} {users.find(u => u.id === b.manager_id)?.display_name ?? `#${b.manager_id}`}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!branches.length && (
              <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                {t("No branches created yet", "لا فروع بعد")}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Raw Records ── */}
        <TabsContent value="records">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                {t("Raw Records", "السجلات الخام")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                  {allRequests?.map(req => (
                    <div key={req.id} className="flex items-center justify-between text-xs border-b border-border pb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-muted-foreground">#{req.id}</span>
                        <span className="font-medium">{req.requester_name}</span>
                        {(req as any).urgency === "critical" && <span className="text-red-600 font-bold">CRITICAL</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[req.status] ?? "bg-slate-100 text-slate-700"}`}>{req.status}</span>
                      </div>
                    </div>
                  ))}
                  {!allRequests?.length && (
                    <div className="text-center py-6 text-muted-foreground text-sm">{t("No records", "لا سجلات")}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
