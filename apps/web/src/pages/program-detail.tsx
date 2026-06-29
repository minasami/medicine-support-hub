import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CalendarDays, Plus, RefreshCw, Target, Users, Wallet } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Program = { id:string; organization_id:string; name:string; description:string|null; status:string; start_date:string|null; end_date:string|null; budget_amount:number|string; spent_amount:number|string; currency:string; eligibility_summary:string|null; objectives:string|null; kpi_summary:string|null; target_beneficiaries:number; owner_name:string|null };
type Beneficiary = { id:string; full_name:string; risk_level:string; status:string };
type Event = { id:string; event_type:string; title:string; description:string|null; event_date:string };

const EVENT_TYPES = ["milestone","budget_update","partner_update","risk","review","note"];

export default function ProgramDetailPage() {
  const [, params] = useRoute("/workspace/programs/:id");
  const id = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [program, setProgram] = useState<Program|null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [draft, setDraft] = useState({ event_type:"note", title:"", description:"" });
  const [error, setError] = useState<string|null>(null);
  const [message, setMessage] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const budget = Number(program?.budget_amount || 0);
  const spent = Number(program?.spent_amount || 0);
  const utilization = useMemo(() => budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0, [budget, spent]);

  async function load() {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!id) throw new Error("Program ID is missing.");
      if (!isAuthenticated || !session?.user?.id) throw new Error("Sign in first.");
      const rows = await supabaseFetch<Program[]>(`/rest/v1/programs?select=*&id=eq.${id}&limit=1`);
      const current = rows[0] ?? null;
      if (!current) throw new Error("Program not found or access denied.");
      setProgram(current);
      const [beneficiaryRows, eventRows] = await Promise.all([
        supabaseFetch<Beneficiary[]>(`/rest/v1/beneficiaries?select=id,full_name,risk_level,status&program_id=eq.${id}&order=created_at.desc`),
        supabaseFetch<Event[]>(`/rest/v1/program_events?select=id,event_type,title,description,event_date&program_id=eq.${id}&order=event_date.desc`),
      ]);
      setBeneficiaries(beneficiaryRows); setEvents(eventRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load program."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id, isAuthenticated, session?.access_token]);

  async function addEvent() {
    if (!program || !draft.title.trim()) return;
    setSaving(true); setError(null);
    try {
      await supabaseFetch(`/rest/v1/program_events`, { method:"POST", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ organization_id:program.organization_id, program_id:program.id, event_type:draft.event_type, title:draft.title.trim(), description:draft.description.trim() || null }) });
      setDraft({ event_type:"note", title:"", description:"" });
      setMessage("Program activity added."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add activity."); }
    finally { setSaving(false); }
  }

  return <div className="container mx-auto max-w-7xl px-4 py-8">
    <Button asChild variant="ghost" className="mb-3 -ml-3"><Link href="/workspace"><ArrowLeft className="mr-2 h-4 w-4"/>Back to workspace</Link></Button>
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100">Program Management v2</Badge><h1 className="text-3xl font-bold">{program?.name ?? "Program"}</h1><p className="mt-2 max-w-3xl text-muted-foreground">{program?.description || "Program strategy, budget, beneficiaries, eligibility, KPIs, and activity."}</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-6"><AlertDescription>{message}</AlertDescription></Alert>}
    {program && <>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4"/>Beneficiaries</div><div className="mt-2 text-2xl font-bold">{beneficiaries.length}</div><div className="text-xs text-muted-foreground">Target {program.target_beneficiaries || 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4"/>Budget</div><div className="mt-2 text-2xl font-bold">{budget.toLocaleString()} {program.currency}</div><div className="text-xs text-muted-foreground">{utilization}% utilized</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4"/>Status</div><div className="mt-2"><Badge variant="secondary">{program.status}</Badge></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4"/>Schedule</div><div className="mt-2 text-sm font-semibold">{program.start_date || "Not set"} → {program.end_date || "Open"}</div></CardContent></Card>
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Objectives</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{program.objectives || "No objectives recorded yet."}</CardContent></Card>
        <Card><CardHeader><CardTitle>Eligibility</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{program.eligibility_summary || "No eligibility summary recorded yet."}</CardContent></Card>
        <Card><CardHeader><CardTitle>KPIs</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{program.kpi_summary || "No KPI summary recorded yet."}</CardContent></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card><CardHeader><CardTitle>Add program activity</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.event_type} onChange={e=>setDraft({...draft,event_type:e.target.value})}>{EVENT_TYPES.map(x=><option key={x}>{x}</option>)}</select></div><div><Label>Title</Label><Input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></div><div><Label>Description</Label><Textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></div><Button onClick={addEvent} disabled={saving || !draft.title.trim()}><Plus className="mr-2 h-4 w-4"/>Add activity</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Program activity</CardTitle></CardHeader><CardContent className="space-y-4">{events.length===0?<p className="text-sm text-muted-foreground">No activity yet.</p>:events.map(event=><div key={event.id} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{event.title}</div><Badge variant="outline">{event.event_type.replaceAll("_"," ")}</Badge></div>{event.description&&<p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}<time className="mt-2 block text-xs text-muted-foreground">{new Date(event.event_date).toLocaleString()}</time></div>)}</CardContent></Card>
      </div>
      <Card className="mt-6"><CardHeader><CardTitle>Program beneficiaries</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{beneficiaries.length===0?<p className="text-sm text-muted-foreground">No beneficiaries assigned.</p>:beneficiaries.map(b=><Link key={b.id} href={`/workspace/beneficiaries/${b.id}`} className="rounded-lg border p-4 transition hover:border-blue-300"><div className="flex items-center justify-between gap-3"><span className="font-semibold">{b.full_name}</span><Badge variant="secondary">{b.risk_level}</Badge></div></Link>)}</CardContent></Card>
    </>}
  </div>;
}
