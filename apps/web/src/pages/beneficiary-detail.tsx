import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Activity, AlertCircle, ArrowLeft, CalendarDays, ClipboardCheck, HeartPulse, MapPin, Phone, Plus, RefreshCw, Save, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Session = { access_token: string; user?: { id: string } };
type Beneficiary = { id: string; organization_id: string; program_id: string | null; full_name: string; phone: string | null; email: string | null; birthdate: string | null; city: string | null; primary_condition: string | null; risk_level: string; consent_status: string; status: string; programs?: { id: string; name: string } | null };
type Program = { id: string; name: string };
type Event = { id: string; event_type: string; title: string; description: string | null; event_date: string };

const EVENT_TYPES = ["enrollment", "eligibility_review", "medical_review", "approval", "dispensing", "delivery", "follow_up", "outcome", "note"];
const RISK_LEVELS = ["standard", "elevated", "high", "critical"];
const CONSENT_STATUSES = ["pending", "granted", "withdrawn", "not_required"];
const BENEFICIARY_STATUSES = ["active", "inactive", "graduated", "archived"];

function loadPlatformSession(): Session | null { try { return JSON.parse(localStorage.getItem("medicine_support_staff_session") || localStorage.getItem("medicine_support_patient_session") || "null"); } catch { return null; } }
function config() { const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, ""); const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error("Supabase environment variables are missing."); return { url, key }; }
async function api<T>(path: string, session: Session, init: RequestInit = {}) { const { url, key } = config(); const response = await fetch(`${url}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } }); const text = await response.text(); const data = text ? JSON.parse(text) : null; if (!response.ok) throw new Error(data?.message || data?.error || "Request failed"); return data as T; }

export default function BeneficiaryDetailPage() {
  const [, params] = useRoute("/workspace/beneficiaries/:id");
  const beneficiaryId = params?.id;
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [draft, setDraft] = useState({ event_type: "note", title: "", description: "" });
  const [editDraft, setEditDraft] = useState({ full_name: "", phone: "", email: "", birthdate: "", city: "", primary_condition: "", risk_level: "standard", consent_status: "pending", status: "active", program_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function syncEditDraft(current: Beneficiary) { setEditDraft({ full_name: current.full_name || "", phone: current.phone || "", email: current.email || "", birthdate: current.birthdate || "", city: current.city || "", primary_condition: current.primary_condition || "", risk_level: current.risk_level || "standard", consent_status: current.consent_status || "pending", status: current.status || "active", program_id: current.program_id || "" }); }

  async function load() {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!beneficiaryId) throw new Error("Beneficiary ID is missing.");
      const session = loadPlatformSession();
      if (!session?.access_token) throw new Error("Sign in from the platform portal first.");
      const beneficiaryRows = await api<Beneficiary[]>(`/rest/v1/beneficiaries?select=id,organization_id,program_id,full_name,phone,email,birthdate,city,primary_condition,risk_level,consent_status,status,programs(id,name)&id=eq.${beneficiaryId}&limit=1`, session);
      const current = beneficiaryRows[0] ?? null;
      if (!current) throw new Error("Beneficiary not found or access denied.");
      setBeneficiary(current); syncEditDraft(current);
      const [programRows, eventRows] = await Promise.all([
        api<Program[]>(`/rest/v1/programs?select=id,name&organization_id=eq.${current.organization_id}&order=name.asc`, session),
        api<Event[]>(`/rest/v1/beneficiary_events?select=id,event_type,title,description,event_date&beneficiary_id=eq.${beneficiaryId}&order=event_date.desc`, session),
      ]);
      setPrograms(programRows); setEvents(eventRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load beneficiary."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [beneficiaryId]);

  async function saveBeneficiary() {
    if (!beneficiary || !editDraft.full_name.trim()) return;
    const session = loadPlatformSession();
    if (!session?.access_token) { setError("Sign in from the platform portal first."); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await api(`/rest/v1/beneficiaries?id=eq.${beneficiary.id}`, session, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ full_name: editDraft.full_name.trim(), phone: editDraft.phone.trim() || null, email: editDraft.email.trim() || null, birthdate: editDraft.birthdate || null, city: editDraft.city.trim() || null, primary_condition: editDraft.primary_condition.trim() || null, risk_level: editDraft.risk_level, consent_status: editDraft.consent_status, status: editDraft.status, program_id: editDraft.program_id || null, updated_at: new Date().toISOString() }) });
      await api(`/rest/v1/beneficiary_events`, session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: beneficiary.organization_id, beneficiary_id: beneficiary.id, program_id: editDraft.program_id || null, event_type: "note", title: "Beneficiary data updated", description: "Profile data was edited from Beneficiary 360°." }) });
      setMessage("Beneficiary data updated."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update beneficiary."); }
    finally { setSaving(false); }
  }

  async function addEvent() {
    if (!beneficiary || !draft.title.trim()) return;
    const session = loadPlatformSession();
    if (!session?.access_token) { setError("Sign in from the platform portal first."); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await api(`/rest/v1/beneficiary_events`, session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: beneficiary.organization_id, beneficiary_id: beneficiary.id, program_id: beneficiary.program_id, event_type: draft.event_type, title: draft.title.trim(), description: draft.description.trim() || null }) });
      setDraft({ event_type: "note", title: "", description: "" }); setMessage("Timeline event added."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add timeline event."); }
    finally { setSaving(false); }
  }

  return <div className="container mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><Button asChild variant="ghost" className="mb-3 -ml-3"><Link href="/workspace"><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</Link></Button><Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Beneficiary 360°</Badge><h1 className="flex items-center gap-3 text-3xl font-bold"><UserRound className="h-8 w-8 text-emerald-700" />{beneficiary?.full_name ?? "Beneficiary profile"}</h1><p className="mt-2 text-muted-foreground">Longitudinal profile, editable beneficiary data, and support timeline.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-6"><AlertDescription>{message}</AlertDescription></Alert>}
    {beneficiary && <>
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><HeartPulse className="h-4 w-4" />Primary condition</div><div className="mt-2 font-semibold">{beneficiary.primary_condition || "Not recorded"}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardCheck className="h-4 w-4" />Program</div><div className="mt-2 font-semibold">{beneficiary.programs?.name || "Unassigned"}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4" />Risk level</div><div className="mt-2"><Badge variant="secondary">{beneficiary.risk_level}</Badge></div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />Status</div><div className="mt-2 font-semibold capitalize">{beneficiary.status}</div></CardContent></Card></div>
      <div className="mb-6 grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />Phone</div><div className="mt-2 font-medium">{beneficiary.phone || "Not recorded"}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />City</div><div className="mt-2 font-medium">{beneficiary.city || "Not recorded"}</div></CardContent></Card><Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Consent</div><div className="mt-2 font-medium capitalize">{beneficiary.consent_status.replaceAll("_", " ")}</div></CardContent></Card></div>
      <Card className="mb-6"><CardHeader><CardTitle>Edit beneficiary data</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><Label>Full name</Label><Input value={editDraft.full_name} onChange={e => setEditDraft({ ...editDraft, full_name: e.target.value })} /></div><div><Label>Phone</Label><Input value={editDraft.phone} onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })} /></div><div><Label>Email</Label><Input type="email" value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} /></div><div><Label>Birthdate</Label><Input type="date" value={editDraft.birthdate} onChange={e => setEditDraft({ ...editDraft, birthdate: e.target.value })} /></div><div><Label>City</Label><Input value={editDraft.city} onChange={e => setEditDraft({ ...editDraft, city: e.target.value })} /></div><div><Label>Primary condition</Label><Input value={editDraft.primary_condition} onChange={e => setEditDraft({ ...editDraft, primary_condition: e.target.value })} /></div><div><Label>Program</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.program_id} onChange={e => setEditDraft({ ...editDraft, program_id: e.target.value })}><option value="">Unassigned</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><Label>Risk level</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.risk_level} onChange={e => setEditDraft({ ...editDraft, risk_level: e.target.value })}>{RISK_LEVELS.map(x => <option key={x} value={x}>{x}</option>)}</select></div><div><Label>Consent</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.consent_status} onChange={e => setEditDraft({ ...editDraft, consent_status: e.target.value })}>{CONSENT_STATUSES.map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></div><div><Label>Status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.status} onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}>{BENEFICIARY_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}</select></div></div><Button onClick={saveBeneficiary} disabled={saving || !editDraft.full_name.trim()}><Save className="mr-2 h-4 w-4" />Save beneficiary</Button></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><Card><CardHeader><CardTitle>Add timeline event</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Event type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.event_type} onChange={e => setDraft({ ...draft, event_type: e.target.value })}>{EVENT_TYPES.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></div><div><Label>Title</Label><Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Eligibility approved" /></div><div><Label>Description</Label><Textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Add the relevant operational or clinical context." /></div><Button onClick={addEvent} disabled={saving || !draft.title.trim()}><Plus className="mr-2 h-4 w-4" />Add event</Button></CardContent></Card><Card><CardHeader><CardTitle>Support timeline</CardTitle></CardHeader><CardContent>{events.length === 0 ? <p className="text-sm text-muted-foreground">No timeline events yet.</p> : <div className="space-y-5">{events.map((event, index) => <div key={event.id} className="relative pl-8"><div className="absolute left-1 top-1.5 h-3 w-3 rounded-full bg-emerald-600" />{index < events.length - 1 && <div className="absolute left-[9px] top-5 h-[calc(100%+0.75rem)] w-px bg-border" />}<div className="flex flex-col gap-1 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{event.title}</div><Badge variant="outline">{event.event_type.replaceAll("_", " ")}</Badge></div>{event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}<time className="text-xs text-muted-foreground">{new Date(event.event_date).toLocaleString()}</time></div></div>)}</div>}</CardContent></Card></div>
    </>}
  </div>;
}
