import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, RefreshCw, ShieldCheck, Store, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile={id:string;role:string;is_active:boolean};
type Application={id:string;business_name:string;seller_type:string;country:string|null;city:string|null;work_email:string;contact_phone:string|null;website_url:string|null;license_number:string;license_authority:string|null;license_expiry:string|null;evidence_urls:string[];service_areas:string[];advantages:string[];notes:string|null;status:string;submitted_by:string;created_at:string};
type Offer={id:string;canonical_id:number;seller_profile_id:string;organization_id:string;seller_sku:string|null;offer_title:string|null;unit_price_egp:number;list_price_egp:number|null;minimum_order_quantity:number;packaging:string|null;stock_status:string;lead_time_days:number|null;minimum_expiry_months:number|null;delivery_scope:string[];advantages:string[];payment_terms:string[];cold_chain_supported:boolean;status:string;submitted_by:string;created_at:string};
type Seller={id:string;display_name:string;seller_slug:string;seller_type:string;license_number:string;verification_status:string};
type Medicine={canonical_id:number;name_en:string|null;name_ar:string|null;manufacturer:string|null;current_price_egp:number|null};
const humanize=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default function AdminMarketplace(){
  const {session,supabaseFetch}=usePatientAuth();
  const [me,setMe]=useState<Profile|null>(null);
  const [applications,setApplications]=useState<Application[]>([]);
  const [offers,setOffers]=useState<Offer[]>([]);
  const [sellers,setSellers]=useState<Record<string,Seller>>({});
  const [medicines,setMedicines]=useState<Record<number,Medicine>>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const isAdmin=me?.is_active&&["admin","platform_admin","super_admin"].includes(me.role);
  const pendingApplications=useMemo(()=>applications.filter(row=>["pending","under_review"].includes(row.status)),[applications]);
  const pendingOffers=useMemo(()=>offers.filter(row=>["submitted","under_review"].includes(row.status)),[offers]);

  async function load(){setLoading(true);setError(null);try{
    if(!session?.user?.id)throw new Error("Sign in through the staff portal before opening marketplace moderation.");
    const own=await supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`);const profile=own[0]||null;setMe(profile);
    if(!profile?.is_active||!["admin","platform_admin","super_admin"].includes(profile.role))throw new Error("Your account is not authorized to review marketplace records.");
    const [nextApplications,nextOffers,nextSellers]=await Promise.all([
      supabaseFetch<Application[]>("/rest/v1/marketplace_seller_applications?select=*&order=created_at.asc&limit=300"),
      supabaseFetch<Offer[]>("/rest/v1/marketplace_medicine_offers?select=*&order=created_at.asc&limit=500"),
      supabaseFetch<Seller[]>("/rest/v1/marketplace_seller_profiles?select=id,display_name,seller_slug,seller_type,license_number,verification_status&limit=300"),
    ]);
    setApplications(nextApplications);setOffers(nextOffers);setSellers(Object.fromEntries(nextSellers.map(row=>[row.id,row])));
    const ids=[...new Set(nextOffers.map(row=>row.canonical_id))];
    if(ids.length){const rows=await supabaseFetch<Medicine[]>(`/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,manufacturer,current_price_egp&canonical_id=in.(${ids.join(",")})`);setMedicines(Object.fromEntries(rows.map(row=>[row.canonical_id,row])));}else setMedicines({});
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load marketplace moderation.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[session?.user?.id]);

  async function review(id:string,path:string,body:Record<string,unknown>,success:string){setSaving(id);setError(null);setMessage(null);try{await supabaseFetch(path,{method:"POST",body:JSON.stringify(body)});setMessage(success);await load();}catch(cause){setError(cause instanceof Error?cause.message:"Could not complete the review.");}finally{setSaving(null);}}
  const reviewApplication=(row:Application,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_seller_application",{target_application:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`${row.business_name} application ${decision}.`);
  const reviewOffer=(row:Offer,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_medicine_offer",{target_offer:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`Offer ${decision}.`);

  if(!session?.access_token)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Sign in through the staff portal before opening this page.</AlertDescription></Alert><a href="/portal" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open staff portal</a></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8"><section className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Marketplace trust operations</p><h1 className="mt-3 text-3xl font-bold">Seller licensing and medicine-offer review</h1><p className="mt-3 max-w-3xl text-muted-foreground">Verify pharmacy, warehouse, and distributor identity before publishing shops. Review each medicine offer against its canonical product, commercial terms, and evidence boundaries.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div></section>
    {loading&&<p className="mt-5 text-sm text-muted-foreground">Loading marketplace queues...</p>}{error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><Check className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {!loading&&isAdmin&&<><section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Pending seller applications" value={pendingApplications.length}/><Metric label="Pending medicine offers" value={pendingOffers.length}/><Metric label="All seller applications" value={applications.length}/><Metric label="All offers" value={offers.length}/></section>
      <Queue title="Seller license applications" empty="No seller applications need review.">{pendingApplications.map(row=><Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.business_name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(row.seller_type)} · {[row.city,row.country].filter(Boolean).join(", ")}</p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label="Work email" value={row.work_email}/><Info label="License number" value={row.license_number}/><Info label="License authority" value={row.license_authority}/><Info label="License expiry" value={row.license_expiry}/><Info label="Service areas" value={row.service_areas.join(", ")}/><Info label="Advantages" value={row.advantages.join(", ")}/></div><Evidence urls={row.evidence_urls}/><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewApplication(row,"approved")} reject={()=>void reviewApplication(row,"rejected")}/></CardContent></Card>)}</Queue>
      <Queue title="Medicine offers" empty="No medicine offers need review.">{pendingOffers.map(row=>{const medicine=medicines[row.canonical_id];const seller=sellers[row.seller_profile_id];return <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.offer_title||medicine?.name_en||medicine?.name_ar||`Product ${row.canonical_id}`}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{seller?.display_name||row.seller_profile_id} · <a className="font-semibold text-primary" href={`/catalog/${row.canonical_id}`}>#{row.canonical_id}</a></p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label="Offer price" value={`${Number(row.unit_price_egp).toLocaleString()} EGP`}/><Info label="Encyclopedia evidence price" value={medicine?.current_price_egp!=null?`${Number(medicine.current_price_egp).toLocaleString()} EGP`:null}/><Info label="Minimum order" value={`${Number(row.minimum_order_quantity).toLocaleString()} ${row.packaging||"units"}`}/><Info label="Stock statement" value={humanize(row.stock_status)}/><Info label="Delivery scope" value={row.delivery_scope.join(", ")}/><Info label="Advantages" value={row.advantages.join(", ")}/></div><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewOffer(row,"approved")} reject={()=>void reviewOffer(row,"rejected")}/></CardContent></Card>;})}</Queue>
      <Alert className="mt-8"><AlertDescription>Approval publishes a seller profile or offer for B2B discovery. It does not certify a product batch, guarantee inventory, validate a prescription, establish regulatory approval, or create a commercial contract.</AlertDescription></Alert>
    </>}
  </main>;
}

function Queue({title,empty,children}:{title:string;empty:string;children:React.ReactNode}){const has=Array.isArray(children)?children.length>0:Boolean(children);return <section className="mt-10"><div className="flex items-center gap-2"><Store className="h-5 w-5"/><h2 className="text-2xl font-semibold">{title}</h2></div><div className="mt-4 grid gap-4 xl:grid-cols-2">{has?children:<Card><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>}</div></section>;}
function ReviewControls({id,notes,setNotes,saving,approve,reject}:{id:string;notes:Record<string,string>;setNotes:React.Dispatch<React.SetStateAction<Record<string,string>>>;saving:string|null;approve:()=>void;reject:()=>void}){return <><div><Label>Review notes</Label><Textarea className="mt-1" value={notes[id]||""} onChange={event=>setNotes(current=>({...current,[id]:event.target.value}))} placeholder="Document license, identity, product, commercial, and evidence checks."/></div><div className="flex gap-2"><Button onClick={approve} disabled={saving===id}><Check className="mr-2 h-4 w-4"/>Approve and publish</Button><Button variant="destructive" onClick={reject} disabled={saving===id}><X className="mr-2 h-4 w-4"/>Reject</Button></div></>;}
function Evidence({urls}:{urls:string[]}){return urls.length?<div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</div><div className="mt-2 flex flex-col gap-1">{urls.map(url=><a key={url} href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-primary">{url}</a>)}</div></div>:null;}
function Metric({label,value}:{label:string;value:number}){return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>;}
function Info({label,value}:{label:string;value:string|null|undefined}){return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value||"—"}</div></div>;}
