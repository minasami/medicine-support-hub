import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, CalendarDays, Gavel, Plus, RefreshCw } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Program={id:string;organization_id:string;name:string};
type Decision={id:string;title:string;decision:string;rationale:string|null;owner_name:string|null;decision_date:string;status:string};
type Meeting={id:string;title:string;meeting_at:string;attendees:string|null;agenda:string|null;notes:string|null;actions:string|null};

export default function PilotGovernancePage(){
 const [,params]=useRoute("/workspace/pilot-governance/:id");
 const id=params?.id;
 const {isAuthenticated,session,supabaseFetch}=usePatientAuth();
 const [program,setProgram]=useState<Program|null>(null);
 const [decisions,setDecisions]=useState<Decision[]>([]);
 const [meetings,setMeetings]=useState<Meeting[]>([]);
 const [decisionDraft,setDecisionDraft]=useState({title:"",decision:"",rationale:"",owner_name:""});
 const [meetingDraft,setMeetingDraft]=useState({title:"",meeting_at:"",attendees:"",agenda:"",notes:"",actions:""});
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [saving,setSaving]=useState(false);

 async function load(){
  setError("");
  try{
   if(!id)throw new Error("Pilot ID is missing.");
   if(!isAuthenticated||!session?.user?.id)throw new Error("Sign in first.");
   const programs=await supabaseFetch<Program[]>(`/rest/v1/programs?select=id,organization_id,name&id=eq.${id}&limit=1`);
   if(!programs[0])throw new Error("Pilot not found or access denied.");
   setProgram(programs[0]);
   const [d,m]=await Promise.all([
    supabaseFetch<Decision[]>(`/rest/v1/pilot_decisions?select=id,title,decision,rationale,owner_name,decision_date,status&program_id=eq.${id}&order=decision_date.desc,created_at.desc`),
    supabaseFetch<Meeting[]>(`/rest/v1/pilot_meetings?select=id,title,meeting_at,attendees,agenda,notes,actions&program_id=eq.${id}&order=meeting_at.desc`)
   ]);
   setDecisions(d);setMeetings(m);
  }catch(e){setError(e instanceof Error?e.message:"Failed to load governance workspace.")}
 }
 useEffect(()=>{load()},[id,isAuthenticated,session?.access_token]);

 async function addDecision(){
  if(!program||!decisionDraft.title.trim()||!decisionDraft.decision.trim())return;
  setSaving(true);setError("");setMessage("");
  try{
   await supabaseFetch("/rest/v1/pilot_decisions",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({organization_id:program.organization_id,program_id:program.id,title:decisionDraft.title.trim(),decision:decisionDraft.decision.trim(),rationale:decisionDraft.rationale.trim()||null,owner_name:decisionDraft.owner_name.trim()||null})});
   setDecisionDraft({title:"",decision:"",rationale:"",owner_name:""});setMessage("Decision recorded.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Failed to record decision.")}finally{setSaving(false)}
 }
 async function addMeeting(){
  if(!program||!meetingDraft.title.trim()||!meetingDraft.meeting_at)return;
  setSaving(true);setError("");setMessage("");
  try{
   await supabaseFetch("/rest/v1/pilot_meetings",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({organization_id:program.organization_id,program_id:program.id,title:meetingDraft.title.trim(),meeting_at:new Date(meetingDraft.meeting_at).toISOString(),attendees:meetingDraft.attendees.trim()||null,agenda:meetingDraft.agenda.trim()||null,notes:meetingDraft.notes.trim()||null,actions:meetingDraft.actions.trim()||null})});
   setMeetingDraft({title:"",meeting_at:"",attendees:"",agenda:"",notes:"",actions:""});setMessage("Meeting recorded.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Failed to record meeting.")}finally{setSaving(false)}
 }

 return <div className="container mx-auto max-w-7xl px-4 py-8">
  <Button asChild variant="ghost" className="mb-4"><Link href={id?`/workspace/pilots/${id}`:"/workspace"}><ArrowLeft className="mr-2 h-4 w-4"/>Back to pilot</Link></Button>
  <div className="mb-8 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{program?.name||"Pilot Governance"}</h1><p className="mt-2 text-muted-foreground">Decision register, governance meetings, and accountable next actions.</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
  {error&&<p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {message&&<p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
  <div className="grid gap-6 xl:grid-cols-2">
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5"/>Decision register</CardTitle></CardHeader><CardContent className="space-y-4">
    <Field label="Decision title"><Input value={decisionDraft.title} onChange={e=>setDecisionDraft({...decisionDraft,title:e.target.value})}/></Field>
    <Field label="Decision"><Textarea value={decisionDraft.decision} onChange={e=>setDecisionDraft({...decisionDraft,decision:e.target.value})}/></Field>
    <Field label="Rationale"><Textarea value={decisionDraft.rationale} onChange={e=>setDecisionDraft({...decisionDraft,rationale:e.target.value})}/></Field>
    <Field label="Owner"><Input value={decisionDraft.owner_name} onChange={e=>setDecisionDraft({...decisionDraft,owner_name:e.target.value})}/></Field>
    <Button onClick={addDecision} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Record decision</Button>
    <div className="space-y-3">{decisions.map(x=><div key={x.id} className="rounded-lg border p-4"><div className="flex justify-between gap-4"><div className="font-semibold">{x.title}</div><span className="text-xs uppercase text-muted-foreground">{x.status}</span></div><div className="mt-1 text-xs text-muted-foreground">{x.owner_name||"No owner"} • {new Date(x.decision_date).toLocaleDateString()}</div><p className="mt-3 text-sm">{x.decision}</p>{x.rationale&&<p className="mt-2 text-sm text-muted-foreground">Rationale: {x.rationale}</p>}</div>)}</div>
   </CardContent></Card>
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5"/>Governance meetings</CardTitle></CardHeader><CardContent className="space-y-4">
    <Field label="Meeting title"><Input value={meetingDraft.title} onChange={e=>setMeetingDraft({...meetingDraft,title:e.target.value})}/></Field>
    <Field label="Date and time"><Input type="datetime-local" value={meetingDraft.meeting_at} onChange={e=>setMeetingDraft({...meetingDraft,meeting_at:e.target.value})}/></Field>
    <Field label="Attendees"><Input value={meetingDraft.attendees} onChange={e=>setMeetingDraft({...meetingDraft,attendees:e.target.value})}/></Field>
    <Field label="Agenda"><Textarea value={meetingDraft.agenda} onChange={e=>setMeetingDraft({...meetingDraft,agenda:e.target.value})}/></Field>
    <Field label="Notes"><Textarea value={meetingDraft.notes} onChange={e=>setMeetingDraft({...meetingDraft,notes:e.target.value})}/></Field>
    <Field label="Actions"><Textarea value={meetingDraft.actions} onChange={e=>setMeetingDraft({...meetingDraft,actions:e.target.value})}/></Field>
    <Button onClick={addMeeting} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Record meeting</Button>
    <div className="space-y-3">{meetings.map(x=><div key={x.id} className="rounded-lg border p-4"><div className="font-semibold">{x.title}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(x.meeting_at).toLocaleString()}</div>{x.attendees&&<p className="mt-2 text-sm">Attendees: {x.attendees}</p>}{x.actions&&<p className="mt-2 text-sm text-muted-foreground">Actions: {x.actions}</p>}</div>)}</div>
   </CardContent></Card>
  </div>
 </div>
}
function Field({label,children}:{label:string;children:any}){return <div><Label>{label}</Label>{children}</div>}
