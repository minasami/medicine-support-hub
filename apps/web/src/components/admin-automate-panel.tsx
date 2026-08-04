import { useState } from "react";
import { Bot, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ADMIN_ACTION_CATALOG,
  readAdminActionAudit,
  runAdminAction,
  type AdminActionId,
  type AdminActionResult,
} from "@/lib/admin-actions";
import { useLanguage } from "@/lib/i18n";

type Props = {
  actorEmail?: string;
  onCompleted?: () => void;
};

export function AdminAutomatePanel({ actorEmail, onCompleted }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<AdminActionId | null>(null);
  const [last, setLast] = useState<AdminActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const audit = readAdminActionAudit(5);

  async function run(id: AdminActionId) {
    setBusy(id);
    setError(null);
    setLast(null);
    try {
      const result = await runAdminAction(id, {
        dryRun,
        actorEmail,
        approveMinScore: 85,
        rejectMaxScore: id === "reject_low_score_claims" ? 25 : null,
      });
      const primary = Array.isArray(result) ? result[result.length - 1] : result;
      setLast(primary);
      onCompleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-violet-500/25">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-700" />
          {t("Automate admin actions", "أتمتة إجراءات المشرف")}
          <Badge variant="outline" className="ml-auto text-[10px]">
            {dryRun ? "Dry-run" : "Live"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t(
            "Safe pack auto-approves high-confidence company claims only. Medical publishing and code deploy stay manual.",
            "الحزمة الآمنة تعتمد فقط طلبات الشركات عالية الثقة. النشر الطبي ونشر الكود يبقيان يدويين.",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border"
          />
          {t("Dry-run (preview only)", "تجربة دون تنفيذ")}
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {ADMIN_ACTION_CATALOG.map((a) => (
            <Button
              key={a.id}
              variant={a.safety === "caution" ? "outline" : "default"}
              className={
                a.safety === "safe"
                  ? "justify-start h-auto py-3 bg-violet-700 hover:bg-violet-800 text-white"
                  : "justify-start h-auto py-3 border-amber-500/40 text-amber-900 dark:text-amber-100"
              }
              disabled={busy != null}
              onClick={() => void run(a.id)}
            >
              <div className="text-left space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  {busy === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : a.safety === "caution" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : null}
                  {a.label}
                </div>
                <div className="text-[11px] font-normal opacity-90 whitespace-normal">
                  {a.description}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {last && (
          <Alert
            className={
              last.ok
                ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-amber-500/40"
            }
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertDescription>
              <div className="font-medium">{last.message}</div>
              {last.details.length > 0 && (
                <ul className="mt-1 max-h-28 overflow-auto text-[11px] text-muted-foreground list-disc pl-4">
                  {last.details.slice(0, 12).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {audit.length > 0 && (
          <div className="border-t pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {t("Recent automated runs", "عمليات مؤتمتة حديثة")}
            </div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {audit.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  {new Date(a.at).toLocaleString()} · {a.action} · {a.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
