import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, RefreshCw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile={role:string;is_active:boolean};
type Campaign={id:string;title:string;body:string;audience_type:string;audience_values:string[];notification_topic:string;target_url:string|null;status:string;attempted_count:number;delivered_count:number;failed_count:number;created_at:string;completed_at:string|null};
type Summary={active_subscriptions:number;subscribed_users:number;draft_campaigns:number;sent_campaigns:number;total_delivered:number;total_failed:number};
type PushConfig={enabled:boolean;public_key:string|null};
type Draft={title:string;body:string;audienceType:string;audienceValues:string;topic:string;targetUrl:string;imageUrl:string};
const emptyDraft:Draft={title:"",body:"",audienceType:"all",audienceValues:"",topic:"platform_updates",targetUrl:"/",imageUrl:""};
const templates=[
  {label:"Medicine update",topic:"medicine_updates",audienceType:"medicine",title:"Medicine information updated",body:"New source-backed information is available for a medicine you follow. Review the updated evidence and price timeline.",targetUrl:"/medicines"},
  {label:"Company portfolio",topic:"company_updates",audienceType:"company",title:"Company portfolio updated",body:"A company profile or medicine portfolio you follow has new reviewed information.",targetUrl:"/companies"},
  {label:"Marketplace",topic:"marketplace_updates",audienceType:"topic",title:"New verified marketplace offers",body:"Reviewed medicine supply offers are now available from verified sellers.",targetUrl:"/marketplace"},
  {label:"Learning",topic:"learning_updates",audienceType:"topic",title:"New healthcare learning content",body:"A new role-based lesson is available in the Medicine Support Hub Learning Center.",targetUrl:"/learn"},
  {label:"Platform",topic:"platform_updates",audienceType:"all",title:"Medicine Support Hub update",body:"A useful platform improvement is now available.",targetUrl:"/journey"},
];
const splitValues=(value:string)=>value.split(/[\n,]/).map(item=>item.trim()).filter(Boolean);
const humanize=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default function AdminNotifications(){
  const {session,supabaseFetch}=usePatientAuth();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [pushConfig,setPushConfig]=useState<PushConfig|null>(null);
  const [draft,setDraft]=useState<Draft>(emptyDraft);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const isAdmin=Boolean(profile?.is_active&&["admin","platform_admin","super_admin"].includes(profile.role));

  async function load(){setLoading(true);setError(null);try{
    if(!session?.user?.id)throw new Error("Sign in through the staff portal first.");
    const [profiles,summaryRows,campaignRows,config]=await Promise.all([
      supabaseFetch<Profile[]>(`/rest/v1/profiles?select=role,is_active&id=eq.${session.user.id}&limit=1`),
      supabaseFetch<Summary[]>("/rest/v1/rpc/notification_admin_summary",{method:"POST",body:"{}"}),
      supabaseFetch<Campaign[]>("/rest/v1/notification_campaigns?select=id,title,body,audience_type,audience_values,notification_topic,target_url,status,attempted_count,delivered_count,failed_count,created_at,completed_at&order=created_at.desc&limit=100"),
      fetch("/api/push-config").then(response=>response.json()),
    ]);
    const nextProfile=profiles[0]||null;setProfile(nextProfile);if(!nextProfile?.is_active||!["admin","platform_admin","super_admin"].includes(nextProfile.role))throw new Error("Active platform-admin access is required.");
    setSummary(summaryRows[0]||null);setCampaigns(campaignRows);setPushConfig(config);
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load notification management.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[session?.user?.id]);

  const needsTarget=useMemo(()=>["users","role","topic","medicine","company"].includes(draft.audienceType),[draft.audienceType]);
  function applyTemplate(template:typeof templates[number]){setDraft(current=>({...current,title:template.title,body:template.body,topic:template.topic,audienceType:template.audienceType,targetUrl:template.targetUrl}));}

  async function createCampaign(sendNow:boolean){
    if(!session?.user?.id)return;setSaving(true);setError(null);setMessage(null);
    try{
      if(draft.title.trim().length<2||draft.body.trim().length<2)throw new Error("Title and message are required.");
      if(/^\/(admin|workspace|dashboard|account|portal|login|track|pharmacy|reviewer|physician|employee|clinical-assistant)(\/|$)/i.test(draft.targetUrl))throw new Error("Notifications cannot link directly to protected workspace routes.");
      const values=splitValues(draft.audienceValues);
      if(needsTarget&&!values.length&&!["topic"].includes(draft.audienceType))throw new Error("Enter at least one audience value.");
      const created=await supabaseFetch<Campaign[]>("/rest/v1/notification_campaigns?select=*",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({title:draft.title.trim(),body:draft.body.trim(),audience_type:draft.audienceType,audience_values:values,notification_topic:draft.topic,target_url:draft.targetUrl.trim()||"/",image_url:draft.imageUrl.trim()||null,status:"draft",created_by:session.user.id,data:{contains_protected_health_information:false}})});
      const campaign=created[0];if(!campaign)throw new Error("Campaign could not be created.");
      if(sendNow){
        if(!session.access_token)throw new Error("Staff access token is unavailable.");
        const response=await fetch("/api/admin-send-push",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({campaign_id:campaign.id})});
        const result=await response.json();if(!response.ok)throw new Error(result?.message||"Push delivery failed.");
        setMessage(`Campaign sent: ${result.delivered} delivered, ${result.failed} failed.`);
      }else setMessage("Campaign saved as a draft.");
      setDraft(emptyDraft);await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not create the campaign.");}finally{setSaving(false);}
  }

  if(!session?.access_token)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Sign in through the staff portal first.</AlertDescription></Alert></main>;
  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Bell className="h-4 w-4"/>Platform notification management</p><h1 className="mt-3 text-3xl font-bold">Push campaigns and user updates</h1><p className="mt-3 max-w-4xl text-muted-foreground">Send audience-specific platform, medicine, company, marketplace, learning, and favorite updates. Notifications must remain generic and must never contain protected health information, national IDs, diagnoses, prescriptions, or private workflow details.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div></section>
    {error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><CheckCircle2 className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {!loading&&isAdmin&&<><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Active subscriptions" value={summary?.active_subscriptions||0}/><Metric label="Subscribed users" value={summary?.subscribed_users||0}/><Metric label="Draft campaigns" value={summary?.draft_campaigns||0}/><Metric label="Sent campaigns" value={summary?.sent_campaigns||0}/><Metric label="Delivered" value={summary?.total_delivered||0}/><Metric label="Failed" value={summary?.total_failed||0}/></section>
      <Alert className="mt-5"><ShieldCheck className="h-4 w-4"/><AlertDescription>{pushConfig?.enabled?"Web Push VAPID delivery is configured.":"Web Push is feature-ready but inactive until WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_SUBJECT are configured in Vercel."}</AlertDescription></Alert>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><Card><CardHeader><CardTitle>Compose campaign</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Smart templates</Label><div className="mt-2 flex flex-wrap gap-2">{templates.map(template=><Button key={template.label} variant="outline" size="sm" onClick={()=>applyTemplate(template)}><Sparkles className="mr-1 h-3.5 w-3.5"/>{template.label}</Button>)}</div></div><div className="grid gap-4 md:grid-cols-2"><div><Label>Notification topic</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.topic} onChange={event=>setDraft(current=>({...current,topic:event.target.value}))}><option value="platform_updates">Platform updates</option><option value="medicine_updates">Medicine updates</option><option value="company_updates">Company updates</option><option value="marketplace_updates">Marketplace updates</option><option value="learning_updates">Learning updates</option><option value="favorite_updates">Favorite updates</option></select></div><div><Label>Audience</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.audienceType} onChange={event=>setDraft(current=>({...current,audienceType:event.target.value}))}><option value="all">All subscribed users</option><option value="users">Specific user IDs</option><option value="role">User roles</option><option value="topic">Subscribed topic</option><option value="medicine">Followers of a medicine ID</option><option value="company">Followers of a company slug</option></select></div></div>{needsTarget&&<div><Label>Audience values</Label><Textarea className="mt-1" value={draft.audienceValues} onChange={event=>setDraft(current=>({...current,audienceValues:event.target.value}))} placeholder={draft.audienceType==="medicine"?"Canonical medicine ID":draft.audienceType==="company"?"company-slug":draft.audienceType==="role"?"patient, pharmacist, physician":"One value per line or comma-separated"}/></div>}<div><Label>Title</Label><Input className="mt-1" value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))} maxLength={120}/></div><div><Label>Message</Label><Textarea className="mt-1" value={draft.body} onChange={event=>setDraft(current=>({...current,body:event.target.value}))} maxLength={500}/></div><div className="grid gap-4 md:grid-cols-2"><div><Label>Public target URL</Label><Input className="mt-1" value={draft.targetUrl} onChange={event=>setDraft(current=>({...current,targetUrl:event.target.value}))} placeholder="/medicines"/></div><div><Label>Optional image URL</Label><Input className="mt-1" value={draft.imageUrl} onChange={event=>setDraft(current=>({...current,imageUrl:event.target.value}))}/></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void createCampaign(false)} disabled={saving}>Save draft</Button><Button onClick={()=>void createCampaign(true)} disabled={saving||!pushConfig?.enabled}><Send className="mr-2 h-4 w-4"/>Send now</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Preview</CardTitle></CardHeader><CardContent><div className="rounded-2xl border bg-muted/20 p-5"><div className="flex items-start gap-3"><img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl"/><div><div className="font-semibold">{draft.title||"Notification title"}</div><p className="mt-1 text-sm text-muted-foreground">{draft.body||"Notification message preview"}</p><p className="mt-2 text-xs text-primary">{draft.targetUrl||"/"}</p></div></div></div><Alert className="mt-4"><AlertDescription>“Intelligent” targeting here means explicit roles, topics, favorites, medicine IDs, and company slugs—not opaque profiling or diagnosis inference.</AlertDescription></Alert></CardContent></Card></section>
      <section className="mt-8"><h2 className="text-2xl font-semibold">Campaign history</h2><div className="mt-4 grid gap-3">{campaigns.map(campaign=><Card key={campaign.id}><CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"><div><div className="font-semibold">{campaign.title}</div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.body}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{humanize(campaign.notification_topic)}</Badge><Badge variant="outline">{humanize(campaign.audience_type)}</Badge></div></div><div className="text-sm"><div>{campaign.delivered_count} delivered</div><div className="text-muted-foreground">{campaign.failed_count} failed</div></div><Badge variant={campaign.status==="sent"?"default":campaign.status==="failed"?"destructive":"secondary"}>{humanize(campaign.status)}</Badge></CardContent></Card>)}{campaigns.length===0&&<Card><CardContent className="p-6 text-sm text-muted-foreground">No notification campaigns yet.</CardContent></Card>}</div></section></>}
  </main>;
}
function Metric({label,value}:{label:string;value:number}){return <Card><CardContent className="p-4"><div className="text-2xl font-bold">{Number(value).toLocaleString()}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>;}
