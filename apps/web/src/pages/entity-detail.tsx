import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BadgeCheck, Building2, ExternalLink, FlaskConical, Globe2, Search, ShieldCheck } from "lucide-react";
import { useRoute } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import {
  cleanCompanyOrigin,
  cleanDiseaseEntityName,
  fetchSeoEntityDirectory,
  seoEntityPath,
  seoEntitySlug,
  type SeoEntity,
  type SeoEntityDirectory,
  type SeoEntityType,
} from "@/lib/seo-entities";

type CompanyProfile = {
  id: string;
  company_name: string;
  company_slug: string;
  origin: string | null;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
};

type OfficialProfile = {
  id: string;
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  contact_email: string | null;
  therapeutic_areas: string[];
  product_categories: string[];
  capabilities: string[];
  support_programs: string[];
  verification_status: string;
};

type CompanyContribution = {
  id: string;
  contribution_type: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  evidence_urls: string[];
  published_at: string;
};

type Product = {
  id: string;
  product_name: string;
  product_url: string | null;
  disease_name: string | null;
  final_price: number | null;
  price_currency: string;
  prescription_required: string | null;
  drug_variant: string | null;
  company_name: string | null;
  company_slug: string | null;
  generic_name: string | null;
  drug_content_summary: string | null;
};

function exact(value: string) { return encodeURIComponent(value); }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function pageTitle(entity: SeoEntity) {
  if (entity.type === "company") return `${entity.name} Medicines and Healthcare Profile | Medicine Support Hub`;
  if (entity.type === "generic") return `${entity.name} Products and Source Evidence | Medicine Support Hub`;
  return `${entity.name} Medicine Products | Medicine Support Hub`;
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return ""; }
}

export default function EntityDetail() {
  const [companyRoute, companyParams] = useRoute("/companies/:slug");
  const [genericRoute, genericParams] = useRoute("/generics/:slug");
  const [, diseaseParams] = useRoute("/diseases/:slug");
  const type: SeoEntityType = companyRoute ? "company" : genericRoute ? "generic" : "disease";
  const slug = companyRoute ? companyParams?.slug : genericRoute ? genericParams?.slug : diseaseParams?.slug;
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [directory, setDirectory] = useState<SeoEntityDirectory | null>(null);
  const [entity, setEntity] = useState<SeoEntity | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [officialProfile, setOfficialProfile] = useState<OfficialProfile | null>(null);
  const [contributions, setContributions] = useState<CompanyContribution[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const nextDirectory = await fetchSeoEntityDirectory();
        const normalizedSlug = safeDecode(slug);
        const nextEntity = nextDirectory.entities.find((item) => item.type === type && item.slug === normalizedSlug) || null;
        if (!nextEntity) throw new Error(t("This public entity page was not found.", "لم يتم العثور على هذه الصفحة العامة."));

        const productSelect = "id,product_name,product_url,disease_name,final_price,price_currency,prescription_required,drug_variant,company_name,company_slug,generic_name,drug_content_summary";
        const sourceValue = nextEntity.sourceValue || nextEntity.name;
        const filter = type === "company"
          ? `company_slug=eq.${exact(nextEntity.slug)}`
          : type === "generic"
            ? `generic_name=eq.${exact(sourceValue)}`
            : `disease_name=eq.${exact(sourceValue)}`;
        const productPromise = supabaseFetch<Product[]>(`/rest/v1/verified_medicine_source_products?select=${productSelect}&duplicate_status=eq.active&${filter}&order=final_price.desc.nullslast&limit=100`);

        let sourceProfilePromise: Promise<CompanyProfile[]> = Promise.resolve([]);
        let officialProfilePromise: Promise<OfficialProfile[]> = Promise.resolve([]);
        let contributionPromise: Promise<CompanyContribution[]> = Promise.resolve([]);
        if (type === "company") {
          const sourceSelect = "id,company_name,company_slug,origin,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price";
          sourceProfilePromise = supabaseFetch<CompanyProfile[]>(`/rest/v1/medicine_company_profiles?select=${sourceSelect}&company_slug=eq.${exact(nextEntity.slug)}&limit=1`);
          const officialSelect = "id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,verification_status";
          officialProfilePromise = supabaseFetch<OfficialProfile[]>(`/rest/v1/industry_company_profiles?select=${officialSelect}&company_slug=eq.${exact(nextEntity.slug)}&verification_status=eq.verified&is_public=eq.true&limit=1`);
          contributionPromise = supabaseFetch<CompanyContribution[]>(`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,payload,evidence_urls,published_at&company_slug=eq.${exact(nextEntity.slug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`);
        }

        const [productRows, sourceProfiles, officialProfiles, approvedContributions] = await Promise.all([
          productPromise,
          sourceProfilePromise,
          officialProfilePromise,
          contributionPromise,
        ]);
        if (cancelled) return;
        setDirectory(nextDirectory);
        setEntity(nextEntity);
        setProducts(productRows);
        setCompanyProfile(sourceProfiles[0] || null);
        setOfficialProfile(officialProfiles[0] || null);
        setContributions(approvedContributions);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("Could not load this page.", "تعذر تحميل الصفحة."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [slug, type]);

  const description = entity
    ? officialProfile?.description || entity.description || (type === "company"
      ? `${entity.name} healthcare company profile connecting ${Number(entity.activeRecords ?? entity.records).toLocaleString()} active source-backed products, ${Number(entity.genericCount || 0).toLocaleString()} generics, and ${Number(entity.diseaseCount || 0).toLocaleString()} disease areas.`
      : type === "generic"
        ? `${entity.name} generic medicine reference connecting ${entity.records.toLocaleString()} active source-backed products, companies, disease areas, prescription signals, and observed source-market prices.`
        : `${entity.name} medicine product reference connecting ${entity.records.toLocaleString()} active source-backed products, generics, companies, prescription signals, and observed source-market prices.`)
    : "Source-backed medicine entity page.";

  usePageSeo(entity ? {
    title: pageTitle(entity),
    description,
    canonicalPath: seoEntityPath(entity.type, entity.slug),
    keywords: `${entity.name}, medicine products, pharmaceutical companies, medical products, generic medicines, source-backed medicine data`,
    image: officialProfile?.logo_url || entity.logoUrl || null,
  } : null);

  const related = useMemo(() => buildRelatedLinks(type, products, directory), [type, products, directory]);
  const currency = products.find((product) => product.price_currency)?.price_currency || "";
  const prices = products.map((product) => Number(product.final_price)).filter((value) => Number.isFinite(value) && value > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const Icon = type === "company" ? Building2 : type === "generic" ? FlaskConical : Activity;
  const directoryPath = type === "company" ? "/companies" : type === "generic" ? "/generics" : "/diseases";

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <a href={directoryPath} className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to directory", "العودة إلى الدليل")}</a>
    {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading connected profile...", "جاري تحميل الملف المترابط...")}</p>}

    {entity && !loading && <>
      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          {officialProfile?.logo_url && <img src={officialProfile.logo_url} alt="" className="h-20 w-20 rounded-xl border bg-background object-contain p-2" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4" />{type === "company" ? t("Healthcare company profile", "ملف شركة رعاية صحية") : type === "generic" ? t("Generic medicine reference", "مرجع مادة فعالة") : t("Disease-area reference", "مرجع مجال مرضي")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold tracking-tight">{officialProfile?.display_name || entity.name}</h1>{officialProfile && <Badge className="gap-1"><BadgeCheck className="h-3.5 w-3.5" />{t("Official verified profile", "ملف رسمي موثق")}</Badge>}</div>
            {type === "company" && cleanCompanyOrigin(companyProfile?.origin || entity.origin || officialProfile?.country) && <p className="mt-2 text-muted-foreground">{t("Origin or headquarters", "المنشأ أو المقر")}: {cleanCompanyOrigin(companyProfile?.origin || entity.origin || officialProfile?.country)}</p>}
            <p className="mt-3 max-w-4xl text-muted-foreground">{description}</p>
          </div>
        </div>
      </section>

      {type === "company" && officialProfile && <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />{t("Official company information", "بيانات الشركة الرسمية")}</h2><p className="mt-1 text-sm text-muted-foreground">{humanize(officialProfile.company_type)} · {[officialProfile.city, officialProfile.country].filter(Boolean).join(", ")}</p></div>{officialProfile.website_url && <a href={officialProfile.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border bg-background px-4 py-2 text-sm font-semibold"><Globe2 className="mr-2 h-4 w-4" />{t("Company website", "موقع الشركة")}</a>}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TagGroup title={t("Therapeutic areas", "المجالات العلاجية")} values={officialProfile.therapeutic_areas} />
          <TagGroup title={t("Product categories", "فئات المنتجات")} values={officialProfile.product_categories} />
          <TagGroup title={t("Capabilities", "القدرات")} values={officialProfile.capabilities} />
          <TagGroup title={t("Patient-support programs", "برامج دعم المرضى")} values={officialProfile.support_programs} />
        </div>
      </section>}

      {type === "company" && !officialProfile && <section className="mt-6 rounded-2xl border border-dashed p-5"><h2 className="text-lg font-semibold">{t("Represent this company?", "هل تمثل هذه الشركة؟")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("Claim the profile to add verified official information, capabilities, support programs, and evidence-backed contributions.", "طالب بإدارة الملف لإضافة المعلومات الرسمية الموثقة والقدرات وبرامج الدعم والمساهمات المدعومة بالأدلة.")}</p><a href={`/industry?company=${encodeURIComponent(entity.slug)}`} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Claim and build this profile", "المطالبة بهذا الملف وتطويره")}</a></section>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("Active source listings", "قوائم المصدر النشطة")} value={entity.activeRecords ?? products.length ?? entity.records} />
        <Metric label={type === "company" ? t("Generics", "المواد الفعالة") : t("Companies", "الشركات")} value={type === "company" ? companyProfile?.generic_count ?? entity.genericCount ?? 0 : new Set(products.map((product) => product.company_name).filter(Boolean)).size} />
        <Metric label={type === "disease" ? t("Generics", "المواد الفعالة") : t("Disease areas", "المجالات المرضية")} value={type === "disease" ? new Set(products.map((product) => product.generic_name).filter(Boolean)).size : type === "company" ? companyProfile?.disease_area_count ?? entity.diseaseCount ?? 0 : new Set(products.map((product) => product.disease_name).filter(Boolean)).size} />
        <Metric label={t("Observed source price range", "نطاق سعر المصدر المرصود")} value={minPrice != null && maxPrice != null ? `${minPrice.toLocaleString()}–${maxPrice.toLocaleString()} ${currency}` : "—"} />
      </section>

      {related.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-xl font-semibold">{t("Connected entities", "كيانات مترابطة")}</h2><div className="mt-4 flex flex-wrap gap-2">{related.slice(0, 36).map((item) => <a key={`${item.type}-${item.slug}`} href={seoEntityPath(item.type, item.slug)} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:bg-muted">{item.name}</a>)}</div></section>}

      {type === "company" && contributions.length > 0 && <section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">{t("Approved company contributions", "مساهمات الشركة المعتمدة")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Attributable company-submitted knowledge reviewed before publication.", "معرفة مقدمة من الشركة ومنسوبة إليها وخضعت للمراجعة قبل النشر.")}</p></div><a href="/industry" className="text-sm font-semibold text-primary">{t("Industry network", "شبكة الشركات")}</a></div><div className="mt-4 grid gap-4 md:grid-cols-2">{contributions.map((contribution) => <Card key={contribution.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><CardTitle className="text-lg">{contribution.title}</CardTitle><Badge variant="outline">{humanize(contribution.contribution_type)}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{contribution.summary}</p>{contribution.evidence_urls.length > 0 && <div className="mt-4 flex flex-col gap-1">{contribution.evidence_urls.slice(0, 5).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center break-all text-sm font-semibold text-primary">{t("Open supporting evidence", "فتح الدليل الداعم")}<ExternalLink className="ml-1 h-3.5 w-3.5" /></a>)}</div>}<p className="mt-4 text-xs text-muted-foreground">{t("Published", "نُشر")}: {new Date(contribution.published_at).toLocaleDateString()}</p></CardContent></Card>)}</div></section>}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">{t("Verified source products", "منتجات مصدرية موثقة")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Independent source records remain separate from company-contributed information.", "تظل سجلات المصادر المستقلة منفصلة عن المعلومات التي تساهم بها الشركة.")}</p></div>{products.length > 0 && <a href={`/verified-products?${type === "company" ? `company=${encodeURIComponent(entity.slug)}` : `query=${encodeURIComponent(entity.sourceValue || entity.name)}`}`} className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"><Search className="mr-2 h-4 w-4" />{t("Open database search", "فتح بحث قاعدة البيانات")}</a>}</div>
        {products.length > 0 ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} t={t} />)}</div> : <Card className="mt-4"><CardContent className="p-6 text-sm text-muted-foreground">{t("No independent source products are linked yet. The official company profile can still connect capabilities, resources, support programs, and future verified product evidence.", "لا توجد منتجات مرتبطة بمصدر مستقل حتى الآن. ومع ذلك يمكن للملف الرسمي ربط القدرات والموارد وبرامج الدعم وأدلة المنتجات الموثقة مستقبلًا.")}</CardContent></Card>}
      </section>

      <Alert className="mt-8"><AlertDescription>{t("Official company information and approved company contributions are attributed to the company. Source-market listings remain independently labeled and do not establish Egyptian registration, local availability, indication, clinical suitability, or Egyptian price. Do not use this page as medical advice.", "تُنسب المعلومات الرسمية ومساهمات الشركة المعتمدة إلى الشركة. وتظل قوائم سوق المصدر موسومة بشكل مستقل ولا تثبت التسجيل أو التوافر أو دواعي الاستعمال أو الملاءمة العلاجية أو السعر داخل مصر. لا تستخدم هذه الصفحة كنصيحة طبية.")}</AlertDescription></Alert>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>;
}

function TagGroup({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="text-sm font-semibold">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{values.length > 0 ? values.map((value) => <Badge key={value} variant="secondary">{value}</Badge>) : <span className="text-sm text-muted-foreground">—</span>}</div></div>;
}

function ProductCard({ product, t }: { product: Product; t: (en: string, ar: string) => string }) {
  const diseaseLabel = product.disease_name ? cleanDiseaseEntityName(product.disease_name) : null;
  return <Card className="h-full shadow-sm"><CardHeader><CardTitle className="text-lg leading-7">{product.product_name}</CardTitle><p className="text-sm text-muted-foreground">{product.generic_name || product.drug_variant || "—"}</p></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex flex-wrap gap-2">{diseaseLabel && <Badge>{diseaseLabel}</Badge>}{product.prescription_required && <Badge variant="outline">{product.prescription_required}</Badge>}{product.final_price != null && <Badge variant="secondary">{Number(product.final_price).toLocaleString()} {product.price_currency}</Badge>}</div>{product.company_name && <div><span className="text-xs text-muted-foreground">{t("Company", "الشركة")}</span><div className="font-medium">{product.company_name}</div></div>}{product.drug_content_summary && <p className="line-clamp-3 text-muted-foreground">{product.drug_content_summary}</p>}{product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source listing", "فتح قائمة المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a>}</CardContent></Card>;
}

function buildRelatedLinks(type: SeoEntityType, products: Product[], directory: SeoEntityDirectory | null) {
  const byKey = new Map<string, SeoEntity>();
  for (const entity of directory?.entities || []) {
    byKey.set(`${entity.type}:${entity.name}`, entity);
    if (entity.sourceValue) byKey.set(`${entity.type}:${entity.sourceValue}`, entity);
  }
  const result = new Map<string, SeoEntity>();
  function add(nextType: SeoEntityType, sourceName: string | null, providedSlug?: string | null) {
    if (!sourceName) return;
    const found = byKey.get(`${nextType}:${sourceName}`);
    const publicName = nextType === "disease" ? cleanDiseaseEntityName(sourceName) : sourceName;
    const nextSlug = providedSlug || found?.slug || (nextType === "company" ? "" : seoEntitySlug(publicName));
    if (!nextSlug) return;
    result.set(`${nextType}:${nextSlug}`, found || { type: nextType, name: publicName, sourceValue: sourceName, slug: nextSlug, records: 0 });
  }
  for (const product of products) {
    if (type !== "company") add("company", product.company_name, product.company_slug);
    if (type !== "generic") add("generic", product.generic_name);
    if (type !== "disease") add("disease", product.disease_name);
  }
  return [...result.values()].sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
}
