import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CalendarDays, CircleDollarSign, Flag, Plus, RefreshCw, Save, Target, Users } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Program = { id:string; organization_id:string; name:string; status:string; description:string|null; objectives:string|null; budget_amount:number|string; committed_amount:number|string; spent_amount:number|string; currency:string; target_beneficiaries:number; kpi_summary:string|null; start_date:string|null; end_date:string|null };
type Beneficiary = { id:string; full_name:string; risk_level:string; status:string; primary_condition:string|null };
type Event = { id:string; event_type:string; title:string; description:string|null; event_date:string };
const EVENT_TYPES = ["milestone","budget_update","beneficiary_update","review","risk","note"];

export default function ProgramDetailPage() {
  const [, params] = useRoute("/workspace/programs/:id");
  const programId = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [program, setProgram] = useState<Program|null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventDraft, setEventDraft] = useState({ event_type:"note", title:"", description:"" });
  const [editDraft, setEditDraft] = useState({ name:"", description:"", objectives:"", kpi_summary:"", budget_amount:"", committed_amount:"", spent_amount:"", currency:"EGP", target_beneficiaries:"", start_date:"", end_date:"", status:"active" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [message, setMessage] = useState<string|null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      if (!programId) throw new Error("Program ID is missing.");
      if (!isAuthenticated || !session?.user?.id) throw new Error("Sign in first.");
      const rows = await supabaseFetch<Program[]>(`/rest/v1/programs?select=id,organization_id,name,status,description,objectives,budget_amount,committed_amount,spent_amount,currency,target_beneficiaries,kpi_summary,start_date,end_date&id=eq.${programId}&limit=1`);
      const current = rows[0] ?? null;
      if (!current) throw new Error("Program not found or access denied.");
      setProgram(current);
      setEditDraft({ name:current.name, description:current.description||"", objectives:current.objectives||"", kpi_summary:current.kpi_summary||"", budget_amount:String(current.budget_amount||0), committed_amount:String(current.committed_amount||0), spent_amount:String(current.spent_amount||0), currency:current.currency||"EGP", target_beneficiaries:String(current.target_beneficiaries||0), start_date:current.start_date||"", end_date:current.end_date||"", status:current.status });
      const [beneficiaryRows,eventRows] = await Promise.all([
        supabaseFetch<Beneficiary[]>(`/rest/v1/beneficiaries?select=id,full_name,risk_level,status,primary_condition&program_id=eq.${programId}&order=created_at.desc`),
        supabaseFetch<Event[]>(`/rest/v1/program_events?select=id,event_type,title,description,event_date&program_id=eq.${programId}&order=event_date.desc`),
      ]);
      setBeneficiaries(beneficiaryRows); setEvents(eventRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load program."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [programId,isAuthenticated,session?.access_token]);
  const budget = Number(program?.budget_amount || 0), committed = Number(program?.committed_amount || 0), spent = Number(program?.spent_amount || 0);
  const remaining = budget - committed - spent;
  const utilization = useMemo(() => budget > 0 ? Math.min(100, Math.round(((committed + spent) / budget) * 100)) : 0,[budget,committed,spent]);
  const coverage = program?.target_beneficiaries ? Math.round((beneficiaries.length / program.target_beneficiaries) * 100) : 0;

  async function saveProgram() {
    if (!program) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/programs?id=eq.${program.id}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ name:editDraft.name.trim(), description:editDraft.description.trim()||null, objectives:editDraft.objectives.trim()||null, kpi_summary:editDraft.kpi_summary.trim()||null, budget_amount:Number(editDraft.budget_amount||0), committed_amount:Number(editDraft.committed_amount||0), spent_amount:Number(editDraft.spent_amount||0), currency:editDraft.currency.toUpperCase(), target_beneficiaries:Number(editDraft.target_beneficiaries||0), start_date:editDraft.start_date||null, end_date:editDraft.end_date||null, status:editDraft.status }) });
      setMessage("Program updated."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update program."); }
    finally { setSaving(false); }
  }

  async function addEvent() {
    if (!program || !eventDraft.title.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/program_events`, { method:"POST", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ organization_id:program.organization_id, program_id:program.id, event_type:eventDraft.event_type, title:eventDraft.title.trim(), description:eventDraft.description.trim() || null }) });
      setEventDraft({ event_type:"note", title:"", description:"" });
      setMessage("Program event added."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add event."); }
    finally { setSaving(false); }
  }

  return <div className="container mx-auto max-w-7xl px-4 py-8">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><Button asChild variant="ghost" className="mb-3 -ml-3"><Link href="/workspace"><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</Link></Button><Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100">Program Management v2</Badge><h1 className="text-3xl font-bold">{program?.name ?? "Program dashboard"}</h1><p className="mt-2 max-w-3xl text-muted-foreground">{program?.description || "Program objectives, budget, beneficiaries, milestones, and operational activity."}</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-6"><AlertDescription>{message}</AlertDescription></Alert>}
    {program && <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4" />Budget</div><div className="mt-2 text-2xl font-bold">{budget.toLocaleString()} {program.currency}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Flag className="h-4 w-4" />Remaining</div><div className="mt-2 text-2xl font-bold text-emerald-700">{remaining.toLocaleString()} {program.currency}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Beneficiaries</div><div className="mt-2 text-2xl font-bold">{beneficiaries.length}</div><div className="text-xs text-muted-foreground">Target {program.target_beneficiaries || "not set"} • {coverage}% coverage</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" />Budget utilization</div><div className="mt-2 text-2xl font-bold">{utilization}%</div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:`${utilization}%`}} /></div></CardContent></Card></div>
      <Card className="mb-6"><CardHeader><CardTitle>Edit program</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><Label>Name</Label><Input value={editDraft.name} onChange={e=>setEditDraft({...editDraft,name:e.target.value})}/></div><div><Label>Status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.status} onChange={e=>setEditDraft({...editDraft,status:e.target.value})}>{["draft","active","paused","completed","archived"].map(s=><option key={s}>{s}</option>)}</select></div><div><Label>Start date</Label><Input type="date" value={editDraft.start_date} onChange={e=>setEditDraft({...editDraft,start_date:e.target.value})}/></div><div><Label>End date</Label><Input type="date" value={editDraft.end_date} onChange={e=>setEditDraft({...editDraft,end_date:e.target.value})}/></div><div><Label>Budget</Label><Input type="number" value={editDraft.budget_amount} onChange={e=>setEditDraft({...editDraft,budget_amount:e.target.value})}/></div><div><Label>Committed</Label><Input type="number" value={editDraft.committed_amount} onChange={e=>setEditDraft({...editDraft,committed_amount:e.target.value})}/></div><div><Label>Spent</Label><Input type="number" value={editDraft.spent_amount} onChange={e=>setEditDraft({...editDraft,spent_amount:e.target.value})}/></div><div><Label>Target beneficiaries</Label><Input type="number" value={editDraft.target_beneficiaries} onChange={e=>setEditDraft({...editDraft,target_beneficiaries:e.target.value})}/></div></div><div><Label>Description</Label><Textarea value={editDraft.description} onChange={e=>setEditDraft({...editDraft,description:e.target.value})}/></div><div><Label>Objectives</Label><Textarea value={editDraft.objectives} onChange={e=>setEditDraft({...editDraft,objectives:e.target.value})}/></div><div><Label>KPI summary</Label><Textarea value={editDraft.kpi_summary} onChange={e=>setEditDraft({...editDraft,kpi_summary:e.target.value})}/></div><Button onClick={saveProgram} disabled={saving || !editDraft.name.trim()}><Save className="mr-2 h-4 w-4" />Save program</Button></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><Card><CardHeader><CardTitle>Add program event</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={eventDraft.event_type} onChange={e=>setEventDraft({...eventDraft,event_type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</select></div><div><Label>Title</Label><Input value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})}/></div><div><Label>Description</Label><Textarea value={eventDraft.description} onChange={e=>setEventDraft({...eventDraft,description:e.target.value})}/></div><Button onClick={addEvent} disabled={saving || !eventDraft.title.trim()}><Plus className="mr-2 h-4 w-4" />Add event</Button></CardContent></Card><Card><CardHeader><CardTitle>Program activity</CardTitle></CardHeader><CardContent className="space-y-3">{events.length===0?<p className="text-sm text-muted-foreground">No program events yet.</p>:events.map(e=><div key={e.id} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-2"><div className="font-semibold">{e.title}</div><Badge variant="outline">{e.event_type.replaceAll("_"," ")}</Badge></div>{e.description&&<p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}<time className="mt-2 block text-xs text-muted-foreground">{new Date(e.event_date).toLocaleString()}</time></div>)}</CardContent></Card></div>
      <Card className="mt-6"><CardHeader><CardTitle>Program beneficiaries</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{beneficiaries.length===0?<p className="text-sm text-muted-foreground">No beneficiaries assigned.</p>:beneficiaries.map(b=><Link key={b.id} href={`/workspace/beneficiaries/${b.id}`} className="rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><div className="flex items-center justify-between"><div className="font-semibold">{b.full_name}</div><Badge variant="secondary">{b.risk_level}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{b.primary_condition || "No condition recorded"}</p></Link>)}</CardContent></Card>
    </>}
  </div>;
}
