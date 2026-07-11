import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Building2, ExternalLink, FlaskConical, Search } from "lucide-react";
import { useRoute } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { usePageSeo } from "@/components/route-seo";
import {
  cleanCompanyOrigin,
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

function routeInfo() {
  return null;
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
        const nextEntity = nextDirectory.entities.find((item) => item.type === type && item.slug === decodeURIComponent(slug)) || null;
        if (!nextEntity) throw new Error(t("This public entity page was not found.", "لم يتم العثور على هذه الصفحة العامة."));

        const productSelect = "id,product_name,product_url,disease_name,final_price,price_currency,prescription_required,drug_variant,company_name,company_slug,generic_name,drug_content_summary";
        const filter = type === "company"
          ? `company_slug=eq.${exact(nextEntity.slug)}`
          : type === "generic"
            ? `generic_name=eq.${exact(nextEntity.name)}`
            : `disease_name=eq.${exact(nextEntity.name)}`;
        const productRows = await supabaseFetch<Product[]>(`/rest/v1/verified_medicine_source_products?select=${productSelect}&duplicate_status=eq.active&${filter}&order=final_price.desc.nullslast&limit=100`);

        let profile: CompanyProfile | null = null;
        if (type === "company") {
          const profileSelect = "id,company_name,company_slug,origin,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price";
          const profileRows = await supabaseFetch<CompanyProfile[]>(`/rest/v1/medicine_company_profiles?select=${profileSelect}&company_slug=eq.${exact(nextEntity.slug)}&limit=1`);
          profile = profileRows[0] || null;
        }

        if (cancelled) return;
        setDirectory(nextDirectory);
        setEntity(nextEntity);
        setProducts(productRows);
        setCompanyProfile(profile);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("Could not load this page.", "تعذر تحميل الصفحة."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [slug, type]);

  const title = entity?.name || t("Public medicine entity", "كيان دوائي عام");
  const canonicalPath = entity ? seoEntityPath(entity.type, entity.slug) : "/";
  const description = entity
    ? type === "company"
      ? `${entity.name} pharmaceutical company profile with ${Number(entity.activeRecords ?? entity.records).toLocaleString()} active source-backed products, ${Number(entity.genericCount || 0).toLocaleString()} generics, and ${Number(entity.diseaseCount || 0).toLocaleString()} disease areas.`
      : type === "generic"
        ? `${entity.name} generic medicine reference connecting ${entity.records.toLocaleString()} active source-backed products, companies, disease areas, prescription signals, and observed source-market prices.`
        : `${entity.name} medicine product reference connecting ${entity.records.toLocaleString()} active source-backed products, generics, companies, prescription signals, and observed source-market prices.`
    : "Source-backed medicine entity page.";

  usePageSeo(entity ? {
    title: `${title} | Medicine Support Hub`,
    description,
    canonicalPath,
    keywords: `${title}, medicine products, pharmaceutical companies, generic medicines, source-backed medicine data`,
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
    {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading source-backed page...", "جاري تحميل الصفحة المدعومة بالمصدر...")}</p>}

    {entity && !loading && <>
      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4" />{type === "company" ? t("Pharmaceutical company profile", "ملف شركة أدوية") : type === "generic" ? t("Generic medicine reference", "مرجع مادة فعالة") : t("Disease-area reference", "مرجع مجال مرضي")}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{entity.name}</h1>
        {type === "company" && cleanCompanyOrigin(companyProfile?.origin || entity.origin) && <p className="mt-2 text-muted-foreground">{t("Source-market origin", "منشأ سوق المصدر")}: {cleanCompanyOrigin(companyProfile?.origin || entity.origin)}</p>}
        <p className="mt-3 max-w-4xl text-muted-foreground">{description}</p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("Active listings", "القوائم النشطة")} value={products.length || entity.records} />
        <Metric label={type === "company" ? t("Generics", "المواد الفعالة") : t("Companies", "الشركات")} value={type === "company" ? companyProfile?.generic_count ?? entity.genericCount ?? 0 : new Set(products.map((product) => product.company_name).filter(Boolean)).size} />
        <Metric label={type === "disease" ? t("Generics", "المواد الفعالة") : t("Disease areas", "المجالات المرضية")} value={type === "disease" ? new Set(products.map((product) => product.generic_name).filter(Boolean)).size : type === "company" ? companyProfile?.disease_area_count ?? entity.diseaseCount ?? 0 : new Set(products.map((product) => product.disease_name).filter(Boolean)).size} />
        <Metric label={t("Observed price range", "نطاق السعر المرصود")} value={minPrice != null && maxPrice != null ? `${minPrice.toLocaleString()}–${maxPrice.toLocaleString()} ${currency}` : "—"} />
      </section>

      {related.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">{t("Connected entities", "كيانات مترابطة")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">{related.slice(0, 36).map((item) => <a key={`${item.type}-${item.slug}`} href={seoEntityPath(item.type, item.slug)} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:bg-muted">{item.name}</a>)}</div>
      </section>}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">{t("Verified source products", "منتجات مصدرية موثقة")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Active records are shown with source attribution and observed source-market pricing.", "تظهر السجلات النشطة مع نسبها إلى المصدر والأسعار المرصودة في سوق المصدر.")}</p></div>
          <a href={`/verified-products?${type === "company" ? `company=${encodeURIComponent(entity.slug)}` : `query=${encodeURIComponent(entity.name)}`}`} className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"><Search className="mr-2 h-4 w-4" />{t("Open database search", "فتح بحث قاعدة البيانات")}</a>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} t={t} />)}</div>
      </section>

      <Alert className="mt-8"><AlertDescription>{t("This page summarizes a user-verified source dataset. Source-market listings and prices do not establish Egyptian registration, local availability, indication, clinical suitability, or Egyptian price. Do not use this page as medical advice.", "تلخص هذه الصفحة مجموعة بيانات مصدرية موثقة من المستخدم. القوائم والأسعار في سوق المصدر لا تثبت التسجيل أو التوافر أو دواعي الاستعمال أو الملاءمة العلاجية أو السعر داخل مصر. لا تستخدم هذه الصفحة كنصيحة طبية.")}</AlertDescription></Alert>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>;
}

function ProductCard({ product, t }: { product: Product; t: (en: string, ar: string) => string }) {
  return <Card className="h-full shadow-sm">
    <CardHeader><CardTitle className="text-lg leading-7">{product.product_name}</CardTitle><p className="text-sm text-muted-foreground">{product.generic_name || product.drug_variant || "—"}</p></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">{product.disease_name && <Badge>{product.disease_name}</Badge>}{product.prescription_required && <Badge variant="outline">{product.prescription_required}</Badge>}{product.final_price != null && <Badge variant="secondary">{Number(product.final_price).toLocaleString()} {product.price_currency}</Badge>}</div>
      {product.company_name && <div><span className="text-xs text-muted-foreground">{t("Company", "الشركة")}</span><div className="font-medium">{product.company_name}</div></div>}
      {product.drug_content_summary && <p className="line-clamp-3 text-muted-foreground">{product.drug_content_summary}</p>}
      {product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source listing", "فتح قائمة المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
    </CardContent>
  </Card>;
}

function buildRelatedLinks(type: SeoEntityType, products: Product[], directory: SeoEntityDirectory | null) {
  const byKey = new Map<string, SeoEntity>();
  for (const entity of directory?.entities || []) byKey.set(`${entity.type}:${entity.name}`, entity);
  const result = new Map<string, SeoEntity>();
  function add(nextType: SeoEntityType, name: string | null, providedSlug?: string | null) {
    if (!name) return;
    const found = byKey.get(`${nextType}:${name}`);
    const slug = providedSlug || found?.slug || (nextType === "company" ? "" : seoEntitySlug(name));
    if (!slug) return;
    result.set(`${nextType}:${slug}`, found || { type: nextType, name, slug, records: 0 });
  }
  for (const product of products) {
    if (type !== "company") add("company", product.company_name, product.company_slug);
    if (type !== "generic") add("generic", product.generic_name);
    if (type !== "disease") add("disease", product.disease_name);
  }
  return [...result.values()].sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
}
