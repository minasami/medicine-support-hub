import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, CheckCircle, HelpCircle, XCircle, Pause } from "lucide-react";

type Ticket = {
  id: string;
  opened_at: string;
  requester_label: string;
  medicine_name: string;
  evidence_ok: boolean;
  status: "open" | "waiting" | "done";
  decision: "approve" | "query" | "decline" | "wait" | null;
  reason: string | null;
  owner_label: string | null;
  is_repeat_14d: boolean;
  closed_at: string | null;
};

type EventRow = {
  id: string;
  ticket_id: string;
  at: string;
  actor_label: string;
  from_status: string | null;
  to_status: string;
  decision: string | null;
  reason: string | null;
};

function ageHours(openedAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 36e5));
}

export default function SupportReviewQueuePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tab, setTab] = useState("open");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reason, setReason] = useState("");
  const [evidenceOk, setEvidenceOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      open: tickets.filter((row) => row.status === "open").length,
      waiting: tickets.filter((row) => row.status === "waiting").length,
      done: tickets.filter((row) => row.status === "done").length,
    }),
    [tickets],
  );

  const visible = useMemo(
    () => tickets.filter((row) => row.status === tab),
    [tickets, tab],
  );

  const medianOpenAge = useMemo(() => {
    const ages = tickets
      .filter((row) => row.status !== "done")
      .map((row) => ageHours(row.opened_at))
      .sort((a, b) => a - b);
    if (!ages.length) return 0;
    const mid = Math.floor(ages.length / 2);
    return ages.length % 2 ? ages[mid] : Math.round((ages[mid - 1] + ages[mid]) / 2);
  }, [tickets]);

  async function load() {
    setError(null);
    try {
      const rows = await supabaseFetch<Ticket[]>(
        "/rest/v1/support_review_queue?select=id,opened_at,requester_label,medicine_name,evidence_ok,status,decision,reason,owner_label,is_repeat_14d,closed_at&order=opened_at.asc",
      );
      setTickets(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Could not load the pilot queue.", "تعذّر تحميل قائمة المراجعة التجريبية."),
      );
    }
  }

  async function loadEvents(ticketId: string) {
    try {
      const rows = await supabaseFetch<EventRow[]>(
        `/rest/v1/support_review_events?ticket_id=eq.${ticketId}&select=id,ticket_id,at,actor_label,from_status,to_status,decision,reason&order=at.desc`,
      );
      setEvents(Array.isArray(rows) ? rows : []);
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, session?.access_token]);

  useEffect(() => {
    if (selected) {
      setReason(selected.reason ?? "");
      setEvidenceOk(selected.evidence_ok);
      loadEvents(selected.id);
    } else {
      setEvents([]);
    }
  }, [selected?.id]);

  async function decide(decision: "approve" | "query" | "decline" | "wait") {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await supabaseFetch<Ticket | Ticket[]>(
        "/rest/v1/rpc/decide_support_review_ticket",
        {
          method: "POST",
          body: JSON.stringify({
            p_ticket_id: selected.id,
            p_decision: decision,
            p_reason: reason.trim(),
            p_evidence_ok: evidenceOk,
            p_actor_label: "reviewer-pilot",
          }),
        },
      );
      const next = (Array.isArray(updated) ? updated[0] : updated) ?? selected;
      setTickets((current) => current.map((row) => (row.id === selected.id ? { ...row, ...next } : row)));
      setSelected((current) => (current ? { ...current, ...next } : current));
      await Promise.all([load(), loadEvents(selected.id)]);
      toast({
        title: t("Decision saved", "تم حفظ القرار"),
        description: `${decision} → ${next.status ?? ""}`,
      });
    } catch (err) {
      toast({
        title: t("Decision blocked", "لم يُقبل القرار"),
        description: err instanceof Error ? err.message : t("Update failed.", "فشل التحديث."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Alert className="mb-4">
          <LogIn className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Sign in before opening the 90-day reviewer-queue pilot.",
              "سجّل الدخول قبل فتح قائمة المراجعة التجريبية.",
            )}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/portal">{t("Go to sign in", "الذهاب لتسجيل الدخول")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("90-day pilot · not a TPA desk", "تجربة ٩٠ يوماً · ليست مكتب تأمين")}
        </div>
        <h1 className="text-2xl font-bold">
          {t("Reviewer queue", "قائمة المراجع")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Open / waiting / done. Age, 14-day repeat flag, decision codes, reason sentence, event log. Synthetic labels only.",
            "مفتوح / انتظار / منتهٍ. العمر، تكرار ١٤ يوماً، قرار، سبب، سجل أحداث. بيانات تجريبية فقط.",
          )}
        </p>
        <p className="mt-2 text-sm">
          {t("Median age of open+waiting tickets", "وسيط عمر التذاكر المفتوحة والمنتظرة")}:{" "}
          <strong>{medianOpenAge}h</strong>
        </p>
        <p className="mt-2 text-sm">
          <Link href="/reviewer" className="text-primary underline">
            {t("Back to medical triage queue", "العودة لقائمة الفرز الطبي")}
          </Link>
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="open">
                {t("Open", "مفتوح")} {counts.open ? `(${counts.open})` : ""}
              </TabsTrigger>
              <TabsTrigger value="waiting">
                {t("Waiting", "انتظار")} {counts.waiting ? `(${counts.waiting})` : ""}
              </TabsTrigger>
              <TabsTrigger value="done">
                {t("Done", "منتهٍ")} {counts.done ? `(${counts.done})` : ""}
              </TabsTrigger>
            </TabsList>
            {(["open", "waiting", "done"] as const).map((status) => (
              <TabsContent key={status} value={status} className="space-y-2">
                {visible.length === 0 && tab === status ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {t("No tickets in this tab.", "لا توجد تذاكر في هذا التبويب.")}
                  </div>
                ) : null}
                {tab === status &&
                  visible.map((row) => (
                    <Card
                      key={row.id}
                      className={`cursor-pointer border-l-4 ${
                        row.is_repeat_14d ? "border-l-amber-500" : "border-l-slate-300"
                      } ${selected?.id === row.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelected(row)}
                    >
                      <CardContent className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <div className="font-medium">{row.medicine_name}</div>
                          <div className="text-xs text-muted-foreground">{row.requester_label}</div>
                          {row.is_repeat_14d && (
                            <div className="mt-1 text-xs font-semibold text-amber-700">
                              {t("Repeat within 14 days", "تكرار خلال ١٤ يوماً")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {ageHours(row.opened_at)}h
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                {t("Select a ticket.", "اختر تذكرة.")}
              </p>
            ) : (
              <>
                <div>
                  <div className="text-lg font-semibold">{selected.medicine_name}</div>
                  <div className="text-sm text-muted-foreground">{selected.requester_label}</div>
                  <div className="mt-1 text-xs">
                    {t("Age", "العمر")} {ageHours(selected.opened_at)}h · {selected.status}
                    {selected.decision ? ` · ${selected.decision}` : ""}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={evidenceOk}
                    onChange={(event) => setEvidenceOk(event.target.checked)}
                  />
                  {t("Evidence complete", "المستندات مكتملة")}
                </label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t(
                    "What was in the file, what was missing, rule used.",
                    "ماذا في الملف، ماذا ينقص، القاعدة المستخدمة.",
                  )}
                  className="min-h-[120px] text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" disabled={saving} onClick={() => decide("approve")}>
                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                    {t("Approve", "موافقة")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => decide("query")}>
                    <HelpCircle className="mr-1 h-3.5 w-3.5" />
                    {t("Query", "استعلام")}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={saving} onClick={() => decide("decline")}>
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    {t("Decline", "رفض")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => decide("wait")}>
                    <Pause className="mr-1 h-3.5 w-3.5" />
                    {t("Wait", "انتظار")}
                  </Button>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {t("Event log", "سجل الأحداث")}
                  </div>
                  <div className="max-h-48 space-y-2 overflow-auto text-xs">
                    {events.map((event) => (
                      <div key={event.id} className="rounded border bg-muted/30 p-2">
                        <div>
                          {event.actor_label}: {event.from_status ?? "—"} → {event.to_status}
                          {event.decision ? ` (${event.decision})` : ""}
                        </div>
                        <div className="text-muted-foreground">{event.reason}</div>
                      </div>
                    ))}
                    {!events.length && (
                      <div className="text-muted-foreground">{t("No events yet.", "لا أحداث بعد.")}</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
