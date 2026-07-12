import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, ClipboardPlus, FlaskConical, HeartPulse, IdCard, Image, Pill, Search, ShieldCheck, Stethoscope, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Membership={organization_id:string;role:string;organizations:{id:string;name:string;organization_type:string;city:string|null;country:string|null}|null};
type Patient={patient_id:string;full_name:string;birthdate:string|null;phone?:string|null;city?:string|null;identity_last4?:string|null;access_status?:string;identity_verification_status?:string};
type JourneyEvent={id:string;resource_type:string;resource_id:string|null;event_type:string;status:string|null;title:string;summary:string|null;occurred_at:string};
const today=()=>new Date().toISOString().slice(0,10);

export default function ClinicalJourney(){
  const {t}=useLanguage();
  const {session,isAuthenticated,supabaseFetch}=usePatientAuth();
  const [membership,setMembership]=useState<Membership|null>(null);
  const [patients,setPatients]=useState<Patient[]>([]);
  const [selected,setSelected]=useState<Patient|null>(null);
  const [timeline,setTimeline]=useState<JourneyEvent[]>([]);
  const [nameQuery,setNameQuery]=useState("");
  const [identityQuery,setIdentityQuery]=useState("");
  const [claimCode,setClaimCode]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [patientDraft,setPatientDraft]=useState({full_name:"",birthdate:"",phone:"",email:"",city:"",identity_value:"",sex_at_birth:"not_recorded",consent_basis:"treatment"});
  const [encounterDraft,setEncounterDraft]=useState({encounter_type:"outpatient",chief_complaint:"",clinical_summary:"",diagnosis_summary:"",care_plan:""});
  const [prescriptionDraft,setPrescriptionDraft]=useState({medicine_name:"",canonical_medicine_id:"",dose:"",frequency:"",duration:"",quantity:"",quantity_unit:"",route:"",indication:"",instructions:"",insurance_required:false});
  const [orderDraft,setOrderDraft]=useState({service_type:"laboratory",service_name:"",priority:"routine",clinical_question:"",instructions:"",destination_organization_id:"",insurance_required:false});
  const [activeEncounterId,setActiveEncounterId]=useState<string|null>(null);

  async function loadMembership(){
    setLoading(true);setError(null);
    try{
      if(!isAuthenticated||!session?.user?.id)throw new Error(t("Sign in with a clinical staff account.","سجل الدخول بحساب موظف سريري."));
      const rows=await supabaseFetch<Membership[]>(`/rest/v1/organization_members?select=organization_id,role,organizations(id,name,organization_type,city,country)&user_id=eq.${session.user.id}&is_active=eq.true&limit=1`);
      const next=rows[0]||null;setMembership(next);
      if(!next)throw new Error(t("Your account is not connected to an organization.","حسابك غير مرتبط بمؤسسة."));
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not open clinical workspace.","تعذر فتح مساحة العمل السريرية."));}
    finally{setLoading(false);}
  }
  useEffect(()=>{void loadMembership();},[isAuthenticated,session?.user?.id]);

  async function searchAccessible(){
    if(!membership)return;setSaving(true);setError(null);setMessage(null);
    try{
      const rows=await supabaseFetch<Patient[]>("/rest/v1/rpc/clinical_search_accessible_patients",{method:"POST",body:JSON.stringify({p_organization_id:membership.organization_id,p_query:nameQuery,p_limit:30})});
      setPatients(rows);if(rows.length===0)setMessage(t("No accessible patients matched. Use exact identity match or create an invited profile.","لا يوجد مريض مصرح به مطابق. استخدم مطابقة الهوية الدقيقة أو أنشئ ملف دعوة."));
    }catch(cause){setError(cause instanceof Error?cause.message:t("Clinical access is not enabled in this environment.","الوصول السريري غير مفعّل في هذه البيئة."));}
    finally{setSaving(false);}
  }

  async function searchIdentity(){
    if(!membership||identityQuery.replace(/\D/g,"").length!==14)return;setSaving(true);setError(null);setMessage(null);
    try{
      const rows=await supabaseFetch<Patient[]>("/rest/v1/rpc/clinical_find_patient_by_identity",{method:"POST",body:JSON.stringify({p_organization_id:membership.organization_id,p_identity_value:identityQuery,p_country_code:"EG",p_identity_type:"national_id"})});
      setPatients(rows);
      if(rows.length===0)setMessage(t("No patient matched this exact identity.","لا يوجد مريض مطابق لهذه الهوية الدقيقة."));
    }catch(cause){setError(cause instanceof Error?cause.message:t("Exact identity matching is feature-gated until the secure identity service is enabled.","مطابقة الهوية الدقيقة مؤجلة حتى تفعيل خدمة الهوية الآمنة."));}
    finally{setSaving(false);}
  }

  async function createPatient(event:React.FormEvent){
    event.preventDefault();if(!membership)return;setSaving(true);setError(null);setMessage(null);setClaimCode(null);
    try{
      const rows=await supabaseFetch<Array<{patient_id:string;claim_code:string}>>("/rest/v1/rpc/clinical_create_patient",{method:"POST",body:JSON.stringify({p_organization_id:membership.organization_id,p_full_name:patientDraft.full_name,p_birthdate:patientDraft.birthdate||null,p_phone:patientDraft.phone||null,p_email:patientDraft.email||null,p_city:patientDraft.city||null,p_country_code:"EG",p_identity_type:"national_id",p_identity_value:patientDraft.identity_value||null,p_sex_at_birth:patientDraft.sex_at_birth,p_consent_basis:patientDraft.consent_basis})});
      const created=rows[0];if(!created)throw new Error("Patient creation returned no record.");
      setClaimCode(created.claim_code);setPatientDraft({full_name:"",birthdate:"",phone:"",email:"",city:"",identity_value:"",sex_at_birth:"not_recorded",consent_basis:"treatment"});
      setMessage(t("Invited patient profile created. Share the one-time claim code through an approved channel.","تم إنشاء ملف مريض مدعو. شارك رمز الربط لمرة واحدة عبر قناة معتمدة."));
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not create patient.","تعذر إنشاء المريض."));}
    finally{setSaving(false);}
  }

  async function openPatient(patient:Patient){
    setSelected(patient);setError(null);setMessage(null);setActiveEncounterId(null);
    try{setTimeline(await supabaseFetch<JourneyEvent[]>(`/rest/v1/clinical_patient_timeline_v1?select=*&patient_id=eq.${patient.patient_id}&order=occurred_at.desc&limit=100`));}
    catch(cause){setTimeline([]);setError(cause instanceof Error?cause.message:t("Patient access must be granted before the record can be opened.","يجب منح الوصول للمريض قبل فتح السجل."));}
  }

  async function createEncounter(event:React.FormEvent){
    event.preventDefault();if(!membership||!selected||!session?.user?.id)return;setSaving(true);setError(null);setMessage(null);
    try{
      const rows=await supabaseFetch<Array<{id:string}>>("/rest/v1/clinical_encounters?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({patient_id:selected.patient_id,organization_id:membership.organization_id,practitioner_user_id:session.user.id,encounter_type:encounterDraft.encounter_type,status:"in_progress",chief_complaint:encounterDraft.chief_complaint||null,clinical_summary:encounterDraft.clinical_summary||null,diagnosis_summary:encounterDraft.diagnosis_summary||null,care_plan:encounterDraft.care_plan||null})});
      setActiveEncounterId(rows[0]?.id||null);setMessage(t("Encounter started. Add prescription and service orders.","تم بدء الزيارة. أضف الوصفة وطلبات الخدمات."));await openPatient(selected);
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not start encounter.","تعذر بدء الزيارة."));}
    finally{setSaving(false);}
  }

  async function createPrescription(event:React.FormEvent){
    event.preventDefault();if(!membership||!selected||!session?.user?.id)return;setSaving(true);setError(null);setMessage(null);
    try{
      const prescriptions=await supabaseFetch<Array<{id:string}>>("/rest/v1/clinical_prescriptions?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({encounter_id:activeEncounterId,patient_id:selected.patient_id,organization_id:membership.organization_id,prescriber_user_id:session.user.id,status:"active",authored_at:new Date().toISOString(),clinical_indication:prescriptionDraft.indication||null,instructions:prescriptionDraft.instructions||null,insurance_required:prescriptionDraft.insurance_required})});
      const prescriptionId=prescriptions[0]?.id;if(!prescriptionId)throw new Error("Prescription creation failed.");
      await supabaseFetch("/rest/v1/clinical_prescription_items",{method:"POST",body:JSON.stringify({prescription_id:prescriptionId,patient_id:selected.patient_id,canonical_medicine_id:prescriptionDraft.canonical_medicine_id?Number(prescriptionDraft.canonical_medicine_id):null,medicine_name:prescriptionDraft.medicine_name,dose:prescriptionDraft.dose,frequency:prescriptionDraft.frequency,duration:prescriptionDraft.duration||null,quantity:prescriptionDraft.quantity?Number(prescriptionDraft.quantity):null,quantity_unit:prescriptionDraft.quantity_unit||null,route:prescriptionDraft.route||null,indication:prescriptionDraft.indication||null,instructions:prescriptionDraft.instructions||null})});
      setPrescriptionDraft({medicine_name:"",canonical_medicine_id:"",dose:"",frequency:"",duration:"",quantity:"",quantity_unit:"",route:"",indication:"",instructions:"",insurance_required:false});setMessage(t("Structured prescription created.","تم إنشاء وصفة منظمة."));await openPatient(selected);
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not create prescription.","تعذر إنشاء الوصفة."));}
    finally{setSaving(false);}
  }

  async function createOrder(event:React.FormEvent){
    event.preventDefault();if(!membership||!selected||!session?.user?.id)return;setSaving(true);setError(null);setMessage(null);
    try{
      await supabaseFetch("/rest/v1/clinical_service_orders",{method:"POST",body:JSON.stringify({encounter_id:activeEncounterId,patient_id:selected.patient_id,ordering_organization_id:membership.organization_id,ordering_practitioner_user_id:session.user.id,destination_organization_id:orderDraft.destination_organization_id||null,service_type:orderDraft.service_type,status:"active",priority:orderDraft.priority,service_name:orderDraft.service_name,clinical_question:orderDraft.clinical_question||null,instructions:orderDraft.instructions||null,insurance_required:orderDraft.insurance_required})});
      setOrderDraft({service_type:"laboratory",service_name:"",priority:"routine",clinical_question:"",instructions:"",destination_organization_id:"",insurance_required:false});setMessage(t("Service order routed into the patient journey.","تم توجيه طلب الخدمة داخل رحلة المريض."));await openPatient(selected);
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not create service order.","تعذر إنشاء طلب الخدمة."));}
    finally{setSaving(false);}
  }

  const org=membership?.organizations;
  const timelineGroups=useMemo(()=>timeline,[timeline]);
  if(!isAuthenticated)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>{t("Sign in through the staff portal.","سجل الدخول من بوابة الموظفين.")}</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><HeartPulse className="h-4 w-4"/>{t("Connected clinical journey workspace","مساحة رحلة الرعاية المترابطة")}</p><h1 className="mt-3 text-3xl font-bold">{t("From patient identity to encounter, orders, fulfillment, and follow-up","من هوية المريض إلى الزيارة والطلبات والتنفيذ والمتابعة")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{org?`${org.name} · ${membership?.role}`:t("Loading organization...","جاري تحميل المؤسسة...")}</p></div><Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3"/>{t("Private clinical workspace","مساحة سريرية خاصة")}</Badge></div></section>
    {error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><AlertDescription>{message}</AlertDescription></Alert>}

    <section className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/>{t("Find an accessible patient","ابحث عن مريض مصرح به")}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={nameQuery} onChange={event=>setNameQuery(event.target.value)} placeholder={t("Patient name","اسم المريض")} onKeyDown={event=>{if(event.key==="Enter")void searchAccessible();}}/><Button onClick={()=>void searchAccessible()} disabled={saving||!membership}>{t("Search","بحث")}</Button></div><div className="border-t pt-3"><Label>{t("Audited exact Egyptian national-ID match","مطابقة دقيقة ومسجلة للرقم القومي المصري")}</Label><div className="mt-1 flex gap-2"><Input inputMode="numeric" maxLength={14} value={identityQuery} onChange={event=>setIdentityQuery(event.target.value.replace(/\D/g,""))} placeholder="14 digits"/><Button variant="outline" onClick={()=>void searchIdentity()} disabled={saving||identityQuery.length!==14}><IdCard className="mr-2 h-4 w-4"/>{t("Exact match","مطابقة")}</Button></div><p className="mt-2 text-xs text-muted-foreground">{t("The raw identifier must never be stored. This option activates only after the secure identity service is approved.","يجب ألا يُخزن الرقم الخام. يتفعل هذا الخيار فقط بعد اعتماد خدمة الهوية الآمنة.")}</p></div><div className="space-y-2">{patients.map(patient=><button key={patient.patient_id} onClick={()=>void openPatient(patient)} className="w-full rounded-lg border p-3 text-left hover:border-primary"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold">{patient.full_name}</div><div className="text-xs text-muted-foreground">{[patient.birthdate,patient.city,patient.identity_last4?`•••• ${patient.identity_last4}`:null].filter(Boolean).join(" · ")}</div></div><Badge variant={patient.access_status==="granted"?"default":"secondary"}>{patient.access_status||patient.identity_verification_status||"accessible"}</Badge></div></button>)}</div></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5"/>{t("Create an invited patient","إنشاء مريض مدعو")}</CardTitle></CardHeader><CardContent><form onSubmit={createPatient} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label={t("Full name","الاسم بالكامل")} value={patientDraft.full_name} onChange={value=>setPatientDraft(current=>({...current,full_name:value}))}/><Field label={t("Birthdate","تاريخ الميلاد")} value={patientDraft.birthdate} type="date" onChange={value=>setPatientDraft(current=>({...current,birthdate:value}))}/><Field label={t("Phone","الهاتف")} value={patientDraft.phone} onChange={value=>setPatientDraft(current=>({...current,phone:value}))}/><Field label={t("City","المدينة")} value={patientDraft.city} onChange={value=>setPatientDraft(current=>({...current,city:value}))}/></div><div><Label>{t("National ID (feature-gated)","الرقم القومي (ميزة مؤجلة)")}</Label><Input className="mt-1" inputMode="numeric" maxLength={14} value={patientDraft.identity_value} onChange={event=>setPatientDraft(current=>({...current,identity_value:event.target.value.replace(/\D/g,""))})}/></div><div><Label>{t("Consent basis","أساس الموافقة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={patientDraft.consent_basis} onChange={event=>setPatientDraft(current=>({...current,consent_basis:event.target.value}))}><option value="patient_requested">Patient requested</option><option value="treatment">Treatment relationship</option><option value="emergency">Emergency</option><option value="legal_guardian">Legal guardian</option><option value="institutional_program">Institutional program</option></select></div><Button type="submit" disabled={saving||!membership||patientDraft.full_name.trim().length<2}>{t("Create profile and claim code","إنشاء الملف ورمز الربط")}</Button>{claimCode&&<Alert><AlertDescription><strong>{t("One-time claim code","رمز الربط لمرة واحدة")}:</strong> <span className="font-mono text-lg">{claimCode}</span></AlertDescription></Alert>}</form></CardContent></Card></div>

    <div>{!selected?<Card><CardContent className="p-10 text-center text-muted-foreground"><Stethoscope className="mx-auto mb-3 h-10 w-10"/>{t("Select an accessible patient to start the connected journey.","اختر مريضًا مصرحًا به لبدء الرحلة المترابطة.")}</CardContent></Card>:<div className="space-y-6"><Card><CardHeader><CardTitle>{selected.full_name}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><Metric label={t("Birthdate","تاريخ الميلاد")} value={selected.birthdate||"—"}/><Metric label={t("Access","الوصول")} value={selected.access_status||"granted"}/><Metric label={t("Active encounter","الزيارة الحالية")} value={activeEncounterId?activeEncounterId.slice(0,8):t("Not started","لم تبدأ")}/></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardPlus className="h-5 w-5"/>{t("Start encounter","بدء زيارة")}</CardTitle></CardHeader><CardContent><form onSubmit={createEncounter} className="space-y-3"><div className="grid gap-3 md:grid-cols-2"><Field label={t("Chief complaint","الشكوى الرئيسية")} value={encounterDraft.chief_complaint} onChange={value=>setEncounterDraft(current=>({...current,chief_complaint:value}))}/><div><Label>{t("Encounter type","نوع الزيارة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={encounterDraft.encounter_type} onChange={event=>setEncounterDraft(current=>({...current,encounter_type:event.target.value}))}><option value="outpatient">Outpatient</option><option value="telehealth">Telehealth</option><option value="emergency">Emergency</option><option value="inpatient">Inpatient</option><option value="home_visit">Home visit</option></select></div></div><Textarea value={encounterDraft.clinical_summary} onChange={event=>setEncounterDraft(current=>({...current,clinical_summary:event.target.value}))} placeholder={t("Clinical summary","الملخص السريري")}/><Textarea value={encounterDraft.diagnosis_summary} onChange={event=>setEncounterDraft(current=>({...current,diagnosis_summary:event.target.value}))} placeholder={t("Diagnosis summary","ملخص التشخيص")}/><Button type="submit" disabled={saving||!encounterDraft.chief_complaint.trim()}>{t("Start encounter","بدء الزيارة")}</Button></form></CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5"/>{t("Structured prescription","وصفة منظمة")}</CardTitle></CardHeader><CardContent><form onSubmit={createPrescription} className="space-y-3"><Field label={t("Medicine name","اسم الدواء")} value={prescriptionDraft.medicine_name} onChange={value=>setPrescriptionDraft(current=>({...current,medicine_name:value}))}/><div className="grid gap-3 sm:grid-cols-2"><Field label={t("Dose","الجرعة")} value={prescriptionDraft.dose} onChange={value=>setPrescriptionDraft(current=>({...current,dose:value}))}/><Field label={t("Frequency","التكرار")} value={prescriptionDraft.frequency} onChange={value=>setPrescriptionDraft(current=>({...current,frequency:value}))}/><Field label={t("Duration","المدة")} value={prescriptionDraft.duration} onChange={value=>setPrescriptionDraft(current=>({...current,duration:value}))}/><Field label={t("Route","طريقة الاستخدام")} value={prescriptionDraft.route} onChange={value=>setPrescriptionDraft(current=>({...current,route:value}))}/></div><Textarea value={prescriptionDraft.instructions} onChange={event=>setPrescriptionDraft(current=>({...current,instructions:event.target.value}))} placeholder={t("Patient instructions","تعليمات المريض")}/><Button type="submit" disabled={saving||!prescriptionDraft.medicine_name||!prescriptionDraft.dose||!prescriptionDraft.frequency}>{t("Add prescription","إضافة الوصفة")}</Button></form></CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2">{orderDraft.service_type==="radiology"?<Image className="h-5 w-5"/>:<FlaskConical className="h-5 w-5"/>}{t("Diagnostic or service order","طلب فحص أو خدمة")}</CardTitle></CardHeader><CardContent><form onSubmit={createOrder} className="space-y-3"><div><Label>{t("Service type","نوع الخدمة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={orderDraft.service_type} onChange={event=>setOrderDraft(current=>({...current,service_type:event.target.value}))}><option value="laboratory">Laboratory</option><option value="radiology">Radiology</option><option value="consultation">Consultation</option><option value="procedure">Procedure</option><option value="pharmacy">Pharmacy</option></select></div><Field label={t("Service name","اسم الخدمة")} value={orderDraft.service_name} onChange={value=>setOrderDraft(current=>({...current,service_name:value}))}/><Textarea value={orderDraft.clinical_question} onChange={event=>setOrderDraft(current=>({...current,clinical_question:event.target.value}))} placeholder={t("Clinical question","السؤال السريري")}/><Button type="submit" disabled={saving||!orderDraft.service_name.trim()}>{t("Route service order","توجيه طلب الخدمة")}</Button></form></CardContent></Card></div>

    <Card><CardHeader><CardTitle>{t("Patient journey timeline","الخط الزمني لرحلة المريض")}</CardTitle></CardHeader><CardContent className="space-y-3">{timelineGroups.length===0?<p className="text-sm text-muted-foreground">{t("No clinical events yet.","لا توجد أحداث سريرية بعد.")}</p>:timelineGroups.map(event=><div key={event.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{event.title}</div><p className="mt-1 text-sm text-muted-foreground">{event.summary||event.resource_type}</p></div><Badge variant="outline">{event.status||event.event_type}</Badge></div><div className="mt-2 text-xs text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</div></div>)}</CardContent></Card></div>}</div></section>

    <Alert className="mt-8"><AlertDescription>{t("This workspace is a controlled clinical foundation. It must not be represented as a certified or flawless EMR/EHR until the security, privacy, clinical-governance, interoperability, recovery, and regulatory release gates are complete.","هذه المساحة أساس سريري منضبط، ولا يجوز تقديمها كنظام سجلات طبية معتمد أو خالٍ من العيوب قبل استكمال بوابات الأمن والخصوصية والحوكمة والتوافق والتعافي والمتطلبات التنظيمية.")}</AlertDescription></Alert>
  </main>;
}

function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={event=>onChange(event.target.value)} required={label.toLowerCase().includes("full")}/></div>;}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold break-all">{value}</div></div>;}
