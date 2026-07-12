import { type FormEvent, useState } from "react";
import { ExternalLink, Linkedin, Mail, MessageCircle, Send, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialForm={contact_name:"",email:"",phone:"",organization_name:"",organization_type:"ngo",lead_type:"partnership",country:"",beneficiaries_estimate:"",message:""};
const LEAD_TYPES=["demo","partnership","pilot","institutional","marketplace","data_contribution","support","other"];
const ORGANIZATION_TYPES=["ngo","foundation","pharma","hospital","government","donor","pharmacy","supplier","laboratory","radiology_center","insurance_company","other"];

export function FloatingFounderContact(){
  const[open,setOpen]=useState(false);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState(initialForm);
  const[saving,setSaving]=useState(false);
  const[message,setMessage]=useState<string|null>(null);
  const[error,setError]=useState<string|null>(null);

  async function submitLead(event:FormEvent){
    event.preventDefault();
    if(!form.contact_name.trim()||!form.email.trim())return;
    setSaving(true);setMessage(null);setError(null);
    try{
      const url=import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/,'');
      const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if(!url||!key)throw new Error("Contact form is temporarily unavailable.");
      const response=await fetch(`${url}/rest/v1/partnership_leads`,{
        method:"POST",
        headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=minimal"},
        body:JSON.stringify({
          contact_name:form.contact_name.trim(),email:form.email.trim(),phone:form.phone.trim()||null,
          organization_name:form.organization_name.trim()||null,organization_type:form.organization_type||null,
          lead_type:form.lead_type,priority:"normal",country:form.country.trim()||null,
          beneficiaries_estimate:form.beneficiaries_estimate?Number(form.beneficiaries_estimate):null,
          message:form.message.trim()||null,source_path:window.location.pathname,
        }),
      });
      if(!response.ok)throw new Error("Could not send your request. Please contact Mina directly.");
      setForm(initialForm);setMessage("Thank you. Your request is in the founder CRM and Mina will follow up.");setShowForm(false);
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not send your request.");}
    finally{setSaving(false);}
  }

  return <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 font-sans">
    {open&&<div className="w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
      <div className="bg-[#0B1F33] p-5 text-white"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-sky-300"><UserRound className="h-4 w-4"/>Talk to the Founder</div><div className="mt-2 text-lg font-bold">Mina Samy Tawfik Saad</div><div className="mt-1 text-sm text-slate-300">Healthcare partnerships • Product data • Pilots • Collaboration</div></div><button aria-label="Close contact card" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" onClick={()=>setOpen(false)}><X className="h-4 w-4"/></button></div></div>
      <div className="space-y-3 p-4">
        <ContactLink href="https://wa.me/201284590503" label="WhatsApp Mina" detail="+20 128 459 0503" icon={MessageCircle}/>
        <ContactLink href="https://www.linkedin.com/in/jesussavedmina/" label="Mina on LinkedIn" detail="linkedin.com/in/jesussavedmina" icon={Linkedin}/>
        <ContactLink href="https://www.linkedin.com/company/medicine-support-hub/" label="Medicine Support Hub on LinkedIn" detail="Follow platform updates" icon={Linkedin}/>
        <ContactLink href="mailto:jesussavedmina@gmail.com" label="Email Mina" detail="jesussavedmina@gmail.com" icon={Mail}/>
        <ContactLink href="https://minasami.github.io/" label="Professional website" detail="minasami.github.io" icon={ExternalLink}/>
        {!showForm?<Button className="w-full bg-[#0EA5E9] hover:bg-sky-600" onClick={()=>{setShowForm(true);setMessage(null);setError(null);}}><MessageCircle className="mr-2 h-4 w-4"/>Request a demo or partnership call</Button>:<form onSubmit={submitLead} className="space-y-3 rounded-xl bg-[#F5F9FC] p-4">
          <div><Label>Request type</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.lead_type} onChange={event=>setForm({...form,lead_type:event.target.value})}>{LEAD_TYPES.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></div>
          <div><Label>Name</Label><Input value={form.contact_name} onChange={event=>setForm({...form,contact_name:event.target.value})} required/></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} required/></div>
          <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/></div>
          <div><Label>Organization</Label><Input value={form.organization_name} onChange={event=>setForm({...form,organization_name:event.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Organization type</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.organization_type} onChange={event=>setForm({...form,organization_type:event.target.value})}>{ORGANIZATION_TYPES.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></div><div><Label>Country</Label><Input value={form.country} onChange={event=>setForm({...form,country:event.target.value})}/></div></div>
          <div><Label>Estimated beneficiaries</Label><Input type="number" min="0" value={form.beneficiaries_estimate} onChange={event=>setForm({...form,beneficiaries_estimate:event.target.value})}/></div>
          <div><Label>Message</Label><Textarea value={form.message} onChange={event=>setForm({...form,message:event.target.value})} placeholder="Tell Mina about the need, organization, product, data, or pilot."/></div>
          {error&&<p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={()=>setShowForm(false)}>Cancel</Button><Button type="submit" className="flex-1 bg-[#10B981] hover:bg-emerald-600" disabled={saving||!form.contact_name.trim()||!form.email.trim()}><Send className="mr-2 h-4 w-4"/>{saving?"Sending…":"Send"}</Button></div>
        </form>}
        {message&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      </div>
    </div>}
    <button onClick={()=>setOpen(!open)} className="flex items-center gap-2 rounded-full bg-[#0B1F33] px-4 py-3 font-semibold text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800" aria-expanded={open} aria-label="Contact Mina Samy Tawfik Saad"><MessageCircle className="h-5 w-5 text-[#10B981]"/><span className="hidden sm:inline">Talk to the Founder</span></button>
  </div>;
}

function ContactLink({href,label,detail,icon:Icon}:{href:string;label:string;detail:string;icon:typeof Mail}){
  const external=href.startsWith("http");
  return <a href={href} target={external?"_blank":undefined} rel={external?"noreferrer":undefined} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50"><Icon className="h-4 w-4 text-[#0EA5E9]"/></span><span><span className="block text-sm font-semibold text-[#0B1F33]">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span></span><ExternalLink className="h-4 w-4 text-slate-400"/></a>;
}
