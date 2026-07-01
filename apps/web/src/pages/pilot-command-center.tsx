import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, BarChart3, ClipboardCheck, Gavel, LayoutDashboard, Rocket, Target } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Program={id:string;name:string;pilot_phase:string|null;status:string};

export default function PilotCommandCenterPage(){
 const [,params]=useRoute("/workspace/pilot-command/:id");
 const id=params?.id;
 const {isAuthenticated,session,supabaseFetch}=usePatientAuth();
 const [program,setProgram]=useState<Program|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{(async()=>{try{if(!id)throw new Error("Pilot ID is missing.");if(!isAuthenticated||!session?.user?.id)throw new Error("Sign in first.");const rows=await supabaseFetch<Program[]>(`/rest/v1/programs?select=id,name,pilot_phase,status&id=eq.${id}&limit=1`);if(!rows[0])throw new Error("Pilot not found.");setProgram(rows[0])}catch(e){setError(e instanceof Error?e.message:"Failed to load pilot.")}})()},[id,isAuthenticated,session?.access_token]);
 const modules=[
  {title:"Pilot Workspace",description:"Objectives, dates, milestones, deliverables, evidence, risks, and lessons learned.",href:`/workspace/pilots/${id}`,icon:Rocket},
  {title:"Readiness Assessment",description:"100-point launch readiness score, checklist, gaps, and recommended next actions.",href:`/workspace/pilot-readiness/${id}`,icon:ClipboardCheck},
  {title:"Executive Summary",description:"Board-level reach, delivery, budget, timeline, and strategic performance view.",href:`/workspace/pilot-executive/${id}`,icon:BarChart3},
  {title:"Governance",description:"Decision register, governance meetings, accountable owners, and action logs.",href:`/workspace/pilot-governance/${id}`,icon:Gavel},
  {title:"Program Record",description:"Return to the full program management record and operational data.",href:`/workspace/programs/${id}`,icon:LayoutDashboard},
  {title:"Impact Reporting",description:"Review organization-wide medicine access and impact performance.",href:"/impact",icon:Target},
 ];
 return <div className="container mx-auto max-w-7xl px-4 py-8"><Button asChild variant="ghost" className="mb-4 -ml-3"><Link href="/workspace"><ArrowLeft className="mr-2 h-4 w-4"/>Back to workspace</Link></Button><div className="mb-8"><Badge className="mb-3 bg-sky-100 text-sky-800">Pilot Command Center</Badge><h1 className="text-3xl font-bold">{program?.name||"Pilot program"}</h1><p className="mt-2 text-muted-foreground">One place to manage pilot operations, governance, readiness, evidence, reporting, and executive oversight.</p>{program&&<div className="mt-4 flex gap-2"><Badge variant="outline" className="capitalize">{(program.pilot_phase||"discovery").replaceAll("_"," ")}</Badge><Badge variant="outline" className="capitalize">{program.status}</Badge></div>}</div>{error&&<p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{modules.map(({title,description,href,icon:Icon})=><Card key={title} className="transition-shadow hover:shadow-md"><CardContent className="p-6"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-800"><Icon className="h-5 w-5"/></div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 min-h-16 text-sm text-muted-foreground">{description}</p><Button asChild className="mt-5 w-full"><Link href={href}>Open module</Link></Button></CardContent></Card>)}</div></div>
}
