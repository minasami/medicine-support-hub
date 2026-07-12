import { useEffect, useState } from "react";
import { Activity, AlertCircle, Check, FileHeart, KeyRound, ShieldCheck, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Patient={id:string;full_name:string;birthdate:string|null;phone:string|null;city:string|null;identity_verification_status:string;status:string};
type Access={id:string;organization_id:string;access_level:string;scopes:string[];status:string;reason:string|null;created_at:string;expires_at:string|null};
type Event={id:string;resource_type:string;event_type:string;status:string|null;title:string;summary:string|null;occurred_at:string};

export default function PatientHealthRecord(){
  const {t}=useLanguage();
  const {session,isAuthenticated,supabaseFetch}=usePatientAuth();
  const [patient,setPatient]=useState<Patient|null>(null);
  const [access,setAccess]=useState<Access[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [claimCode,setClaimCode]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError(null);
    try{
      if(!isAuthenticated||!session?.user?.id){setPatient(null);setAccess([]);setEvents([]);return;}
      const rows=await supabaseFetch<Patient[]>(`/rest/v1/clinical_patients?select=id,full_name,birthdate,phone,city,identity_verification_status,status&user_id=eq.${session.user.id}&limit=1`);
      const next=rows[0]||null;setPatient(next);
      if(!next){setAccess([]);setEvents([]);return;}
      const [accessRows,eventRows]=await Promise.all([
        supabaseFetch<Access[]>(`/rest/v1/clinical_patient_access?select=id,organization_id,access_level,scopes,status,reason,created_at,expires_at&patient_id=eq.${next.id}&order=created_at.desc`),
        supabaseFetch<Event[]>(`/rest/v1/clinical_patient_timeline_v1?select=id,resource_type,event_type,status,title,summary,occurred_at&patient_id=eq.${next.id}&order=occurred_at.desc&limit=200`),
      ]);
      setAccess(accessRows);setEvents(eventRows);
    }catch(cause){setError(cause instanceof Error?cause.message:t("The clinical record is not enabled for this environment yet.","السجل السريري غير مفعّل لهذه البيئة بعد."));}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[isAuthenticated,session?.user?.id]);

  async function claim(event:React.FormEvent){
    event.preventDefault();if(!claimCode.trim())return;setSaving(true);setError(null);setMessage(null);
    try{
      await supabaseFetch("/rest/v1/rpc/clinical_claim_patient_profile",{method:"POST",body:JSON.stringify({p_claim_code:claimCode.trim()})});
      setClaimCode("");setMessage(t("Your invited clinical record is now linked to this account.","تم ربط سجلك السريري المدعو بهذا الحساب."));await load();
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not claim this record.","تعذر ربط هذا السجل."));}
    finally{setSaving(false);}
  }

  async function decide(id:string,decision:"granted"|"denied"|"revoked"){
    setSaving(true);setError(null);setMessage(null);
    try{await supabaseFetch("/rest/v1/rpc/clinical_decide_patient_access",{method:"POST",body:JSON.stringify({p_access_id:id,p_decision:decision})});setMessage(t("Access decision saved.","تم حفظ قرار الوصول."));await load();}
    catch(cause){setError(cause instanceof Error?cause.message:t("Could not update access.","تعذر تحديث الوصول."));}
    finally{setSaving(false);}
  }

  if(!isAuthenticated)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>{t("Sign in or create a patient account first.","سجل الدخول أو أنشئ حساب مريض أولًا.")}</AlertDescription></Alert><Button asChild className="mt-4"><a href="/account">{t("Open account","فتح الحساب")}</a></Button></main>;

  return <main className="container mx-auto max-w-6xl px-4 py-8"><section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><FileHeart className="h-4 w-4"/>{t("My protected health record","سجلي الصحي المحمي")}</p><h1 className="mt-3 text-4xl font-bold">{patient?.full_name||t("Connect your healthcare journey","اربط رحلتك الصحية")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("Review who can access your record and follow encounters, prescriptions, diagnostic orders, results, insurance decisions, and medicine fulfillment in one timeline.","راجع من يمكنه الوصول إلى سجلك وتابع الزيارات والوصفات وطلبات الفحوص والنتائج وقرارات التأمين وصرف الأدوية في خط زمني واحد.")}</p></section>
    {error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><Check className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {!patient&&!loading&&<Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>{t("Claim an invited record","ربط سجل مدعو")}</CardTitle></CardHeader><CardContent><form onSubmit={claim} className="flex max-w-xl gap-2"><div className="flex-1"><Label>{t("One-time claim code","رمز الربط لمرة واحدة")}</Label><Input className="mt-1 font-mono uppercase" value={claimCode} onChange={event=>setClaimCode(event.target.value.toUpperCase())}/></div><Button className="self-end" type="submit" disabled={saving||claimCode.trim().length<8}>{t("Claim record","ربط السجل")}</Button></form></CardContent></Card>}
    {patient&&<><section className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label={t("Verification","التحقق")} value={patient.identity_verification_status}/><Metric label={t("Birthdate","تاريخ الميلاد")} value={patient.birthdate||"—"}/><Metric label={t("Journey events","أحداث الرحلة")} value={String(events.length)}/></section>
    <section className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>{t("Care-team access","وصول فريق الرعاية")}</CardTitle></CardHeader><CardContent className="space-y-3">{access.length===0?<p className="text-sm text-muted-foreground">{t("No access relationships yet.","لا توجد علاقات وصول بعد.")}</p>:access.map(row=><div key={row.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{row.access_level.replaceAll("_"," ")}</div><div className="mt-1 text-xs text-muted-foreground">{row.scopes.join(" · ")}</div></div><Badge variant={row.status==="granted"?"default":"secondary"}>{row.status}</Badge></div>{row.reason&&<p className="mt-2 text-sm text-muted-foreground">{row.reason}</p>}<div className="mt-3 flex gap-2">{row.status==="requested"&&<><Button size="sm" onClick={()=>void decide(row.id,"granted")} disabled={saving}><Check className="mr-1 h-3 w-3"/>{t("Grant","منح")}</Button><Button size="sm" variant="destructive" onClick={()=>void decide(row.id,"denied")} disabled={saving}><X className="mr-1 h-3 w-3"/>{t("Deny","رفض")}</Button></>}{row.status==="granted"&&<Button size="sm" variant="outline" onClick={()=>void decide(row.id,"revoked")} disabled={saving}>{t("Revoke","إلغاء")}</Button>}</div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5"/>{t("Healthcare journey timeline","الخط الزمني لرحلة الرعاية")}</CardTitle></CardHeader><CardContent className="space-y-3">{events.length===0?<p className="text-sm text-muted-foreground">{t("No journey events yet.","لا توجد أحداث في الرحلة بعد.")}</p>:events.map(event=><div key={event.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{event.title}</div><p className="mt-1 text-sm text-muted-foreground">{event.summary||event.resource_type}</p></div><Badge variant="outline">{event.status||event.event_type}</Badge></div><div className="mt-2 text-xs text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</div></div>)}</CardContent></Card></section></>}
    <Alert className="mt-8"><AlertDescription>{t("This record is a controlled clinical foundation and does not replace emergency services or direct communication with your licensed healthcare team.","هذا السجل أساس سريري منضبط ولا يستبدل خدمات الطوارئ أو التواصل المباشر مع فريق الرعاية المرخص.")}</AlertDescription></Alert>
  </main>;
}
function Metric({label,value}:{label:string;value:string}){return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></CardContent></Card>;}
