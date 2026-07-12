import { Component, type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, Check, RefreshCw, ShieldCheck, Store, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile={id:string;role:string;is_active:boolean};
type Application={id:string;business_name:string;seller_type:string;country:string|null;city:string|null;work_email:string;contact_phone:string|null;website_url:string|null;license_number:string;license_authority:string|null;license_expiry:string|null;evidence_urls:unknown;service_areas:unknown;advantages:unknown;notes:string|null;status:string;submitted_by:string;created_at:string};
type Offer={id:string;canonical_id:number;seller_profile_id:string;organization_id:string;seller_sku:string|null;offer_title:string|null;unit_price_egp:number;list_price_egp:number|null;minimum_order_quantity:number;packaging:string|null;stock_status:string;lead_time_days:number|null;minimum_expiry_months:number|null;delivery_scope:unknown;advantages:unknown;payment_terms:unknown;cold_chain_supported:boolean;prescription_handling?:string|null;status:string;submitted_by:string;created_at:string};
type Seller={id:string;display_name:string;seller_slug:string;seller_type:string;license_number:string;verification_status:string};
type Medicine={canonical_id:number;name_en:string|null;name_ar:string|null;manufacturer:string|null;current_price_egp:number|null};

const ADMIN_ROLES=new Set(["admin","platform_admin","super_admin"]);
const arrayOf=<T,>(value:unknown):T[]=>Array.isArray(value)?value:[];
const strings=(value:unknown)=>arrayOf<unknown>(value).map(item=>String(item||"").trim()).filter(Boolean);
const humanize=(value:unknown)=>String(value||"unknown").replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

class MarketplaceBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:unknown){console.error("admin-marketplace-render",error);}
  render(){if(this.state.failed)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Marketplace moderation could not render safely. Refresh the page or return to the platform control center.</AlertDescription></Alert><div className="mt-4 flex gap-2"><Button asChild><Link href="/admin/control-center">Control center</Link></Button><Button asChild variant="outline"><Link href="/marketplace">Public marketplace</Link></Button></div></main>;return this.props.children;}
}

export default function AdminMarketplace(){return <MarketplaceBoundary><AdminMarketplaceContent/></MarketplaceBoundary>;}

function AdminMarketplaceContent(){
  const{session,supabaseFetch}=usePatientAuth();
  const[me,setMe]=useState<Profile|null>(null);
  const[applications,setApplications]=useState<Application[]>([]);
  const[offers,setOffers]=useState<Offer[]>([]);
  const[sellers,setSellers]=useState<Record<string,Seller>>({});
  const[medicines,setMedicines]=useState<Record<number,Medicine>>({});
  const[notes,setNotes]=useState<Record<string,string>>({});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState<string|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[warning,setWarning]=useState<string|null>(null);
  const[message,setMessage]=useState<string|null>(null);
  const isAdmin=Boolean(me?.is_active&&ADMIN_ROLES.has(me.role));
  const pendingApplications=useMemo(()=>applications.filter(row=>["pending","under_review"].includes(String(row.status))),[applications]);
  const pendingOffers=useMemo(()=>offers.filter(row=>["submitted","under_review"].includes(String(row.status))),[offers]);

  async function load(){
    setLoading(true);setError(null);setWarning(null);
    try{
      const userId=session?.user?.id;
      if(!userId){setMe(null);setApplications([]);setOffers([]);setSellers({});setMedicines({});return;}
      const ownResult=await supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active&id=eq.${encodeURIComponent(userId)}&limit=1`);
      const profile=arrayOf<Profile>(ownResult)[0]||null;setMe(profile);
      if(!profile?.is_active||!ADMIN_ROLES.has(profile.role)){setApplications([]);setOffers([]);setSellers({});setMedicines({});return;}

      const results=await Promise.allSettled([
        supabaseFetch<Application[]>("/rest/v1/marketplace_seller_applications?select=*&order=created_at.asc&limit=300"),
        supabaseFetch<Offer[]>("/rest/v1/marketplace_medicine_offers?select=*&order=created_at.asc&limit=500"),
        supabaseFetch<Seller[]>("/rest/v1/marketplace_seller_profiles?select=id,display_name,seller_slug,seller_type,license_number,verification_status&limit=300"),
      ]);
      const nextApplications=results[0].status==="fulfilled"?arrayOf<Application>(results[0].value):[];
      const nextOffers=results[1].status==="fulfilled"?arrayOf<Offer>(results[1].value):[];
      const nextSellers=results[2].status==="fulfilled"?arrayOf<Seller>(results[2].value):[];
      setApplications(nextApplications);setOffers(nextOffers);setSellers(Object.fromEntries(nextSellers.filter(row=>row?.id).map(row=>[row.id,row])));
      const failed=results.filter(result=>result.status==="rejected") as PromiseRejectedResult[];
      if(failed.length)setWarning(failed.map(result=>result.reason instanceof Error?result.reason.message:String(result.reason||"Marketplace queue unavailable")).join(" · "));

      const ids=[...new Set(nextOffers.map(row=>Number(row.canonical_id)).filter(Number.isFinite))];
      if(!ids.length){setMedicines({});return;}
      try{
        const rows=await supabaseFetch<Medicine[]>(`/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,manufacturer,current_price_egp&canonical_id=in.(${ids.join(",")})`);
        setMedicines(Object.fromEntries(arrayOf<Medicine>(rows).filter(row=>Number.isFinite(Number(row.canonical_id))).map(row=>[Number(row.canonical_id),row])));
      }catch(cause){setMedicines({});setWarning(current=>[current,cause instanceof Error?`Product labels unavailable: ${cause.message}`:"Product labels unavailable."].filter(Boolean).join(" · "));}
    }catch(cause){setApplications([]);setOffers([]);setSellers({});setMedicines({});setError(cause instanceof Error?cause.message:"Could not load marketplace moderation.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[session?.user?.id]);

  async function review(id:string,path:string,body:Record<string,unknown>,success:string){setSaving(id);setError(null);setMessage(null);try{await supabaseFetch(path,{method:"POST",body:JSON.stringify(body)});setMessage(success);await load();}catch(cause){setError(cause instanceof Error?cause.message:"Could not complete the review.");}finally{setSaving(null);}}
  const reviewApplication=(row:Application,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_seller_application",{target_application:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`${row.business_name} application ${decision}.`);
  const reviewOffer=(row:Offer,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_medicine_offer",{target_offer:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`Offer ${decision}.`);

  if(!session?.access_token)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert><ShieldCheck className="h-4 w-4"/><AlertDescription>Sign in through the staff portal before opening marketplace moderation.</AlertDescription></Alert><Button asChild className="mt-4"><Link href="/portal">Open staff portal</Link></Button></main>;
  if(!loading&&!isAdmin)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Your account is not authorized to review marketplace sellers or offers. Marketplace moderation remains limited to active platform administrators.</AlertDescription></Alert><div className="mt-4 flex gap-2"><Button asChild><Link href="/marketplace">Public marketplace</Link></Button><Button asChild variant="outline"><Link href="/admin/control-center">Control center</Link></Button></div></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8"><section className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Marketplace trust operations</p><h1 className="mt-3 text-3xl font-bold">Seller licensing and medicine-offer review</h1><p className="mt-3 max-w-3xl text-muted-foreground">Verify pharmacy, warehouse, and distributor identity before publishing shops. Review each medicine offer against its canonical product, commercial terms, and evidence boundaries.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div></section>
    {loading&&<div className="mt-5 space-y-3"><Skeleton className="h-20 w-full"/><Skeleton className="h-56 w-full"/></div>}{error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{warning&&<Alert className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{warning}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><Check className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {!loading&&isAdmin&&<><section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Pending seller applications" value={pendingApplications.length}/><Metric label="Pending medicine offers" value={pendingOffers.length}/><Metric label="All seller applications" value={applications.length}/><Metric label="All offers" value={offers.length}/></section>
      <Queue title="Seller license applications" empty="No seller applications need review.">{pendingApplications.map(row=><Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.business_name||"Unnamed applicant"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(row.seller_type)} · {[row.city,row.country].filter(Boolean).join(", ")||"Location not provided"}</p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label="Work email" value={row.work_email}/><Info label="License number" value={row.license_number}/><Info label="License authority" value={row.license_authority}/><Info label="License expiry" value={row.license_expiry}/><Info label="Service areas" value={strings(row.service_areas).join(", ")}/><Info label="Advantages" value={strings(row.advantages).join(", ")}/></div><Evidence urls={strings(row.evidence_urls)}/><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewApplication(row,"approved")} reject={()=>void reviewApplication(row,"rejected")}/></CardContent></Card>)}</Queue>
      <Queue title="Medicine offers" empty="No medicine offers need review.">{pendingOffers.map(row=>{const canonicalId=Number(row.canonical_id);const medicine=medicines[canonicalId];const seller=sellers[row.seller_profile_id];return <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.offer_title||medicine?.name_en||medicine?.name_ar||`Product ${canonicalId}`}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{seller?.display_name||"Seller profile unavailable"} · <a className="font-semibold text-primary" href={`/catalog/${canonicalId}`}>#{canonicalId}</a></p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label="Offer price" value={money(row.unit_price_egp)}/><Info label="Encyclopedia evidence price" value={medicine?.current_price_egp!=null?money(medicine.current_price_egp):null}/><Info label="Minimum order" value={`${safeNumber(row.minimum_order_quantity)} ${row.packaging||"units"}`}/><Info label="Stock statement" value={humanize(row.stock_status)}/><Info label="Delivery scope" value={strings(row.delivery_scope).join(", ")}/><Info label="Advantages" value={strings(row.advantages).join(", ")}/><Info label="Payment terms" value={strings(row.payment_terms).join(", ")}/><Info label="Prescription handling" value={humanize(row.prescription_handling)}/></div><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewOffer(row,"approved")} reject={()=>void reviewOffer(row,"rejected")}/></CardContent></Card>;})}</Queue>
      <Alert className="mt-8"><AlertDescription>Approval publishes a seller profile or offer for B2B discovery. It does not certify a product batch, guarantee inventory, validate a prescription, establish regulatory approval, or create a commercial contract.</AlertDescription></Alert>
    </>}
  </main>;
}

function Queue({title,empty,children}:{title:string;empty:string;children:ReactNode}){const items=arrayOf<ReactNode>(children);const has=items.length>0||(!Array.isArray(children)&&Boolean(children));return <section className="mt-10"><div className="flex items-center gap-2"><Store className="h-5 w-5"/><h2 className="text-2xl font-semibold">{title}</h2></div><div className="mt-4 grid gap-4 xl:grid-cols-2">{has?children:<Card><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>}</div></section>;}
function ReviewControls({id,notes,setNotes,saving,approve,reject}:{id:string;notes:Record<string,string>;setNotes:Dispatch<SetStateAction<Record<string,string>>>;saving:string|null;approve:()=>void;reject:()=>void}){return <><div><Label>Review notes</Label><Textarea className="mt-1" value={notes[id]||""} onChange={event=>setNotes(current=>({...current,[id]:event.target.value}))} placeholder="Document license, identity, product, commercial, and evidence checks."/></div><div className="flex flex-wrap gap-2"><Button onClick={approve} disabled={saving===id}><Check className="mr-2 h-4 w-4"/>Approve and publish</Button><Button variant="destructive" onClick={reject} disabled={saving===id}><X className="mr-2 h-4 w-4"/>Reject</Button></div></>;}
function Evidence({urls}:{urls:string[]}){return urls.length?<div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</div><div className="mt-2 flex flex-col gap-1">{urls.map((url,index)=><a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-primary">{url}</a>)}</div></div>:null;}
function Metric({label,value}:{label:string;value:number}){return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>;}
function Info({label,value}:{label:string;value:string|null|undefined}){return <div><div className="text-xs text-muted-foreground">{label}</div><div className="break-words font-medium">{value||"—"}</div></div>;}
function money(value:unknown){const number=Number(value);return Number.isFinite(number)?`${number.toLocaleString()} EGP`:"—";}
function safeNumber(value:unknown){const number=Number(value);return Number.isFinite(number)?number.toLocaleString():"—";}
