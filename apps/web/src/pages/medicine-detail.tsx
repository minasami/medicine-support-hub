import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, ArrowLeft, BadgeCheck, Building2, ExternalLink, Handshake, History, Info, Send, ShieldCheck, Store, Truck } from "lucide-react";
import { EntitySocialPanel } from "@/components/entity-social-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

interface Product {
  canonical_id: number;
  canonical_key: string;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  route: string | null;
  category: string | null;
  image_url: string | null;
  egyptdwa_source_url: string | null;
  barcode: string | null;
  code: string | null;
  custom_product_code: string | null;
  current_price_egp: number | null;
  price_currency: string;
  min_price_egp: number | null;
  max_price_egp: number | null;
  price_observation_count: number;
  distinct_price_count: number;
  has_price_history: boolean;
  source_record_count: number;
  source_count: number;
  source_systems: string[];
  has_verified_dataset: boolean;
  has_operational_catalog: boolean;
  has_egyptdwa_source: boolean;
  has_company_verified_source: boolean;
  company_product_count: number;
  company_slugs: string[];
  marketplace_offer_count: number;
  marketplace_seller_count: number;
  lowest_marketplace_price_egp: number | null;
  current_price_source: string | null;
  current_price_observed_at: string | null;
  current_price_date_precision: string | null;
}

interface ManufacturerCompany {
  canonical_id: number;
  manufacturer: string;
  company_name: string;
  company_slug: string;
}

interface PriceHistory {
  price: number;
  currency: string;
  source_system: string;
  source_name: string;
  first_observed_at: string;
  last_observed_at: string;
  date_precision: string;
  source_record_count: number;
  current_price_egp: number;
  is_current_candidate: boolean;
  price_delta_from_previous: number | null;
}

interface Offer {
  id: string;
  canonical_id: number;
  seller_profile_id: string;
  seller_slug: string;
  seller_name: string;
  seller_type: string;
  seller_country: string | null;
  seller_city: string | null;
  unit_price_egp: number;
  list_price_egp: number | null;
  minimum_order_quantity: number;
  packaging: string | null;
  stock_status: string;
  lead_time_days: number | null;
  minimum_expiry_months: number | null;
  delivery_scope: string[];
  advantages: string[];
  payment_terms: string[];
  cold_chain_supported: boolean;
  published_at: string;
  price_difference_percent: number | null;
}

interface Contribution {
  id: string;
  contribution_type: string;
  title: string;
  summary: string;
  proposed_price_egp: number | null;
  organization_name: string | null;
  evidence_urls: string[];
  created_at: string;
}

const contributionTypes = ["correction", "price_observation", "availability_update", "product_evidence", "educational_resource", "patient_support_connection"];
const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatPrice = (value: number | null, currency = "EGP") => value == null ? "—" : `${Number(value).toLocaleString()} ${currency}`;

export default function MedicineDetail() {
  const [catalogRoute, catalogParams] = useRoute("/catalog/:id");
  const [, legacyParams] = useRoute("/medicines/:id");
  const rawId = catalogRoute ? catalogParams?.id : legacyParams?.id;
  const requestedId = Number(rawId);
  const { t, language } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [manufacturerCompany, setManufacturerCompany] = useState<ManufacturerCompany | null>(null);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ type: "correction", title: "", summary: "", price: "", organization: "", evidence: "" });

  async function resolveCanonical() {
    if (!Number.isSafeInteger(requestedId) || requestedId <= 0) return null;
    if (catalogRoute) return requestedId;
    const legacy = await supabaseFetch<Array<{ id: number }>>("/rest/v1/rpc/resolve_legacy_medicine_catalog", { method: "POST", body: JSON.stringify({ p_legacy_medicine_id: requestedId }) });
    const medicines2Id = legacy[0]?.id || requestedId;
    const mapping = await supabaseFetch<Array<{ canonical_id: number }>>(`/rest/v1/medicine_catalog_id_map_v1?select=canonical_id&source_system=eq.medicines2&source_record_key=eq.${medicines2Id}&limit=1`);
    return mapping[0]?.canonical_id || null;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const canonicalId = await resolveCanonical();
      if (!canonicalId) throw new Error(t("This medicine could not be connected to the canonical encyclopedia.", "تعذر ربط هذا الدواء بالموسوعة الموحدة."));
      const select = "canonical_id,canonical_key,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,image_url,egyptdwa_source_url,barcode,code,custom_product_code,current_price_egp,price_currency,min_price_egp,max_price_egp,price_observation_count,distinct_price_count,has_price_history,source_record_count,source_count,source_systems,has_verified_dataset,has_operational_catalog,has_egyptdwa_source,has_company_verified_source,company_product_count,company_slugs,marketplace_offer_count,marketplace_seller_count,lowest_marketplace_price_egp,current_price_source,current_price_observed_at,current_price_date_precision";
      const [products, priceRows, offerRows, contributionRows, manufacturerRows] = await Promise.all([
        supabaseFetch<Product[]>(`/rest/v1/medicine_encyclopedia_products_v2?select=${select}&canonical_id=eq.${canonicalId}&limit=1`),
        supabaseFetch<PriceHistory[]>(`/rest/v1/medicine_encyclopedia_price_history_v2?select=price,currency,source_system,source_name,first_observed_at,last_observed_at,date_precision,source_record_count,current_price_egp,is_current_candidate,price_delta_from_previous&canonical_id=eq.${canonicalId}&order=last_observed_at.desc,price.desc`),
        supabaseFetch<Offer[]>(`/rest/v1/marketplace_public_offers_v1?select=id,canonical_id,seller_profile_id,seller_slug,seller_name,seller_type,seller_country,seller_city,unit_price_egp,list_price_egp,minimum_order_quantity,packaging,stock_status,lead_time_days,minimum_expiry_months,delivery_scope,advantages,payment_terms,cold_chain_supported,published_at,price_difference_percent&canonical_id=eq.${canonicalId}&order=unit_price_egp.asc,published_at.desc`),
        supabaseFetch<Contribution[]>(`/rest/v1/medicine_approved_contributions_v1?select=id,contribution_type,title,summary,proposed_price_egp,organization_name,evidence_urls,created_at&canonical_id=eq.${canonicalId}&order=created_at.desc&limit=50`),
        supabaseFetch<ManufacturerCompany[]>(`/rest/v1/medicine_manufacturer_company_v1?select=canonical_id,manufacturer,company_name,company_slug&canonical_id=eq.${canonicalId}&limit=1`),
      ]);
      const next = products[0] || null;
      if (!next) throw new Error(t("Medicine record not found.", "لم يتم العثور على سجل الدواء."));
      setProduct(next);
      setHistory(priceRows || []);
      setOffers(offerRows || []);
      setContributions(contributionRows || []);
      setManufacturerCompany(manufacturerRows[0] || null);
      if (!catalogRoute && window.location.pathname !== `/catalog/${canonicalId}`) window.history.replaceState({}, "", `/catalog/${canonicalId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load the medicine.", "تعذر تحميل الدواء."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [rawId]);

  const title = useMemo(() => product ? (language === "ar" ? product.name_ar || product.name_en : product.name_en || product.name_ar) || `#${product.canonical_id}` : "", [product, language]);
  const alternate = product ? (language === "ar" ? product.name_en : product.name_ar) : null;

  async function submitContribution(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !product) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/medicine_collaboration_submissions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          canonical_id: product.canonical_id,
          contribution_type: draft.type,
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          proposed_price_egp: draft.price ? Number(draft.price) : null,
          evidence_urls: draft.evidence.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
          submitted_by: session.user.id,
          organization_name: draft.organization.trim() || null,
          status: "submitted",
        }),
      });
      setDraft({ type: "correction", title: "", summary: "", price: "", organization: "", evidence: "" });
      setMessage(t("Contribution submitted for evidence review.", "تم إرسال المساهمة لمراجعة الأدلة."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not submit the contribution.", "تعذر إرسال المساهمة."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="container mx-auto max-w-6xl px-4 py-10"><p className="text-sm text-muted-foreground">{t("Loading merged medicine record...", "جاري تحميل سجل الدواء الموحد...")}</p></main>;
  if (!product) return <main className="container mx-auto max-w-3xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error || t("Medicine not found.", "الدواء غير موجود.")}</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <a href="/medicines" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to medicine search", "العودة إلى بحث الأدوية")}</a>
    {error && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-5"><Send className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

    <section className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[.75fr_1.25fr]">
        {product.image_url ? <img src={product.image_url} alt={title} className="max-h-[380px] w-full rounded-2xl bg-muted/30 object-contain p-5" /> : <div className="flex min-h-64 items-center justify-center rounded-2xl bg-muted/30"><Info className="h-12 w-12 text-muted-foreground" /></div>}
        <div>
          <div className="flex flex-wrap gap-2">{product.has_verified_dataset && <Badge><ShieldCheck className="mr-1 h-3 w-3" />{t("Verified dataset", "بيانات موثقة")}</Badge>}{product.has_company_verified_source && <Badge variant="secondary"><Building2 className="mr-1 h-3 w-3" />{t("Verified company portfolio", "محفظة شركة موثقة")}</Badge>}{product.marketplace_offer_count > 0 && <Badge variant="outline"><Store className="mr-1 h-3 w-3" />{product.marketplace_offer_count} {t("approved offers", "عرض معتمد")}</Badge>}</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">{title}</h1>
          {alternate && <p className="mt-2 text-lg text-muted-foreground">{alternate}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label={t("Evidence price candidate", "سعر الدليل المرشح")} value={formatPrice(product.current_price_egp)} /><Metric label={t("Observed price range", "نطاق الأسعار المرصودة")} value={product.min_price_egp != null && product.max_price_egp != null ? `${Number(product.min_price_egp).toLocaleString()}–${Number(product.max_price_egp).toLocaleString()} EGP` : "—"} /><Metric label={t("Approved supply offers", "عروض التوريد المعتمدة")} value={product.marketplace_offer_count} /></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Fact label={t("Scientific name", "الاسم العلمي")} value={product.scientific_name} />
            <div><div className="text-xs text-muted-foreground">{t("Manufacturer", "الشركة المصنعة")}</div>{manufacturerCompany ? <a href={`/companies/${encodeURIComponent(manufacturerCompany.company_slug)}`} className="inline-flex items-center font-semibold text-primary hover:underline"><Building2 className="mr-1.5 h-4 w-4" />{manufacturerCompany.company_name}</a> : <div className="font-medium break-words">{product.manufacturer || "—"}</div>}</div>
            <Fact label={t("Drug class", "التصنيف الدوائي")} value={product.drug_class || product.category} />
            <Fact label={t("Route", "طريقة الاستخدام")} value={product.route} />
            <Fact label={t("Barcode", "الباركود")} value={product.barcode} />
            <Fact label={t("Product code", "كود المنتج")} value={product.code || product.custom_product_code} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">{product.source_systems.map((source) => <Badge variant="outline" key={source}>{humanize(source)}</Badge>)}</div>
          {product.egyptdwa_source_url && <a href={product.egyptdwa_source_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center font-semibold text-primary">{t("Open attributed source listing", "فتح قائمة المصدر المنسوبة")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
        </div>
      </div>
    </section>

    <Alert className="mt-6"><AlertDescription>{t("Evidence price and seller offer are different concepts. Marketplace offers require licensing, quality, expiry, batch, prescription, availability, and procurement verification. Community comments and observations are not medical advice.", "سعر الدليل وعرض البائع مفهومان مختلفان. عروض السوق تحتاج للتحقق من الترخيص والجودة والصلاحية والتشغيلة والوصفة والتوافر وضوابط الشراء. تعليقات وملاحظات المجتمع ليست نصيحة طبية.")}</AlertDescription></Alert>

    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Verified supply marketplace", "سوق التوريد الموثق")}</p><h2 className="mt-2 text-3xl font-bold">{t("Compare approved seller offers", "قارن عروض البائعين المعتمدة")}</h2></div><Button asChild variant="outline"><a href={`/marketplace?q=${encodeURIComponent(title)}`}><Store className="mr-2 h-4 w-4" />{t("Open marketplace", "فتح السوق")}</a></Button></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{offers.map((offer) => <Card key={offer.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle><a href={`/marketplace/sellers/${encodeURIComponent(offer.seller_slug)}`} className="text-primary">{offer.seller_name}</a></CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(offer.seller_type)} · {[offer.seller_city, offer.seller_country].filter(Boolean).join(", ")}</p></div><BadgeCheck className="h-5 w-5 text-primary" /></div></CardHeader><CardContent className="space-y-3 text-sm"><div className="text-3xl font-bold">{formatPrice(offer.unit_price_egp)}</div><div className="flex flex-wrap gap-2"><Badge>{humanize(offer.stock_status)}</Badge>{offer.lead_time_days != null && <Badge variant="outline"><Truck className="mr-1 h-3 w-3" />{offer.lead_time_days} {t("days", "يوم")}</Badge>}{offer.cold_chain_supported && <Badge variant="secondary">{t("Cold chain", "سلسلة تبريد")}</Badge>}</div><Fact label={t("Minimum order", "الحد الأدنى للطلب")} value={`${Number(offer.minimum_order_quantity).toLocaleString()} ${offer.packaging || t("units", "وحدات")}`} />{offer.minimum_expiry_months != null && <Fact label={t("Minimum expiry", "أقل صلاحية")} value={`${offer.minimum_expiry_months} ${t("months", "شهر")}`} />}<div className="flex flex-wrap gap-1">{offer.advantages.slice(0, 5).map((value) => <Badge variant="outline" key={value}>{value}</Badge>)}</div><Button asChild size="sm"><a href={`/marketplace?q=${encodeURIComponent(title)}`}>{t("Request quotation", "طلب عرض سعر")}</a></Button></CardContent></Card>)}{offers.length === 0 && <Card><CardContent className="p-8 text-sm text-muted-foreground">{t("No reviewed supply offers are public yet. Licensed sellers can submit an offer from the marketplace.", "لا توجد عروض توريد مراجعة عامة حتى الآن. يمكن للبائعين المرخصين إرسال عرض من السوق.")}</CardContent></Card>}</div></section>

    <section className="mt-10"><div className="flex items-center gap-2"><History className="h-5 w-5" /><h2 className="text-3xl font-bold">{t("Observed price evidence timeline", "الخط الزمني لأدلة الأسعار")}</h2></div><div className="mt-4 space-y-3">{history.map((row, index) => <Card key={`${row.source_system}-${row.price}-${row.last_observed_at}-${index}`}><CardContent className="grid gap-4 p-5 md:grid-cols-[.7fr_1.2fr_1fr_auto] md:items-center"><div><div className="text-2xl font-bold">{formatPrice(row.price, row.currency)}</div>{row.is_current_candidate && <Badge className="mt-2">{t("Current evidence candidate", "مرشح السعر الحالي")}</Badge>}</div><div><div className="font-semibold">{row.source_name}</div><div className="text-xs text-muted-foreground">{humanize(row.source_system)} · {row.source_record_count} {t("records", "سجل")}</div></div><div className="text-sm"><div>{new Date(row.last_observed_at).toLocaleDateString()}</div><div className="text-xs text-muted-foreground">{row.date_precision === "record_date" ? t("Record observation date", "تاريخ رصد السجل") : t("Source import date", "تاريخ استيراد المصدر")}</div></div><div>{row.price_delta_from_previous != null && <Badge variant={row.price_delta_from_previous >= 0 ? "secondary" : "outline"}>{row.price_delta_from_previous >= 0 ? "+" : ""}{Number(row.price_delta_from_previous).toLocaleString()} EGP</Badge>}</div></CardContent></Card>)}</div></section>

    {contributions.length > 0 && <section className="mt-10"><h2 className="text-3xl font-bold">{t("Approved stakeholder contributions", "مساهمات أصحاب المصلحة المعتمدة")}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{contributions.map((row) => <Card key={row.id}><CardHeader><CardTitle>{row.title}</CardTitle><p className="text-sm text-muted-foreground">{humanize(row.contribution_type)} · {row.organization_name || t("Attributed contributor", "مساهم منسوب")}</p></CardHeader><CardContent className="space-y-3 text-sm"><p className="leading-6 text-muted-foreground">{row.summary}</p>{row.proposed_price_egp != null && <Badge>{formatPrice(row.proposed_price_egp)}</Badge>}{row.evidence_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all font-semibold text-primary">{url}</a>)}</CardContent></Card>)}</div></section>}

    <section className="mt-10 rounded-3xl border bg-muted/30 p-6 md:p-8"><div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><Handshake className="h-4 w-4" />{t("Medicine collaboration", "تعاون حول الدواء")}</p><h2 className="mt-3 text-3xl font-bold">{t("Contribute evidence without overwriting verified records", "ساهم بالأدلة دون استبدال السجلات الموثقة")}</h2><p className="mt-3 text-muted-foreground">{t("Submit corrections, price observations, availability updates, official documentation, educational resources, or patient-support connections. Every submission is attributable and moderated.", "أرسل تصحيحات أو أسعارًا مرصودة أو تحديثات توافر أو مستندات رسمية أو موارد تعليمية أو روابط دعم المرضى. كل مساهمة منسوبة وخاضعة للمراجعة.")}</p>{!isAuthenticated && <Button asChild className="mt-5"><a href="/account">{t("Sign in to contribute", "سجل الدخول للمساهمة")}</a></Button>}</div>{isAuthenticated && <form onSubmit={submitContribution} className="space-y-4 rounded-2xl border bg-card p-5"><div><Label>{t("Contribution type", "نوع المساهمة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>{contributionTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></div><Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={t("Contribution title", "عنوان المساهمة")} required /><Textarea value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder={t("Explain the proposed information and its evidence.", "اشرح المعلومة المقترحة وأدلتها.")} required /><div className="grid gap-3 sm:grid-cols-2"><Input inputMode="decimal" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder={t("Observed price EGP (optional)", "سعر مرصود بالجنيه (اختياري)")} /><Input value={draft.organization} onChange={(event) => setDraft((current) => ({ ...current, organization: event.target.value }))} placeholder={t("Organization (optional)", "الجهة (اختياري)")} /></div><Textarea value={draft.evidence} onChange={(event) => setDraft((current) => ({ ...current, evidence: event.target.value }))} placeholder={t("Evidence URLs, one per line", "روابط الأدلة، رابط بكل سطر")} /><Button type="submit" disabled={saving || draft.title.trim().length < 3 || draft.summary.trim().length < 10}><Send className="mr-2 h-4 w-4" />{t("Submit for review", "إرسال للمراجعة")}</Button></form>}</div></section>

    <EntitySocialPanel entityType="medicine" entityKey={String(product.canonical_id)} canonicalId={product.canonical_id} title={title} />
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>; }
function Fact({ label, value }: { label: string; value: string | null | undefined }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>; }
