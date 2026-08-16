import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Settings, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

type Branch = {
  id: string;
  branch_name: string;
  city: string | null;
  currency: string;
  owner_user_id: string;
  created_at: string;
};

function branchKey(branch: Branch) {
  return `${branch.branch_name.trim().toLowerCase()}|${(branch.city ?? "").trim().toLowerCase()}`;
}

export default function PharmacySettings() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const userId = session?.user?.id;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [confirmBranchId, setConfirmBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !userId)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const rows = await supabaseFetch<Branch[]>(
        "/rest/v1/pharmacy_branches?select=id,branch_name,city,currency,owner_user_id,created_at&is_active=eq.true&order=created_at.desc",
      );
      setBranches(rows);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load branch settings.", "تعذّر تحميل إعدادات الفروع."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, userId]);

  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const branch of branches)
      counts.set(branchKey(branch), (counts.get(branchKey(branch)) ?? 0) + 1);
    return new Set(
      branches
        .filter((branch) => (counts.get(branchKey(branch)) ?? 0) > 1)
        .map((branch) => branch.id),
    );
  }, [branches]);

  async function deactivateBranch(branch: Branch) {
    if (confirmBranchId !== branch.id) {
      setConfirmBranchId(branch.id);
      setMessage(
        t(
          `Press deactivate again to confirm: ${branch.branch_name}${branch.city ? ` - ${branch.city}` : ""}.`,
          `اضغط تعطيل مرة أخرى للتأكيد: ${branch.branch_name}${branch.city ? ` - ${branch.city}` : ""}.`,
        ),
      );
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/pharmacy_branches?id=eq.${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      setConfirmBranchId("");
      setMessage(
        t(
          "Branch deactivated. Historical data remains in the database, but the branch is hidden from active workflows.",
          "تم تعطيل الفرع. تبقى البيانات التاريخية في قاعدة البيانات، لكن الفرع مخفي عن سير العمل النشط.",
        ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not deactivate branch.", "تعذّر تعطيل الفرع."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Pharmacy settings", "إعدادات الصيدلية")}
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
            <Settings className="h-7 w-7" />
            {t("Branch settings", "إعدادات الفروع")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Review active branches and safely deactivate duplicate or test branches without deleting historical records.",
              "راجع الفروع النشطة وعطّل الفروع المكررة أو التجريبية بأمان دون حذف السجلات التاريخية.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh", "تحديث")}
        </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>{t("Active branches", "الفروع النشطة")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {branches.map((branch) => {
            const isOwner = branch.owner_user_id === userId;
            const isDuplicate = duplicateIds.has(branch.id);
            return (
              <div
                key={branch.id}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{branch.branch_name}</strong>
                    {branch.city && (
                      <span className="text-sm text-muted-foreground">
                        {branch.city}
                      </span>
                    )}
                    {isDuplicate && (
                      <Badge variant="destructive">
                        {t("Duplicate name/city", "اسم/مدينة مكررة")}
                      </Badge>
                    )}
                    {!isOwner && (
                      <Badge variant="outline">
                        {t("Member access", "صلاحية عضو")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("Created", "أُنشئ")}{" "}
                    {new Date(branch.created_at).toLocaleString()} ·{" "}
                    {branch.currency}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmBranchId === branch.id && (
                    <Label className="text-xs text-muted-foreground">
                      {t("Confirm?", "تأكيد؟")}
                    </Label>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void deactivateBranch(branch)}
                    disabled={saving || !isOwner}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("Deactivate", "تعطيل")}
                  </Button>
                </div>
              </div>
            );
          })}
          {!branches.length && (
            <p className="text-sm text-muted-foreground">
              {t("No active branches yet.", "لا توجد فروع نشطة بعد.")}
            </p>
          )}
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {t(
              "Deactivation sets is_active=false. It does not delete finance, inventory, purchase, or member history.",
              "التعطيل يضبط is_active=false. ولا يحذف تاريخ المالية أو المخزون أو المشتريات أو الأعضاء.",
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
