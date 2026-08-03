import { FormEvent, useCallback, useEffect, useState } from "react";
import { Users, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import {
  COMPANY_ORG_ROLE_LABELS,
  type CompanyOrgRole,
  type CompanyTeamMember,
  canInviteRole,
  memberCanManageTeam,
} from "@/lib/company-role-hierarchy";
import {
  inviteCompanyTeamMember,
  listCompanyTeamMembers,
  updateTeamMemberStatus,
} from "@/lib/company-team-data";

type Props = {
  companySlug: string;
  companyName: string;
  actorEmail: string;
  /** Role of the signed-in user within this company */
  actorRole: CompanyOrgRole;
  claimApproved?: boolean;
};

const INVITABLE: CompanyOrgRole[] = [
  "product_manager",
  "line_manager",
  "company_rep",
  "viewer",
];

export function CompanyTeamInvite({
  companySlug,
  companyName,
  actorEmail,
  actorRole,
}: Props) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<CompanyTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyOrgRole>("line_manager");
  const [lines, setLines] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = memberCanManageTeam({
    company_slug: companySlug,
    user_email: actorEmail,
    role: actorRole,
    status: "active",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { members: list } = await listCompanyTeamMembers({
        companySlug,
        limit: 100,
      });
      setMembers(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [companySlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!canManage) return null;

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!canInviteRole(actorRole, role)) {
        throw new Error("You cannot invite this role.");
      }
      const productLines = lines
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { member, storage } = await inviteCompanyTeamMember({
        companySlug,
        companyName,
        userEmail: email,
        role,
        productLines,
        invitedBy: actorEmail,
        actorRole,
        activateImmediately: true,
      });
      setMessage(
        t(
          `Invited ${member.user_email} as ${COMPANY_ORG_ROLE_LABELS[member.role]} (${storage}).`,
          `تمت دعوة ${member.user_email} كـ ${COMPANY_ORG_ROLE_LABELS[member.role]} (${storage}).`,
        ),
      );
      setEmail("");
      setLines("");
      await reload();
    } catch (err: any) {
      setError(err?.message || "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8 border-violet-500/25 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-violet-700" />
          {t("Team & line managers", "الفريق ومديرو الخطوط")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t(
            "Invite product managers and line managers for specific product lines. They can update encyclopedia data within their scope.",
            "ادعُ مديري المنتجات ومديري الخطوط لخطوط محددة. يمكنهم تحديث بيانات الموسوعة ضمن نطاقهم.",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onInvite} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold">{t("Work email", "البريد المهني")}</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pm@company.com"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">{t("Role", "الدور")}</Label>
            <select
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyOrgRole)}
            >
              {INVITABLE.filter((r) => canInviteRole(actorRole, r) || actorRole === "company_ceo").map(
                (r) => (
                  <option key={r} value={r}>
                    {COMPANY_ORG_ROLE_LABELS[r]}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <Label className="text-xs font-semibold">
              {t("Product lines (comma-separated)", "خطوط المنتجات (مفصولة بفاصلة)")}
            </Label>
            <Input
              value={lines}
              onChange={(e) => setLines(e.target.value)}
              placeholder="Anti-infectives, OTC"
              className="mt-1 rounded-xl"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={busy}
              className="bg-violet-700 hover:bg-violet-800 text-white font-semibold rounded-xl gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {busy
                ? t("Inviting…", "جاري الدعوة…")
                : t("Send invite", "إرسال الدعوة")}
            </Button>
          </div>
        </form>

        <div className="border-t pt-3">
          <h4 className="text-sm font-bold mb-2">
            {t("Team members", "أعضاء الفريق")} ({members.length})
            {loading ? " …" : ""}
          </h4>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("No team members yet.", "لا يوجد أعضاء بعد.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id || m.user_email}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{m.user_email}</div>
                    <div className="text-xs text-muted-foreground">
                      {COMPANY_ORG_ROLE_LABELS[m.role]}
                      {m.product_lines?.length
                        ? ` · ${m.product_lines.join(", ")}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "active" ? "default" : "outline"}>
                      {m.status}
                    </Badge>
                    {m.id && m.status === "active" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() =>
                          void updateTeamMemberStatus(m.id!, "revoked").then(reload)
                        }
                      >
                        {t("Revoke", "إلغاء")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
