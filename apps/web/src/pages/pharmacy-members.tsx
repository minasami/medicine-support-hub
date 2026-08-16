import { useEffect, useState } from "react";
import { AlertCircle, Download, RefreshCw, UserPlus, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv } from "@/lib/csv-export";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

type Branch = { id: string; branch_name: string; city: string | null };
type Member = {
  id: string;
  user_id: string;
  member_role: "owner" | "manager" | "accountant";
  is_active: boolean;
  created_at: string;
};
type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
};

const ROLE_AR: Record<string, string> = {
  owner: "مالك",
  manager: "مدير",
  accountant: "محاسب",
  inactive: "غير نشط",
};

export default function PharmacyMembers() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const userId = session?.user?.id;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [accountantId, setAccountantId] = useState("");
  const [role, setRole] = useState<"accountant" | "manager">("accountant");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const roleLabel = (r: string) => t(r, ROLE_AR[r] || r);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !userId)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const rows = await supabaseFetch<Branch[]>(
        "/rest/v1/pharmacy_branches?select=id,branch_name,city&is_active=eq.true&order=created_at.asc",
      );
      setBranches(rows);
      const active = branchId || rows[0]?.id || "";
      setBranchId(active);
      const profileRows = await supabaseFetch<Profile[]>(
        "/rest/v1/profiles?select=id,full_name,phone,role,is_active&role=in.(pharmacy_accountant,branch_manager)&is_active=eq.true&order=full_name.asc&limit=200",
      );
      setCandidates(profileRows);
      if (!active) {
        setMembers([]);
        return;
      }
      const memberRows = await supabaseFetch<Member[]>(
        `/rest/v1/pharmacy_branch_members?select=id,user_id,member_role,is_active,created_at&branch_id=eq.${active}&order=created_at.asc`,
      );
      setMembers(memberRows);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load pharmacy members.", "تعذّر تحميل أعضاء الصيدلية."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, userId, branchId]);

  async function repairOwnerAccess() {
    if (!branchId || !userId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/pharmacy_branch_members", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          branch_id: branchId,
          user_id: userId,
          member_role: "owner",
          is_active: true,
        }),
      });
      setMessage(
        t(
          "Owner access repaired. You can link pharmacy finance users now.",
          "تم إصلاح صلاحية المالك. يمكنك الآن ربط مستخدمي مالية الصيدلية.",
        ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              "Could not repair owner access. Make sure this logged-in account created the selected branch.",
              "تعذّر إصلاح صلاحية المالك. تأكد أن الحساب المسجّل أنشأ الفرع المحدد.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function addMember() {
    if (!branchId || !accountantId.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/pharmacy_branch_members", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          branch_id: branchId,
          user_id: accountantId.trim(),
          member_role: role,
          is_active: true,
        }),
      });
      setAccountantId("");
      setMessage(
        role === "accountant"
          ? t(
              "Pharmacy accountant can now access this branch finance module.",
              "يمكن لمحاسب الصيدلية الآن الوصول لوحدة مالية هذا الفرع.",
            )
          : t("Manager linked to branch.", "تم ربط المدير بالفرع."),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              "Could not link member. If this branch was created before the owner bootstrap fix, press Repair owner access then try again.",
              "تعذّر ربط العضو. إن أُنشئ الفرع قبل إصلاح صلاحية المالك، اضغط إصلاح صلاحية المالك ثم أعد المحاولة.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateMember(member: Member) {
    if (member.member_role === "owner") return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/pharmacy_branch_members?id=eq.${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      setMessage(t("Member access removed.", "تمت إزالة صلاحية العضو."));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not remove access.", "تعذّر إزالة الصلاحية."),
      );
    } finally {
      setSaving(false);
    }
  }

  const activeBranch = branches.find((branch) => branch.id === branchId);

  function exportMembers() {
    const generatedAt = new Date().toISOString();
    downloadCsv(
      `pharmacy-members-${activeBranch?.branch_name ?? "branch"}.csv`,
      [
        { key: "branch", header: "Branch" },
        { key: "city", header: "City" },
        { key: "generated_at", header: "Generated at" },
        { key: "user_id", header: "User ID" },
        { key: "member_role", header: "Branch role" },
        { key: "is_active", header: "Active" },
        { key: "created_at", header: "Added at" },
      ],
      members.map((m) => ({
        branch: activeBranch?.branch_name ?? "",
        city: activeBranch?.city ?? "",
        generated_at: generatedAt,
        user_id: m.user_id,
        member_role: m.member_role,
        is_active: m.is_active ? "yes" : "no",
        created_at: m.created_at,
      })),
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Pharmacy access", "صلاحيات الصيدلية")}
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
            <Users className="h-7 w-7" />
            {t("Branch finance access", "صلاحية مالية الفرع")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Link pharmacy accountants and managers to a branch so they can use Pharmacy Finance.",
              "اربط محاسبي ومديري الصيدلية بفرع ليتمكنوا من استخدام مالية الصيدلية.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMembers} disabled={!members.length}>
            <Download className="mr-2 h-4 w-4" />
            {t("Export CSV", "تصدير CSV")}
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("Current branch", "الفرع الحالي")}</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
                {b.city ? ` - ${b.city}` : ""}
              </option>
            ))}
          </select>
          {!branches.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "Create a branch from Pharmacy Finance first.",
                "أنشئ فرعًا من مالية الصيدلية أولًا.",
              )}
            </p>
          )}
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void repairOwnerAccess()}
            disabled={saving || !branchId}
          >
            {t("Repair owner access", "إصلاح صلاحية المالك")}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              "Use this if a branch was created before the owner-membership fix and member linking is blocked.",
              "استخدم هذا إن أُنشئ الفرع قبل إصلاح عضوية المالك وكان ربط الأعضاء محظورًا.",
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("Add pharmacy finance user", "إضافة مستخدم مالية الصيدلية")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <Label>{t("Registered pharmacy user", "مستخدم صيدلية مسجّل")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={accountantId}
              onChange={(e) => setAccountantId(e.target.value)}
            >
              <option value="">
                {t(
                  "Select pharmacy accountant or manager",
                  "اختر محاسب أو مدير صيدلية",
                )}
              </option>
              {candidates.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || profile.phone || profile.id} — {profile.role}
                </option>
              ))}
            </select>
            <Input
              className="mt-2"
              value={accountantId}
              onChange={(e) => setAccountantId(e.target.value)}
              placeholder={t("Or paste user UUID", "أو الصق معرّف المستخدم")}
            />
          </div>
          <div>
            <Label>{t("Branch access", "صلاحية الفرع")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "accountant" | "manager")}
            >
              <option value="accountant">{roleLabel("accountant")}</option>
              <option value="manager">{roleLabel("manager")}</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => void addMember()}
              disabled={saving || !branchId || !accountantId.trim()}
            >
              {t("Link", "ربط")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Branch members", "أعضاء الفرع")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <div className="font-mono text-xs">{m.user_id}</div>
                <div className="text-xs text-muted-foreground">
                  {t("Added", "أُضيف")} {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.is_active ? "default" : "outline"}>
                  {m.is_active ? roleLabel(m.member_role) : roleLabel("inactive")}
                </Badge>
                {m.member_role !== "owner" && m.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void deactivateMember(m)}
                    disabled={saving}
                  >
                    {t("Remove", "إزالة")}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!members.length && (
            <p className="text-sm text-muted-foreground">
              {t("No members yet.", "لا يوجد أعضاء بعد.")}
            </p>
          )}
          <p className="pt-3 text-xs text-muted-foreground">
            {t(
              "Set the user profile role to pharmacy_accountant first, then link them here as branch accountant to grant Pharmacy Finance access for this branch.",
              "اضبط دور الملف الشخصي إلى pharmacy_accountant أولًا، ثم اربطه هنا كمحاسب فرع لمنح صلاحية مالية الصيدلية لهذا الفرع.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
