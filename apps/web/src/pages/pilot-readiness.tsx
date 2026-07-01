import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleDollarSign, ClipboardCheck, FileCheck2, Flag, RefreshCw, Target, Users } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Readiness = {
  program_id:string;
  organization_id:string;
  program_name:string;
  pilot_phase:string|null;
  sites_count:number;
  target_beneficiaries:number;
  budget_amount:number|string;
  spent_amount:number|string;
  start_date:string|null;
  end_date:string|null;
  enrolled_beneficiaries:number;
  milestones_total:number;
  milestones_completed:number;
  deliverables_total:number;
  deliverables_approved:number;
};

type ProgramDetail = { pilot_objective:string|null; success_criteria:string|null; risks:string|null };

export default function PilotReadinessPage(){
  const [,params]=useRoute("/workspace/pilot-readiness/:id");
  const id=params?.id;
  const {isAuthenticated,session,supabaseFetch}=usePatientAuth();
  const [data,setData]=useState<Readiness|null>(null);
  const [detail,setDetail]=useState<ProgramDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError(null);
    try{
      if(!id)throw new Error("Pilot ID is missing.");
      if(!isAuthenticated||!session?.user?.id)throw new Error("Sign in first.");
      const [rows,details]=await Promise.all([
        supabaseFetch<Readiness[]>(`/rest/v1/pilot_readiness_summary?select=*&program_id=eq.${id}&limit=1`),
        supabaseFetch<ProgramDetail[]>(`/rest/v1/programs?select=pilot_objective,success_criteria,risks&id=eq.${id}&limit=1`),
      ]);
      if(!rows[0])throw new Error("Pilot readiness data was not found.");
      setData(rows[0]);setDetail(details[0]??null);
    }catch(e){setError(e instanceof Error?e.message:"Failed to load pilot readiness.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[id,isAuthenticated,session?.access_token]);

  const readiness=useMemo(()=>{
    if(!data)return 0;
    let score=0;
    if(detail?.pilot_objective?.trim())score+=15;
    if(detail?.success_criteria?.trim())score+=15;
    if(data.start_date&&data.end_date)score+=10;
    if(data.sites_count>0)score+=10;
    if(Number(data.budget_amount)>0)score+=10;
    if(data.milestones_total>0)score+=15;
    if(data.deliverables_total>0)score+=15;
    if(data.deliverables_approved>0)score+=10;
    return score;
  },[data,detail]);

  const checks = data ? [
    ["Pilot objective defined",!!detail?.pilot_objective?.trim()],
    ["Success criteria defined",!!detail?.success_criteria?.trim()],
    ["Start and end dates set",!!data.start_date&&!!data.end_date],
    ["At least one site configured",data.sites_count>0],
    ["Budget established",Number(data.budget_amount)>0],
    ["Milestones created",data.milestones_total>0],
    ["Deliverables created",data.deliverables_total>0],
    ["At least one deliverable approved",data.deliverables_approved>0],
    ["Risks documented",!!detail?.risks?.trim()],
  ] as const : [];

  const milestoneRate=data?.milestones_total?Math.round(data.milestones_completed/data.milestones_total*100):0;
  const deliverableRate=data?.deliverables_total?Math.round(data.deliverables_approved/data.deliverables_total*100):0;
  const enrollmentRate=data?.target_beneficiaries?Math.round(data.enrolled_beneficiaries/data.target_beneficiaries*100):0;
  const budgetUtilization=Number(data?.budget_amount)>0?Math.round(Number(data?.spent_amount)/Number(data?.budget_amount)*100):0;

  return <div className="container mx-auto max-w-7xl px-4 py-8">
    <Button asChild variant="ghost" className="mb-3 -ml-3"><Link href={id?`/workspace/pilots/${id}`:"/workspace"}><ArrowLeft className="mr-2 h-4 w-4"/>Back to pilot workspace</Link></Button>
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><Badge className="mb-3 bg-violet-100 text-violet-700">Pilot Readiness v3</Badge><h1 className="text-3xl font-bold">{data?.program_name||"Pilot readiness"}</h1><p className="mt-2 text-muted-foreground">A structured readiness assessment based on objectives, dates, sites, budget, milestones, deliverables, evidence, and risk planning.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    {error&&<Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}
    {loading&&<p className="text-muted-foreground">Loading readiness assessment...</p>}
    {data&&<>
      <Card className="mb-6 overflow-hidden"><div className="grid md:grid-cols-[240px_1fr]"><div className="flex flex-col items-center justify-center bg-[#0B1F33] p-8 text-white"><div className="text-6xl font-bold text-sky-300">{readiness}</div><div className="mt-1 text-sm text-slate-300">Readiness score / 100</div><Badge className="mt-4 bg-white/10 text-white">{readiness>=80?"Pilot ready":readiness>=50?"Preparation in progress":"Foundation incomplete"}</Badge></div><CardContent className="p-6"><div className="grid gap-3 sm:grid-cols-2">{checks.map(([label,done])=><div key={label} className="flex items-center gap-3 rounded-lg border p-3"><CheckCircle2 className={`h-5 w-5 ${done?"text-emerald-600":"text-slate-300"}`}/><span className={done?"font-medium":"text-muted-foreground"}>{label}</span></div>)}</div></CardContent></div></Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users} label="Enrollment" value={`${data.enrolled_beneficiaries}/${data.target_beneficiaries||0}`} sub={`${enrollmentRate}% of target`}/>
        <Metric icon={Target} label="Milestones" value={`${data.milestones_completed}/${data.milestones_total}`} sub={`${milestoneRate}% complete`}/>
        <Metric icon={FileCheck2} label="Deliverables" value={`${data.deliverables_approved}/${data.deliverables_total}`} sub={`${deliverableRate}% approved`}/>
        <Metric icon={CircleDollarSign} label="Budget use" value={`${budgetUtilization}%`} sub={`${Number(data.spent_amount||0).toLocaleString()} spent`}/>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5"/>Current pilot position</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Row label="Phase" value={(data.pilot_phase||"Not set").replaceAll("_"," ")}/><Row label="Sites" value={String(data.sites_count||0)}/><Row label="Start date" value={data.start_date?new Date(data.start_date).toLocaleDateString():"Not set"}/><Row label="End date" value={data.end_date?new Date(data.end_date).toLocaleDateString():"Not set"}/></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5"/>Recommended next actions</CardTitle></CardHeader><CardContent className="space-y-3">{checks.filter(([,done])=>!done).slice(0,5).map(([label])=><div key={label} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Complete: {label}</div>)}{checks.every(([,done])=>done)&&<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">All core readiness checks are complete. Move to formal pilot approval and launch governance.</div>}</CardContent></Card>
      </div>
    </>}
  </div>
}

function Metric({icon:Icon,label,value,sub}:{icon:any;label:string;value:string;sub:string}){return <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{sub}</div></CardContent></Card>}
function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-4 rounded-lg border p-3"><span className="text-muted-foreground">{label}</span><strong className="capitalize">{value}</strong></div>}
