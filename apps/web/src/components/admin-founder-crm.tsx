import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, CalendarClock, Mail, MessageCircle, RefreshCw, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Session = { access_token: string };
type Lead = {
  id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  organization_name: string | null;
  organization_type: string | null;
  country: string | null;
  message: string | null;
  source_path: string | null;
  lead_type: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  created_at: string;
};
type Draft = { status: string; priority: string; next_action: string; follow_up_at: string; admin_notes: string };

const STATUSES = ["new", "contacted", "qualified", "pilot_discussion", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const KEY = "medicine_support_staff_session";

function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}
async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  try {
    const { url, key } = config();
    const token = session?.access_token && session.access_token.includes(".") ? session.access_token : key;
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) return [] as unknown as T;
    return (data ?? []) as T;
  } catch {
    return [] as unknown as T;
  }
}

export function AdminFounderCrm() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => ({
    total: leads.length,
    fresh: leads.filter(lead => lead.status === "new").length,
    urgent: leads.filter(lead => lead.priority === "urgent").length,
    due: leads.filter(lead => lead.follow_up_at && new Date(lead.follow_up_at) <= new Date() && lead.status !== "closed").length,
  }), [leads]);

  async function load() {
    const session = getSession();
    setLoading(true); setError(null);
    try {
      if (!session?.access_token) throw new Error("Sign in as platform admin to open the founder CRM.");
      const select = "id,contact_name,email,phone,organization_name,organization_type,country,message,source_path,lead_type,priority,status,admin_notes,next_action,follow_up_at,created_at";
      const rows = await api<Lead[]>(`/rest/v1/partnership_leads?select=${select}&order=priority.desc,created_at.desc&limit=20`, session);
      setLeads(rows);
      setDrafts(Object.fromEntries(rows.map(lead => [lead.id, {
        status: lead.status,
        priority: lead.priority || "normal",
        next_action: lead.next_action || "",
        follow_up_at: lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : "",
        admin_notes: lead.admin_notes || "",
      }])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load founder requests.");
    } finally { setLoading(false); }
  }

  async function save(lead: Lead) {
    const session = getSession();
    const draft = drafts[lead.id];
    if (!session || !draft) return;
    setSavingId(lead.id); setError(null); setMessage(null);
    try {
      await api(`/rest/v1/partnership_leads?id=eq.${encodeURIComponent(lead.id)}`, session, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: draft.status,
          priority: draft.priority,
          next_action: draft.next_action.trim() || null,
          follow_up_at: draft.follow_up_at ? new Date(draft.follow_up_at).toISOString() : null,
          admin_notes: draft.admin_notes.trim() || null,
          last_contacted_at: draft.status === "contacted" && lead.status !== "contacted" ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        }),
      });
      setMessage(`${lead.contact_name} updated.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save founder request.");
    } finally { setSavingId(null); }
  }

  useEffect(() => { void load(); }, []);

  return (
    <Card className="mb-6 border-sky-200/80 shadow-sm">
      <CardHeader className="gap-3 bg-gradient-to-r from-sky-50 to-background md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-2 bg-sky-100 text-sky-800 hover:bg-sky-100"><MessageCircle className="mr-1 h-3 w-3" />Founder CRM</Badge>
          <CardTitle>Talk to the Founder requests</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Qualify demo, pilot, marketplace, institutional, and partnership conversations without leaving platform administration.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button asChild size="sm"><Link href="/admin/leads">Open full CRM<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert className="mb-4"><AlertDescription>{message}</AlertDescription></Alert>}
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Visible leads" value={stats.total} />
          <Metric label="New" value={stats.fresh} />
          <Metric label="Urgent" value={stats.urgent} />
          <Metric label="Follow-up due" value={stats.due} />
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading founder requests…</p> : leads.length === 0 ? <p className="text-sm text-muted-foreground">No Talk to the Founder requests yet.</p> : (
          <div className="space-y-4">
            {leads.slice(0, 6).map(lead => {
              const draft = drafts[lead.id];
              if (!draft) return null;
              return (
                <div key={lead.id} className="rounded-xl border p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_430px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{lead.contact_name}{lead.organization_name ? ` — ${lead.organization_name}` : ""}</h3>
                        <Badge variant="outline">{lead.lead_type?.replaceAll("_", " ") || "partnership"}</Badge>
                        <Badge variant={lead.priority === "urgent" ? "destructive" : "secondary"}>{lead.priority}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{[lead.organization_type, lead.country, lead.source_path, new Date(lead.created_at).toLocaleString()].filter(Boolean).join(" • ")}</div>
                      {lead.message && <p className="mt-3 text-sm leading-6 text-muted-foreground">{lead.message}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline"><a href={`mailto:${lead.email}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
                        {lead.follow_up_at && <Badge variant="outline"><CalendarClock className="mr-1 h-3 w-3" />{new Date(lead.follow_up_at).toLocaleString()}</Badge>}
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Status" value={draft.status} options={STATUSES} onChange={value => setDrafts(current => ({ ...current, [lead.id]: { ...draft, status: value } }))} />
                        <Select label="Priority" value={draft.priority} options={PRIORITIES} onChange={value => setDrafts(current => ({ ...current, [lead.id]: { ...draft, priority: value } }))} />
                      </div>
                      <div><Label>Follow-up</Label><Input className="mt-1" type="datetime-local" value={draft.follow_up_at} onChange={event => setDrafts(current => ({ ...current, [lead.id]: { ...draft, follow_up_at: event.target.value } }))} /></div>
                      <div><Label>Next action</Label><Input className="mt-1" value={draft.next_action} onChange={event => setDrafts(current => ({ ...current, [lead.id]: { ...draft, next_action: event.target.value } }))} placeholder="Call, demo, proposal, data review…" /></div>
                      <div><Label>Admin notes</Label><Textarea className="mt-1" value={draft.admin_notes} onChange={event => setDrafts(current => ({ ...current, [lead.id]: { ...draft, admin_notes: event.target.value } }))} /></div>
                      <Button size="sm" onClick={() => void save(lead)} disabled={savingId === lead.id}><Save className="mr-2 h-4 w-4" />{savingId === lead.id ? "Saving…" : "Save"}</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-2xl font-bold">{value.toLocaleString()}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></div>;
}
