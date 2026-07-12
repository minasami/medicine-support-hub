import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BadgeCheck, Building2, Database, ExternalLink, FlaskConical, Globe2, Loader2, Search, ShieldCheck } from "lucide-react";
import { useRoute } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  source_name: string;
  source_currency: string;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
  therapeutic_areas: string[] | null;
  leading_generics: string[] | null;
  portfolio_sample: string[] | null;
  dataset_metadata: Record<string, unknown> | null;
  latest_source_update: string | null;
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
  social_links?: Record<string, string> | null;
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
  disease_url?: string | null;
  final_price: number | null;
  listed_price_text?: string | null;
  price_currency: string;
  prescription_required: string | null;
  drug_variant: string | null;
  company_name: string | null;
  company_slug: string | null;
  company_origin?: string | null;
  generic_name: string | null;
  drug_content_summary?: string | null;
  image_urls?: string | null;
  source_name?: string | null;
  total_count?: number;
};

const PAGE_SIZE = 60;
function exact(value: string) { return encodeURIComponent(value); }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function list(value: string[] | null | undefined) { return Array.isArray(value) ? value.filter(Boolean) : []; }
function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return ""; } }
function pageTitle(entity: SeoEntity) {
  if (entity.type === "company") return `${entity.name} Medicines, Portfolio and Company Profile | Medicine Support Hub`;
  if (entity.type === "generic") return `${entity.name} Products and Source Evidence | Medicine Support Hub`;
  return `${entity.name} Medicine Products | Medicine Support Hub`;
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
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanyProducts(companySlug: string, search: string, offset = 0, append = false) {
    setLoadingProducts(true);
    try {
      const rows = await supabaseFetch<Product[]>(`/rest/v1/rpc/company_medicine_portfolio_page?p_company_slug=${exact(companySlug)}&p_query=${exact(search.trim())}&p_limit=${PAGE_SIZE}&p_offset=${offset}`);
      const safeRows = Array.isArray(rows) ? rows : [];
      setProducts((current) => append ? [...current, ...safeRows] : safeRows);
      setPortfolioTotal(Number(safeRows[0]?.total_count || (append ? offset + safeRows.length : safeRows.length)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load this medicine portfolio.", "تعذر تحميل محفظة الأدوية."));
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      setPortfolioQuery("");
      try {
        const normalizedSlug = safeDecode(slug);
        let nextDirectory: SeoEntityDirectory | null = null;
        try { nextDirectory = await fetchSeoEntityDirectory(); } catch { nextDirectory = null; }
        let nextEntity = nextDirectory?.entities.find((item) => item.type === type && item.slug === normalizedSlug) || null;

        if (type === "company") {
          const sourceSelect = "id,company_name,company_slug,origin,source_name,source_currency,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price,therapeutic_areas,leading_generics,portfolio_sample,dataset_metadata,latest_source_update";
          const officialSelect = "id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status";
          const [sourceProfiles, officialProfiles, approvedContributions] = await Promise.all([
            supabaseFetch<CompanyProfile[]>(`/rest/v1/medicine_company_profiles?select=${sourceSelect}&company_slug=eq.${exact(normalizedSlug)}&limit=1`),
            supabaseFetch<OfficialProfile[]>(`/rest/v1/industry_company_profiles?select=${officialSelect}&company_slug=eq.${exact(normalizedSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1`),
            supabaseFetch<CompanyContribution[]>(`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,payload,evidence_urls,published_at&company_slug=eq.${exact(normalizedSlug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`),
          ]);
          const sourceProfile = (Array.isArray(sourceProfiles) ? sourceProfiles : [])[0] || null;
          const official = (Array.isArray(officialProfiles) ? officialProfiles : [])[0] || null;
          if (!nextEntity && sourceProfile) {
            nextEntity = {
              type: "company",
              name: sourceProfile.company_name,
              sourceValue: sourceProfile.company_name,
              slug: sourceProfile.company_slug,
              records: sourceProfile.product_count,
              activeRecords: sourceProfile.active_product_count,
              archivedRecords: sourceProfile.archived_product_count,
              genericCount: sourceProfile.generic_count,
              diseaseCount: sourceProfile.disease_area_count,
              minPrice: sourceProfile.min_price,
              maxPrice: sourceProfile.max_price,
              origin: sourceProfile.origin,
            };
          }
          if (!nextEntity && official) {
            nextEntity = { type: "company", name: official.display_name, sourceValue: official.display_name, slug: official.company_slug, records: 0 };
          }
          if (!nextEntity) throw new Error(t("This public company profile was not found.", "لم يتم العثور على ملف الشركة العام."));
          if (cancelled) return;
          setCompanyProfile(sourceProfile);
          setOfficialProfile(official);
          setContributions(Array.isArray(approvedContributions) ? approvedContributions : []);
          setDirectory(nextDirectory);
          setEntity(nextEntity);
          await loadCompanyProducts(normalizedSlug, "", 0, false);
        } else {
          if (!nextEntity) throw new Error(t("This public entity page was not found.", "لم يتم العثور على هذه الصفحة العامة."));
          const productSelect = "id,product_name,product_url,disease_name,final_price,price_currency,prescription_required,drug_variant,company_name,company_slug,generic_name,drug_content_summary";
          const sourceValue = nextEntity.sourceValue || nextEntity.name;
          const filter = type === "generic" ? `generic_name=eq.${exact(sourceValue)}` : `disease_name=eq.${exact(sourceValue)}`;
          const productRows = await supabaseFetch<Product[]>(`/rest/v1/verified_medicine_source_products?select=${productSelect}&duplicate_status=eq.active&${filter}&order=final_price.desc.nullslast&limit=100`);
          if (cancelled) return;
          setDirectory(nextDirectory);
          setEntity(nextEntity);
          setProducts(Array.isArray(productRows) ? productRows : []);
          setPortfolioTotal(Array.isArray(productRows) ? productRows.length : 0);
          setCompanyProfile(null);
          setOfficialProfile(null);
          setContributions([]);
        }
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
    ? officialProfile?.description || (type === "company"
      ? `${entity.name} company intelligence profile connecting ${Number(companyProfile?.active_product_count ?? entity.activeRecords ?? entity.records).toLocaleString()} active source-backed medicine records, ${Number(companyProfile?.generic_count ?? entity.genericCount || 0).toLocaleString()} generics, and ${Number(companyProfile?.disease_area_count ?? entity.diseaseCount || 0).toLocaleString()} therapeutic areas.`
      : type === "generic"
        ? `${entity.name} generic medicine reference connecting ${entity.records.toLocaleString()} active source-backed products, companies, disease areas, prescription signals, and observed source-market prices.`
        : `${entity.name} medicine product reference connecting ${entity.records.toLocaleString()} active source-backed products, generics, companies, prescription signals, and observed source-market prices.`)
    : "Source-backed medicine entity page.";

  usePageSeo(entity ? {
    title: pageTitle(entity),
    description,
    canonicalPath: seoEntityPath(entity.type, entity.slug),
    keywords: `${entity.name}, medicine portfolio, pharmaceutical company, medicines, generics, therapeutic areas, source-backed medicine data`,
    image: officialProfile?.logo_url || entity.logoUrl || null,
  } : null);

  const related = useMemo(() => buildRelatedLinks(type, products, directory), [type, products, directory]);
  const currency = companyProfile?.source_currency || products.find((product) => product.price_currency)?.price_currency || "";
  const prices = products.map((product) => Number(product.final_price)).filter((value) => Number.isFinite(value) && value > 0);
  const minPrice = companyProfile?.min_price ?? (prices.length ? Math.min(...prices) : null);
  const maxPrice = companyProfile?.max_price ?? (prices.length ? Math.max(...prices) : null);
  const Icon = type === "company" ? Building2 : type === "generic" ? FlaskConical : Activity;
  const directoryPath = type === "company" ? "/companies" : type === "generic" ? "/generics" : "/diseases";
  const imported = companyProfile?.dataset_metadata?.portfolioImported === true;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <a href={directoryPath} className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to directory", "العودة إلى الدليل")}</a>
    {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading connected profile...", "جاري تحميل الملف المترابط...")}</p>}

    {entity && !loading && <>
      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          {officialProfile?.logo_url && <img src={officialProfile.logo_url} alt="" className="h-20 w-20 rounded-xl border bg-background object-contain p-2" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4" />{type === "company" ? t("Healthcare company and medicine portfolio", "شركة رعاية صحية ومحفظة أدوية") : type === "generic" ? t("Generic medicine reference", "مرجع مادة فعالة") : t("Disease-area reference", "مرجع مجال مرضي")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold tracking-tight">{officialProfile?.display_name || entity.name}</h1>{officialProfile && <Badge className="gap-1"><BadgeCheck className="h-3.5 w-3.5" />{t("Official verified profile", "ملف رسمي موثق")}</Badge>}{type === "company" && <Badge variant="outline" className="gap-1"><Database className="h-3.5 w-3.5" />{t("Dataset intelligence", "ذكاء قاعدة البيانات")}</Badge>}</div>
            {type === "company" && cleanCompanyOrigin(companyProfile?.origin || entity.origin || officialProfile?.country) && <p className="mt-2 text-muted-foreground">{t("Origin or headquarters", "المنشأ أو المقر")}: {cleanCompanyOrigin(companyProfile?.origin || entity.origin || officialProfile?.country)}</p>}
            <p className="mt-3 max-w-4xl text-muted-foreground">{description}</p>
          </div>
        </div>
      </section>

      {type === "company" && companyProfile && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{t("Dataset-derived company intelligence", "معلومات الشركة المشتقة من قاعدة البيانات")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Computed from the user-verified medicines dataset and kept separate from official company statements.", "محسوبة من قاعدة الأدوية التي أكد المستخدم توثيقها وتظل منفصلة عن بيانات الشركة الرسمية.")}</p></div><Badge variant={imported ? "secondary" : "outline"}>{imported ? t("Row-level portfolio loaded", "المحفظة التفصيلية محملة") : t("Aggregate portfolio ready", "ملخص المحفظة جاهز")}</Badge></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={t("All source records", "كل سجلات المصدر")} value={companyProfile.product_count} />
          <Metric label={t("Active records", "السجلات النشطة")} value={companyProfile.active_product_count} />
          <Metric label={t("Archived lower-price observations", "ملاحظات السعر الأقل المؤرشفة")} value={companyProfile.archived_product_count} />
          <Metric label={t("Prescription signals", "إشارات الوصفات")} value={companyProfile.prescription_product_count} />
          <Metric label={t("Generics", "المواد الفعالة")} value={companyProfile.generic_count} />
          <Metric label={t("Therapeutic areas", "المجالات العلاجية")} value={companyProfile.disease_area_count} />
          <Metric label={t("Observed minimum", "أقل سعر مرصود")} value={companyProfile.min_price != null ? `${Number(companyProfile.min_price).toLocaleString()} ${companyProfile.source_currency}` : "—"} />
          <Metric label={t("Observed maximum", "أعلى سعر مرصود")} value={companyProfile.max_price != null ? `${Number(companyProfile.max_price).toLocaleString()} ${companyProfile.source_currency}` : "—"} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3"><TagGroup title={t("Leading therapeutic areas", "أبرز المجالات العلاجية")} values={list(companyProfile.therapeutic_areas)} /><TagGroup title={t("Leading generics", "أبرز المواد الفعالة")} values={list(companyProfile.leading_generics)} /><TagGroup title={t("Portfolio sample", "عينة من المحفظة")} values={list(companyProfile.portfolio_sample)} /></div>
        <p className="mt-4 text-xs text-muted-foreground">{t("Source", "المصدر")}: {companyProfile.source_name} · {t("Currency", "العملة")}: {companyProfile.source_currency}{companyProfile.latest_source_update ? ` · ${t("Refreshed", "آخر تحديث")}: ${new Date(companyProfile.latest_source_update).toLocaleDateString()}` : ""}</p>
      </section>}

      {type === "company" && officialProfile && <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />{t("Official company information", "بيانات الشركة الرسمية")}</h2><p className="mt-1 text-sm text-muted-foreground">{humanize(officialProfile.company_type)} · {[officialProfile.city, officialProfile.country].filter(Boolean).join(", ")}</p></div>{officialProfile.website_url && <a href={officialProfile.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border bg-background px-4 py-2 text-sm font-semibold"><Globe2 className="mr-2 h-4 w-4" />{t("Company website", "موقع الشركة")}</a>}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><TagGroup title={t("Therapeutic areas", "المجالات العلاجية")} values={officialProfile.therapeutic_areas} /><TagGroup title={t("Product categories", "فئات المنتجات")} values={officialProfile.product_categories} /><TagGroup title={t("Capabilities", "القدرات")} values={officialProfile.capabilities} /><TagGroup title={t("Patient-support programs", "برامج دعم المرضى")} values={officialProfile.support_programs} /></div>
      </section>}

      {type === "company" && !officialProfile && <section className="mt-6 rounded-2xl border border-dashed p-5"><h2 className="text-lg font-semibold">{t("Represent this company?", "هل تمثل هذه الشركة؟")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("Submit a profile claim. Automated checks score work-email, website-domain, dataset match, and evidence signals; final ownership still requires platform-admin approval.", "أرسل طلب المطالبة بالملف. تفحص الأتمتة بريد العمل ونطاق الموقع ومطابقة قاعدة البيانات وإشارات الأدلة، بينما تظل الموافقة النهائية بيد مسؤول المنصة.")}</p><a href={`/industry?company=${encodeURIComponent(entity.slug)}#participate`} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Claim and verify this profile", "المطالبة بهذا الملف وتوثيقه")}</a></section>}

      {type !== "company" && <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t("Active source listings", "قوائم المصدر النشطة")} value={entity.activeRecords ?? products.length ?? entity.records} /><Metric label={t("Companies", "الشركات")} value={new Set(products.map((product) => product.company_name).filter(Boolean)).size} /><Metric label={type === "disease" ? t("Generics", "المواد الفعالة") : t("Disease areas", "المجالات المرضية")} value={type === "disease" ? new Set(products.map((product) => product.generic_name).filter(Boolean)).size : new Set(products.map((product) => product.disease_name).filter(Boolean)).size} /><Metric label={t("Observed source price range", "نطاق سعر المصدر المرصود")} value={minPrice != null && maxPrice != null ? `${minPrice.toLocaleString()}–${maxPrice.toLocaleString()} ${currency}` : "—"} /></section>}

      {related.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-xl font-semibold">{t("Connected entities", "كيانات مترابطة")}</h2><div className="mt-4 flex flex-wrap gap-2">{related.slice(0, 48).map((item) => <a key={`${item.type}-${item.slug}`} href={seoEntityPath(item.type, item.slug)} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:bg-muted">{item.name}</a>)}</div></section>}

      {type === "company" && contributions.length > 0 && <section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">{t("Approved company contributions", "مساهمات الشركة المعتمدة")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Attributable company-submitted knowledge reviewed before publication.", "معرفة مقدمة من الشركة ومنسوبة إليها وخضعت للمراجعة قبل النشر.")}</p></div><a href="/industry" className="text-sm font-semibold text-primary">{t("Industry network", "شبكة الشركات")}</a></div><div className="mt-4 grid gap-4 md:grid-cols-2">{contributions.map((contribution) => <Card key={contribution.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><CardTitle className="text-lg">{contribution.title}</CardTitle><Badge variant="outline">{humanize(contribution.contribution_type)}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{contribution.summary}</p>{contribution.evidence_urls.length > 0 && <div className="mt-4 flex flex-col gap-1">{contribution.evidence_urls.slice(0, 5).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center break-all text-sm font-semibold text-primary">{t("Open supporting evidence", "فتح الدليل الداعم")}<ExternalLink className="ml-1 h-3.5 w-3.5" /></a>)}</div>}<p className="mt-4 text-xs text-muted-foreground">{t("Published", "نُشر")}: {new Date(contribution.published_at).toLocaleDateString()}</p></CardContent></Card>)}</div></section>}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">{type === "company" ? t("Company medicine portfolio", "محفظة أدوية الشركة") : t("Verified source products", "منتجات مصدرية موثقة")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Independent source records remain separate from official company information and company-contributed knowledge.", "تظل سجلات المصادر المستقلة منفصلة عن معلومات الشركة الرسمية والمعرفة المقدمة منها.")}</p></div>{products.length > 0 && <a href={`/verified-products?${type === "company" ? `company=${encodeURIComponent(entity.slug)}` : `query=${encodeURIComponent(entity.sourceValue || entity.name)}`}`} className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"><Search className="mr-2 h-4 w-4" />{t("Open database search", "فتح بحث قاعدة البيانات")}</a>}</div>
        {type === "company" && <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void loadCompanyProducts(entity.slug, portfolioQuery, 0, false); }}><Input value={portfolioQuery} onChange={(event) => setPortfolioQuery(event.target.value)} placeholder={t("Search this portfolio by product, generic, disease, or variant...", "ابحث داخل المحفظة بالمنتج أو المادة الفعالة أو المرض أو الشكل...")} /><Button type="submit" disabled={loadingProducts}><Search className="mr-2 h-4 w-4" />{t("Search portfolio", "بحث المحفظة")}</Button>{portfolioQuery && <Button type="button" variant="outline" onClick={() => { setPortfolioQuery(""); void loadCompanyProducts(entity.slug, "", 0, false); }}>{t("Reset", "إعادة ضبط")}</Button>}</form>}
        {type === "company" && <p className="mt-3 text-sm text-muted-foreground">{portfolioTotal.toLocaleString()} {t("matching active portfolio records", "سجل نشط مطابق في المحفظة")}</p>}
        {products.length > 0 ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} t={t} />)}</div> : <Card className="mt-4"><CardContent className="p-6 text-sm text-muted-foreground">{type === "company" && list(companyProfile?.portfolio_sample).length > 0 ? <><p>{t("The aggregate portfolio is available while row-level records continue through the controlled import pipeline.", "ملخص المحفظة متاح بينما تستمر السجلات التفصيلية عبر مسار الاستيراد المنضبط.")}</p><div className="mt-3 flex flex-wrap gap-2">{list(companyProfile?.portfolio_sample).map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}</div></> : t("No independent source products are linked yet.", "لا توجد منتجات مرتبطة بمصدر مستقل حتى الآن.")}</CardContent></Card>}
        {type === "company" && products.length < portfolioTotal && <div className="mt-5 flex justify-center"><Button variant="outline" disabled={loadingProducts} onClick={() => void loadCompanyProducts(entity.slug, portfolioQuery, products.length, true)}>{loadingProducts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("Load more portfolio products", "تحميل المزيد من منتجات المحفظة")}</Button></div>}
      </section>

      <Alert className="mt-8"><AlertDescription>{t("Dataset-derived company intelligence describes records in the supplied source dataset; it is not an official corporate claim. Official company information and approved company contributions are separately attributed. Source-market listings do not establish Egyptian registration, local availability, indication, clinical suitability, or Egyptian price. Do not use this page as medical advice.", "تصف معلومات الشركة المشتقة من قاعدة البيانات سجلات المصدر المقدم ولا تمثل ادعاءً رسميًا من الشركة. تُنسب المعلومات الرسمية والمساهمات المعتمدة بشكل منفصل. ولا تثبت قوائم سوق المصدر التسجيل أو التوافر أو دواعي الاستعمال أو الملاءمة العلاجية أو السعر داخل مصر. لا تستخدم هذه الصفحة كنصيحة طبية.")}</AlertDescription></Alert>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>; }
function TagGroup({ title, values }: { title: string; values: string[] }) { return <div><h3 className="text-sm font-semibold">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{values.length > 0 ? values.slice(0, 24).map((value) => <Badge key={value} variant="secondary">{value}</Badge>) : <span className="text-sm text-muted-foreground">—</span>}</div></div>; }
function ProductCard({ product, t }: { product: Product; t: (en: string, ar: string) => string }) {
  const diseaseLabel = product.disease_name ? cleanDiseaseEntityName(product.disease_name) : null;
  return <Card className="h-full shadow-sm"><CardHeader><CardTitle className="text-lg leading-7">{product.product_name}</CardTitle><p className="text-sm text-muted-foreground">{product.generic_name || product.drug_variant || "—"}</p></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex flex-wrap gap-2">{diseaseLabel && <Badge>{diseaseLabel}</Badge>}{product.prescription_required && <Badge variant="outline">{product.prescription_required}</Badge>}{product.final_price != null && <Badge variant="secondary">{Number(product.final_price).toLocaleString()} {product.price_currency}</Badge>}</div>{product.drug_variant && <div><span className="text-xs text-muted-foreground">{t("Variant", "الشكل أو التركيز")}</span><div className="font-medium">{product.drug_variant}</div></div>}{product.company_name && <div><span className="text-xs text-muted-foreground">{t("Company", "الشركة")}</span><div className="font-medium">{product.company_name}</div></div>}{product.drug_content_summary && <p className="line-clamp-3 text-muted-foreground">{product.drug_content_summary}</p>}{product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source listing", "فتح قائمة المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a>}</CardContent></Card>;
}
function buildRelatedLinks(type: SeoEntityType, products: Product[], directory: SeoEntityDirectory | null) {
  const byKey = new Map<string, SeoEntity>();
  for (const entity of directory?.entities || []) { byKey.set(`${entity.type}:${entity.name}`, entity); if (entity.sourceValue) byKey.set(`${entity.type}:${entity.sourceValue}`, entity); }
  const result = new Map<string, SeoEntity>();
  function add(nextType: SeoEntityType, sourceName: string | null, providedSlug?: string | null) {
    if (!sourceName) return;
    const found = byKey.get(`${nextType}:${sourceName}`);
    const publicName = nextType === "disease" ? cleanDiseaseEntityName(sourceName) : sourceName;
    const nextSlug = providedSlug || found?.slug || (nextType === "company" ? "" : seoEntitySlug(publicName));
    if (!nextSlug) return;
    result.set(`${nextType}:${nextSlug}`, found || { type: nextType, name: publicName, sourceValue: sourceName, slug: nextSlug, records: 0 });
  }
  for (const product of products) { if (type !== "company") add("company", product.company_name, product.company_slug); if (type !== "generic") add("generic", product.generic_name); if (type !== "disease") add("disease", product.disease_name); }
  return [...result.values()].sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
}
