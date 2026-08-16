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
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
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
    }catch(cause){setApplications([]);setOffers([]);setSellers({});setMedicines({});setError(cause instanceof Error?cause.message:t("Could not load marketplace moderation.", "تعذّر تحميل إشراف السوق."));}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[session?.user?.id]);

  async function review(id:string,path:string,body:Record<string,unknown>,success:string){setSaving(id);setError(null);setMessage(null);try{await supabaseFetch(path,{method:"POST",body:JSON.stringify(body)});setMessage(success);await load();}catch(cause){setError(cause instanceof Error?cause.message:t("Could not complete the review.", "تعذّر إكمال المراجعة."));}finally{setSaving(null);}}
  const reviewApplication=(row:Application,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_seller_application",{target_application:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`${row.business_name} application ${decision}.`);
  const reviewOffer=(row:Offer,decision:"approved"|"rejected")=>review(row.id,"/rest/v1/rpc/review_marketplace_medicine_offer",{target_offer:row.id,decision,reviewer_notes:notes[row.id]?.trim()||null},`Offer ${decision}.`);

  if(!session?.access_token)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert><ShieldCheck className="h-4 w-4"/><AlertDescription>{t("Sign in through the staff portal before opening marketplace moderation.", "سجّل الدخول عبر بوابة الموظفين قبل فتح إشراف السوق.")}</AlertDescription></Alert><Button asChild className="mt-4"><Link href="/portal">{t("Open staff portal", "فتح بوابة الموظفين")}</Link></Button></main>;
  if(!loading&&!isAdmin)return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>{t("Your account is not authorized to review marketplace sellers or offers. Marketplace moderation remains limited to active platform administrators.", "حسابك غير مخوّل بمراجعة بائعي السوق أو العروض. إشراف السوق يقتصر على مشرفي المنصة النشطين.")}</AlertDescription></Alert><div className="mt-4 flex gap-2"><Button asChild><Link href="/marketplace">{t("Public marketplace", "السوق العام")}</Link></Button><Button asChild variant="outline"><Link href="/admin/control-center">{t("Control center", "مركز التحكم")}</Link></Button></div></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8"><section className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-4 w-4"/>{t("Marketplace trust operations", "عمليات ثقة السوق")}</p><h1 className="mt-3 text-3xl font-bold">{t("Seller licensing and medicine-offer review", "ترخيص البائعين ومراجعة عروض الأدوية")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("Verify pharmacy, warehouse, and distributor identity before publishing shops. Review each medicine offer against its canonical product, commercial terms, and evidence boundaries.", "تحقق من هوية الصيدليات والمستودعات والموزعين قبل نشر المتاجر. راجع كل عرض دواء مقابل المنتج الموحد والشروط التجارية وحدود الأدلة.")}</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>{t("Refresh", "تحديث")}</Button></div></section>
    {loading&&<div className="mt-5 space-y-3"><Skeleton className="h-20 w-full"/><Skeleton className="h-56 w-full"/></div>}{error&&<Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}{warning&&<Alert className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{warning}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><Check className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {!loading&&isAdmin&&<><section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("Pending seller applications", "طلبات البائعين المعلّقة")} value={pendingApplications.length}/><Metric label={t("Pending medicine offers", "عروض الأدوية المعلّقة")} value={pendingOffers.length}/><Metric label={t("All seller applications", "كل طلبات البائعين")} value={applications.length}/><Metric label={t("All offers", "كل العروض")} value={offers.length}/></section>
      <Queue title={t("Seller license applications", "طلبات ترخيص البائعين")} empty={t("No seller applications need review.", "لا توجد طلبات بائعين تحتاج مراجعة.")}>{pendingApplications.map(row=><Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.business_name||t("Unnamed applicant", "مقدّم بدون اسم")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(row.seller_type)} · {[row.city,row.country].filter(Boolean).join(", ")||t("Location not provided", "الموقع غير محدد")}</p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label={t("Work email", "البريد المهني")} value={row.work_email}/><Info label={t("License number", "رقم الترخيص")} value={row.license_number}/><Info label={t("License authority", "جهة الترخيص")} value={row.license_authority}/><Info label={t("License expiry", "انتهاء الترخيص")} value={row.license_expiry}/><Info label={t("Service areas", "مناطق الخدمة")} value={strings(row.service_areas).join(", ")}/><Info label={t("Advantages", "المزايا")} value={strings(row.advantages).join(", ")}/></div><Evidence urls={strings(row.evidence_urls)}/><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewApplication(row,"approved")} reject={()=>void reviewApplication(row,"rejected")}/></CardContent></Card>)}</Queue>
      <Queue title={t("Medicine offers", "عروض الأدوية")} empty={t("No medicine offers need review.", "لا توجد عروض أدوية تحتاج مراجعة.")}>{pendingOffers.map(row=>{const canonicalId=Number(row.canonical_id);const medicine=medicines[canonicalId];const seller=sellers[row.seller_profile_id];return <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.offer_title||medicine?.name_en||medicine?.name_ar||`Product ${canonicalId}`}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{seller?.display_name||t("Seller profile unavailable", "ملف البائع غير متاح")} · <a className="font-semibold text-primary" href={`/catalog/${canonicalId}`}>#{canonicalId}</a></p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><Info label={t("Offer price", "سعر العرض")} value={money(row.unit_price_egp)}/><Info label={t("Encyclopedia evidence price", "سعر الموسوعة المرجعي")} value={medicine?.current_price_egp!=null?money(medicine.current_price_egp):null}/><Info label={t("Minimum order", "الحد الأدنى للطلب")} value={`${safeNumber(row.minimum_order_quantity)} ${row.packaging||"units"}`}/><Info label={t("Stock statement", "حالة المخزون")} value={humanize(row.stock_status)}/><Info label={t("Delivery scope", "نطاق التوصيل")} value={strings(row.delivery_scope).join(", ")}/><Info label={t("Advantages", "المزايا")} value={strings(row.advantages).join(", ")}/><Info label={t("Payment terms", "شروط الدفع")} value={strings(row.payment_terms).join(", ")}/><Info label={t("Prescription handling", "التعامل مع الوصفة")} value={humanize(row.prescription_handling)}/></div><ReviewControls id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={()=>void reviewOffer(row,"approved")} reject={()=>void reviewOffer(row,"rejected")}/></CardContent></Card>;})}</Queue>
      <Alert className="mt-8"><AlertDescription>{t("Approval publishes a seller profile or offer for B2B discovery. It does not certify a product batch, guarantee inventory, validate a prescription, establish regulatory approval, or create a commercial contract.", "الاعتماد ينشر ملف بائع أو عرضًا للاكتشاف بين الشركات. لا يعتمد دفعة منتج ولا يضمن المخزون ولا يتحقق من وصفة ولا يثبت موافقة تنظيمية ولا يُنشئ عقدًا تجاريًا.")}</AlertDescription></Alert>
    </>}
  </main>;
}

function Queue({title,empty,children}:{title:string;empty:string;children:ReactNode}){const items=arrayOf<ReactNode>(children);const has=items.length>0||(!Array.isArray(children)&&Boolean(children));return <section className="mt-10"><div className="flex items-center gap-2"><Store className="h-5 w-5"/><h2 className="text-2xl font-semibold">{title}</h2></div><div className="mt-4 grid gap-4 xl:grid-cols-2">{has?children:<Card><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>}</div></section>;}
function ReviewControls({id,notes,setNotes,saving,approve,reject}:{id:string;notes:Record<string,string>;setNotes:Dispatch<SetStateAction<Record<string,string>>>;saving:string|null;approve:()=>void;reject:()=>void}){const { t } = useLanguage();return <><div><Label>{t("Review notes", "ملاحظات المراجعة")}</Label><Textarea className="mt-1" value={notes[id]||""} onChange={event=>setNotes(current=>({...current,[id]:event.target.value}))} placeholder={t("Document license, identity, product, commercial, and evidence checks.", "وثّق فحوصات الترخيص والهوية والمنتج والتجارة والأدلة.")}/></div><div className="flex flex-wrap gap-2"><Button onClick={approve} disabled={saving===id}><Check className="mr-2 h-4 w-4"/>{t("Approve and publish", "اعتماد ونشر")}</Button><Button variant="destructive" onClick={reject} disabled={saving===id}><X className="mr-2 h-4 w-4"/>{t("Reject", "رفض")}</Button></div></>;}
function Evidence({urls}:{urls:string[]}){const { t } = useLanguage();return urls.length?<div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Evidence", "الأدلة")}</div><div className="mt-2 flex flex-col gap-1">{urls.map((url,index)=><a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-primary">{url}</a>)}</div></div>:null;}
function Metric({label,value}:{label:string;value:number}){return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>;}
function Info({label,value}:{label:string;value:string|null|undefined}){return <div><div className="text-xs text-muted-foreground">{label}</div><div className="break-words font-medium">{value||"—"}</div></div>;}
function money(value:unknown){const number=Number(value);return Number.isFinite(number)?`${number.toLocaleString()} EGP`:"—";}
function safeNumber(value:unknown){const number=Number(value);return Number.isFinite(number)?number.toLocaleString():"—";}
