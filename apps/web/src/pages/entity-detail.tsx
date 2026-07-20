import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Database,
  ExternalLink,
  FlaskConical,
  Globe2,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRoute } from "wouter";
import { EntitySocialPanel } from "@/components/entity-social-panel";
import { CompanyDistributionNetwork } from "@/components/company-distribution-network";
import { PublicKnowledgePanel } from "@/components/public-knowledge-panel";
import { ShareContributeActions } from "@/components/share-contribute-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import {
  cleanCompanyOrigin,
  cleanCompanyRouteSlug,
  cleanDiseaseEntityName,
  fetchSeoEntityDirectory,
  resolveCompanyRouteSlug,
  seoEntityPath,
  seoEntitySlug,
  type SeoEntity,
  type SeoEntityDirectory,
  type SeoEntityType,
} from "@/lib/seo-entities";

import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";

interface CompanyProfile {
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
}

interface OfficialProfile {
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
  services: string[];
  differentiators: string | null;
  support_programs: string[];
  verification_status: string;
}

interface CompanyContribution {
  id: string;
  contribution_type: string;
  title: string;
  summary: string;
  evidence_urls: string[];
  published_at: string;
}

interface Product {
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
  drug_content_summary?: string | null;
  total_count?: number;
}

interface CanonicalGenericProduct {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  category: string | null;
  drug_class: string | null;
  route: string | null;
  current_price_egp: number | null;
  price_currency: string | null;
  total_count: number;
}

interface CanonicalDiseaseFacet {
  facet_type: "drug_class" | "category";
  facet_value: string;
  product_count: number;
}

const PAGE_SIZE = 60;
const encode = (value: string) => encodeURIComponent(value);
const list = (value: string[] | null | undefined) =>
  Array.isArray(value) ? value.filter(Boolean) : [];
const humanize = (value: string) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};
const companyRelationshipRoles = (profile: CompanyProfile) => {
  const roles = profile.dataset_metadata?.relationshipRoles;
  return Array.isArray(roles)
    ? roles.filter((role): role is MedicineCompanyRole =>
        ["manufacturer", "toll_manufacturer", "trademark_owner"].includes(
          String(role),
        ),
      )
    : [];
};
const companyRelationshipCount = (
  profile: CompanyProfile,
  role: MedicineCompanyRole,
) =>
  Number(
    profile.dataset_metadata?.[
      role === "manufacturer"
        ? "manufacturerProducts"
        : role === "toll_manufacturer"
          ? "tollManufacturedProducts"
          : "trademarkOwnedProducts"
    ] || 0,
  );

function pageTitle(entity: SeoEntity) {
  if (entity.type === "company")
    return `${entity.name} Medicines, Portfolio and Company Profile | Medicine Support Hub`;
  if (entity.type === "generic")
    return `${entity.name} Products and Source Evidence | Medicine Support Hub`;
  return `${entity.name} Medicine Products | Medicine Support Hub`;
}

export default function EntityDetail() {
  const [companyRoute, companyParams] = useRoute("/companies/:slug");
  const [genericRoute, genericParams] = useRoute("/generics/:slug");
  const [, diseaseParams] = useRoute("/diseases/:slug");
  const type: SeoEntityType = companyRoute
    ? "company"
    : genericRoute
      ? "generic"
      : "disease";
  const slug = companyRoute
    ? companyParams?.slug
    : genericRoute
      ? genericParams?.slug
      : diseaseParams?.slug;
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [directory, setDirectory] = useState<SeoEntityDirectory | null>(null);
  const [entity, setEntity] = useState<SeoEntity | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [officialProfile, setOfficialProfile] =
    useState<OfficialProfile | null>(null);
  const [contributions, setContributions] = useState<CompanyContribution[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanyProducts(
    companySlug: string,
    search: string,
    offset = 0,
    append = false,
  ) {
    setLoadingProducts(true);
    try {
      const rows = await supabaseFetch<Product[]>(
        `/rest/v1/rpc/company_medicine_portfolio_page?p_company_slug=${encode(companySlug)}&p_query=${encode(search.trim())}&p_limit=${PAGE_SIZE}&p_offset=${offset}`,
      );
      const safeRows = Array.isArray(rows) ? rows : [];
      setProducts((current) => (append ? [...current, ...safeRows] : safeRows));
      setPortfolioTotal(
        Number(
          safeRows[0]?.total_count ??
            (append ? offset + safeRows.length : safeRows.length),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              "Could not load this medicine portfolio.",
              "تعذر تحميل محفظة الأدوية.",
            ),
      );
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
      setProducts([]);
      try {
        const normalizedSlug = safeDecode(slug);
        let nextDirectory: SeoEntityDirectory | null = null;
        try {
          nextDirectory = await fetchSeoEntityDirectory();
        } catch {
          nextDirectory = null;
        }
        const resolvedSlug =
          type === "company"
            ? resolveCompanyRouteSlug(nextDirectory, normalizedSlug)
            : normalizedSlug;
        let nextEntity =
          nextDirectory?.entities.find(
            (item) => item.type === type && item.slug === resolvedSlug,
          ) ?? null;
        if (
          !nextEntity &&
          type === "generic" &&
          typeof window !== "undefined"
        ) {
          const publicName = new URLSearchParams(window.location.search)
            .get("name")
            ?.trim();
          if (publicName)
            nextEntity = {
              type: "generic",
              name: publicName,
              sourceValue: publicName,
              slug: normalizedSlug,
              records: 0,
            };
        }
        const fetchCanonicalGenericProducts = (genericName: string) =>
          supabaseFetch<CanonicalGenericProduct[]>(
            "/rest/v1/rpc/search_medicine_encyclopedia_v4",
            {
              method: "POST",
              body: JSON.stringify({
                p_query: "",
                p_manufacturer: null,
                p_drug_class: null,
                p_route: null,
                p_category: null,
                p_scientific_name: genericName,
                p_source_system: null,
                p_min_price: null,
                p_max_price: null,
                p_has_price_history: null,
                p_verified_only: null,
                p_has_marketplace_offers: null,
                p_has_image: null,
                p_min_completeness: null,
                p_query_mode: "all",
                p_sort: "best",
                p_limit: 100,
                p_offset: 0,
              }),
            },
          );
        const fetchCanonicalDiseaseProducts = (
          diseaseName: string,
          facetType: CanonicalDiseaseFacet["facet_type"],
        ) =>
          supabaseFetch<CanonicalGenericProduct[]>(
            "/rest/v1/rpc/search_medicine_encyclopedia_v4",
            {
              method: "POST",
              body: JSON.stringify({
                p_query: "",
                p_manufacturer: null,
                p_drug_class: facetType === "drug_class" ? diseaseName : null,
                p_route: null,
                p_category: facetType === "category" ? diseaseName : null,
                p_scientific_name: null,
                p_source_system: null,
                p_min_price: null,
                p_max_price: null,
                p_has_price_history: null,
                p_verified_only: null,
                p_has_marketplace_offers: null,
                p_has_image: null,
                p_min_completeness: null,
                p_query_mode: "all",
                p_sort: "best",
                p_limit: 100,
                p_offset: 0,
              }),
            },
          );
        let canonicalGenericRows: CanonicalGenericProduct[] | null = null;
        let canonicalDiseaseRows: CanonicalGenericProduct[] | null = null;
        let canonicalDiseaseFacet: CanonicalDiseaseFacet | null = null;
        if (!nextEntity && type === "generic") {
          const genericHint = normalizedSlug
            .replace(/-[a-z0-9]{1,7}$/i, "")
            .replaceAll("-", " ")
            .trim();
          canonicalGenericRows =
            await fetchCanonicalGenericProducts(genericHint);
          const resolvedName = Array.from(
            new Set(
              canonicalGenericRows
                .map((row) => row.scientific_name?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          ).find((value) => seoEntitySlug(value) === normalizedSlug);
          if (resolvedName)
            nextEntity = {
              type: "generic",
              name: resolvedName,
              sourceValue: resolvedName,
              slug: normalizedSlug,
              records: Number(
                canonicalGenericRows[0]?.total_count ||
                  canonicalGenericRows.length,
              ),
            };
        }
        if (!nextEntity && type === "disease") {
          const diseaseHint = normalizedSlug
            .replace(/-[a-z0-9]{1,7}$/i, "")
            .split("-")
            .filter(Boolean)
            .join("*");
          const matchingFacets = await supabaseFetch<CanonicalDiseaseFacet[]>(
            `/rest/v1/medicine_search_facets_cache_v1?select=facet_type,facet_value,product_count&facet_type=in.(drug_class,category)&facet_value=ilike.${encode(`*${diseaseHint}*`)}&order=product_count.desc&limit=100`,
          );
          canonicalDiseaseFacet =
            matchingFacets.find(
              (facet) =>
                seoEntitySlug(cleanDiseaseEntityName(facet.facet_value)) ===
                normalizedSlug,
            ) ?? null;
          if (canonicalDiseaseFacet) {
            canonicalDiseaseRows = await fetchCanonicalDiseaseProducts(
              canonicalDiseaseFacet.facet_value,
              canonicalDiseaseFacet.facet_type,
            );
            nextEntity = {
              type: "disease",
              name: cleanDiseaseEntityName(canonicalDiseaseFacet.facet_value),
              sourceValue: canonicalDiseaseFacet.facet_value,
              slug: normalizedSlug,
              records: Number(
                canonicalDiseaseRows[0]?.total_count ||
                  canonicalDiseaseFacet.product_count ||
                  canonicalDiseaseRows.length,
              ),
            };
          }
        }

        if (type === "company") {
          const sourceSelect =
            "id,company_name,company_slug,origin,source_name,source_currency,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price,therapeutic_areas,leading_generics,portfolio_sample,dataset_metadata,latest_source_update";
          const officialSelect =
            "id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,services,differentiators,support_programs,verification_status";
          const [sourceRows, officialRows, contributionRows] =
            await Promise.all([
              supabaseFetch<CompanyProfile[]>(
                `/rest/v1/medicine_company_profiles?select=${sourceSelect}&company_slug=eq.${encode(resolvedSlug)}&limit=1`,
              ),
              supabaseFetch<OfficialProfile[]>(
                `/rest/v1/industry_company_profiles?select=${officialSelect}&company_slug=eq.${encode(resolvedSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1`,
              ),
              supabaseFetch<CompanyContribution[]>(
                `/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.${encode(resolvedSlug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`,
              ),
            ]);
          const source = sourceRows[0] ?? null;
          const official = officialRows[0] ?? null;
          if (!nextEntity && source)
            nextEntity = {
              type: "company",
              name: source.company_name,
              sourceValue: source.company_name,
              slug: source.company_slug,
              records: source.product_count,
              activeRecords: source.active_product_count,
              genericCount: source.generic_count,
              diseaseCount: source.disease_area_count,
              minPrice: source.min_price,
              maxPrice: source.max_price,
              origin: source.origin,
            };
          if (!nextEntity && official)
            nextEntity = {
              type: "company",
              name: official.display_name,
              sourceValue: official.display_name,
              slug: official.company_slug,
              records: 0,
            };
          if (!nextEntity)
            throw new Error(
              t(
                "This public company profile was not found.",
                "لم يتم العثور على ملف الشركة العام.",
              ),
          if (cancelled) return;
          setDirectory(nextDirectory);
          setEntity(nextEntity);
          setCompanyProfile(source);
          setOfficialProfile(official);
          setContributions(contributionRows || []);
          const cleanRouteSlug = cleanCompanyRouteSlug(resolvedSlug) || resolvedSlug;
          if (cleanRouteSlug !== normalizedSlug && typeof window !== "undefined") {
            window.history.replaceState(
              {},
              "",
              `/companies/${encodeURIComponent(cleanRouteSlug)}${window.location.search}${window.location.hash}`,
            );
          }

          await loadCompanyProducts(resolvedSlug, "");
        } else {
          if (!nextEntity)
            throw new Error(
              t(
                "This public entity page was not found.",
                "لم يتم العثور على هذه الصفحة العامة.",
              ),
            );
          const sourceValue = nextEntity.sourceValue || nextEntity.name;
          let productRows: Product[];
          if (type === "generic") {
            const rows =
              canonicalGenericRows &&
              canonicalGenericRows.some(
                (row) => row.scientific_name === sourceValue,
              )
                ? canonicalGenericRows.filter(
                    (row) => row.scientific_name === sourceValue,
                  )
                : await fetchCanonicalGenericProducts(sourceValue);
            productRows = rows.map((row) => ({
              id: String(row.canonical_id),
              product_name:
                row.name_en || row.name_ar || `Medicine #${row.canonical_id}`,
              product_url: `/catalog/${row.canonical_id}`,
              disease_name: row.category,
              final_price: row.current_price_egp,
              price_currency: row.price_currency || "EGP",
              prescription_required: null,
              drug_variant: row.route,
              company_name: row.manufacturer,
              company_slug: null,
              generic_name: row.scientific_name,
              drug_content_summary: null,
              total_count: row.total_count,
            }));
          } else {
            const facet =
              canonicalDiseaseFacet ||
              ({
                facet_type: "drug_class",
                facet_value: sourceValue,
                product_count: nextEntity.records,
              } satisfies CanonicalDiseaseFacet);
            const rows =
              canonicalDiseaseRows ||
              (await fetchCanonicalDiseaseProducts(
                facet.facet_value,
                facet.facet_type,
              ));
            productRows = rows.map((row) => ({
              id: String(row.canonical_id),
              product_name:
                row.name_en || row.name_ar || `Medicine #${row.canonical_id}`,
              product_url: `/catalog/${row.canonical_id}`,
              disease_name:
                facet.facet_type === "drug_class"
                  ? row.drug_class
                  : row.category,
              final_price: row.current_price_egp,
              price_currency: row.price_currency || "EGP",
              prescription_required: null,
              drug_variant: row.route,
              company_name: row.manufacturer,
              company_slug: null,
              generic_name: row.scientific_name,
              drug_content_summary: null,
              total_count: row.total_count,
            }));
          }
          if (cancelled) return;
          setDirectory(nextDirectory);
          setEntity(nextEntity);
          setProducts(productRows || []);
          setPortfolioTotal(productRows?.length || 0);
          setCompanyProfile(null);
          setOfficialProfile(null);
          setContributions([]);
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : t("Could not load this page.", "تعذر تحميل الصفحة."),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, type]);

  const activeCount =
    type === "company"
      ? portfolioTotal ||
        entity?.records ||
        companyProfile?.active_product_count ||
        0
      : (entity?.activeRecords ?? entity?.records ?? 0);
  const genericCount =
    companyProfile?.generic_count ?? entity?.genericCount ?? 0;
  const diseaseCount =
    companyProfile?.disease_area_count ?? entity?.diseaseCount ?? 0;
  const description = entity
    ? officialProfile?.description ||
      (type === "company"
        ? `${entity.name} company intelligence profile connecting ${Number(activeCount).toLocaleString()} active source-backed medicine records, ${Number(genericCount).toLocaleString()} generics, and ${Number(diseaseCount).toLocaleString()} therapeutic areas.`
        : `${entity.name} medicine reference connecting ${entity.records.toLocaleString()} active source-backed products, companies, generics, disease areas, prescription signals, and observed source-market prices.`)
    : "Source-backed medicine entity page.";

  usePageSeo(
    entity
      ? {
          title: pageTitle(entity),
          description,
          canonicalPath: seoEntityPath(entity.type, entity.slug),
          keywords: `${entity.name}, medicine portfolio, pharmaceutical company, medicines, generics, therapeutic areas, source-backed medicine data`,
          image: officialProfile?.logo_url || entity.logoUrl || null,
        }
      : null,
  );

  const related = useMemo(
    () => buildRelatedLinks(type, products, directory),
    [type, products, directory],
  );
  const currency =
    companyProfile?.source_currency ||
    products.find((product) => product.price_currency)?.price_currency ||
    "";
  const prices = products
    .map((product) => Number(product.final_price))
    .filter((value) => Number.isFinite(value) && value > 0);
  const minPrice =
    companyProfile?.min_price ?? (prices.length ? Math.min(...prices) : null);
  const maxPrice =
    companyProfile?.max_price ?? (prices.length ? Math.max(...prices) : null);
  const Icon =
    type === "company"
      ? Building2
      : type === "generic"
        ? FlaskConical
        : Activity;
  const directoryPath =
    type === "company"
      ? "/companies"
      : type === "generic"
        ? "/generics"
        : "/diseases";
  const imported = companyProfile?.dataset_metadata?.portfolioImported === true;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <a
        href={directoryPath}
        className="inline-flex items-center text-sm font-semibold text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("Back to directory", "العودة إلى الدليل")}
      </a>
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t("Loading connected profile...", "جاري تحميل الملف المترابط...")}
        </p>
      )}

      {entity && !loading && (
          <section id="about" className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              {officialProfile?.logo_url || entity.logoUrl ? (
                <img
                  src={officialProfile?.logo_url || entity.logoUrl || ""}
                  alt={officialProfile?.display_name || entity.name}
                  className="h-20 w-20 flex-shrink-0 rounded-xl border bg-background object-contain p-2 shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-blue-500/10 to-emerald-500/20 border border-primary/20 text-2xl font-bold text-primary shadow-inner">
                  {(officialProfile?.display_name || entity.name || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {type === "company"
                    ? t(
                        "Healthcare company and medicine portfolio",
                        "شركة رعاية صحية ومحفظة أدوية",
                      )
                    : t("Medicine evidence reference", "مرجع أدلة دوائية")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {officialProfile?.display_name || entity.name}
                  </h1>
                  {officialProfile && (
                    <Badge className="gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {t("Official verified profile", "ملف رسمي موثق")}
                    </Badge>
                  )}
                  {type === "company" && (
                    <Badge variant="outline" className="gap-1">
                      <Database className="h-3.5 w-3.5" />
                      {t("Encyclopedia intelligence", "ذكاء الموسوعة")}
                    </Badge>
                  )}
                </div>
                {type === "company" &&
                  cleanCompanyOrigin(
                    companyProfile?.origin ||
                      entity.origin ||
                      officialProfile?.country,
                  ) && (
                    <p className="mt-2 text-muted-foreground">
                      {t("Origin or headquarters", "المنشأ أو المقر")}:{" "}
                      {cleanCompanyOrigin(
                        companyProfile?.origin ||
                          entity.origin ||
                          officialProfile?.country,
                      )}
                    </p>
                  )}
                <p className="mt-3 max-w-4xl text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            {/* Lower Part of Card: 3 Primary Action Buttons */}
            {type === "company" && (
              <div className="mt-6 pt-4 border-t border-border/80 flex flex-wrap items-center gap-3">
                <Button
                  variant="default"
                  className="gap-2 font-semibold shadow-sm"
                  onClick={() => {
                    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Building2 className="h-4 w-4" />
                  {t("About", "عن الشركة")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 font-semibold border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
                  onClick={() => {
                    const el = document.getElementById("contacts") || document.getElementById("official-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Globe2 className="h-4 w-4" />
                  {t("Contacts", "الاتصال والتواصل")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => {
                    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Database className="h-4 w-4" />
                  {t("Products", "الأدوية والمنتجات")}
                </Button>
              </div>
            )}
          </section>

          <div className="mt-4">
            <ShareContributeActions
              title={officialProfile?.display_name || entity.name}
              contributionUrl={
                type === "company"
                  ? `/industry?company=${encode(entity.slug)}#participate`
                  : `/industry?entity=${encode(entity.name)}#participate`
              }
            />
          </div>
          <PublicKnowledgePanel
            type={type === "disease" ? "therapeutic-category" : type}
            name={officialProfile?.display_name || entity.name}
          />
          {type === "company" && companyProfile && (
            <DatasetSection
              profile={companyProfile}
              imported={imported}
              canonicalPortfolioTotal={portfolioTotal}
              t={t}
            />
          {type === "company" && officialProfile && (
            <div id="contacts">
              <OfficialSection profile={officialProfile} t={t} />
            </div>
          )}
            <section className="mt-6 rounded-2xl border border-dashed p-5">
              <h2 className="text-lg font-semibold">
                {t("Represent this company?", "هل تمثل هذه الشركة؟")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "Submit a profile claim. Automated checks score work-email, website-domain, dataset match, and evidence signals; final ownership still requires platform-admin approval.",
                  "أرسل طلب المطالبة بالملف. تفحص الأتمتة بريد العمل ونطاق الموقع ومطابقة قاعدة البيانات وإشارات الأدلة، بينما تظل الموافقة النهائية بيد مسؤول المنصة.",
                )}
              </p>
              <a
                href={`/industry?company=${encode(entity.slug)}#participate`}
                className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t(
                  "Claim and verify this profile",
                  "المطالبة بهذا الملف وتوثيقه",
                )}
              </a>
            </section>
          )}

          {type === "generic" && (
            <div className="mt-5">
              <Button asChild>
                <a
                  href={`/medicines?scientific=${encodeURIComponent(entity.name)}`}
                >
                  {t(
                    "Browse canonical medicines with this active ingredient",
                    "تصفح الأدوية الموحدة بهذه المادة الفعالة",
                  )}
                </a>
              </Button>
            </div>
          )}

          {type !== "company" && (
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={t("Active source listings", "قوائم المصدر النشطة")}
                value={
                  entity.activeRecords ?? products.length ?? entity.records
                }
              />
              <Metric
                label={t("Companies", "الشركات")}
                value={
                  new Set(
                    products
                      .map((product) => product.company_name)
                      .filter(Boolean),
                  ).size
                }
              />
              <Metric
                label={
                  type === "disease"
                    ? t("Generics", "المواد الفعالة")
                    : t("Disease areas", "المجالات المرضية")
                }
                value={
                  type === "disease"
                    ? new Set(
                        products
                          .map((product) => product.generic_name)
                          .filter(Boolean),
                      ).size
                    : new Set(
                        products
                          .map((product) => product.disease_name)
                          .filter(Boolean),
                      ).size
                }
              />
              <Metric
                label={t(
                  "Observed source price range",
                  "نطاق سعر المصدر المرصود",
                )}
                value={
                  minPrice != null && maxPrice != null
                    ? `${minPrice.toLocaleString()}–${maxPrice.toLocaleString()} ${currency}`
                    : "—"
                }
              />
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-semibold">
                {t("Connected entities", "كيانات مترابطة")}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {related.slice(0, 48).map((item) => (
                  <a
                    key={`${item.type}-${item.slug}`}
                    href={seoEntityPath(item.type, item.slug)}
                    className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary/50 hover:bg-muted"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </section>
          )}

          {type === "company" && contributions.length > 0 && (
            <section className="mt-6">
              <h2 className="text-2xl font-semibold">
                {t("Approved company contributions", "مساهمات الشركة المعتمدة")}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {contributions.map((contribution) => (
                  <Card key={contribution.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-lg">
                          {contribution.title}
                        </CardTitle>
                        <Badge variant="outline">
                          {humanize(contribution.contribution_type)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {contribution.summary}
                      </p>
                      {contribution.evidence_urls.length > 0 && (
                        <div className="mt-4 flex flex-col gap-1">
                          {contribution.evidence_urls.slice(0, 5).map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center break-all text-sm font-semibold text-primary"
                            >
                              {t(
                                "Open supporting evidence",
                                "فتح الدليل الداعم",
                              )}
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section id="products" className="mt-6">
              <h2 className="text-2xl font-semibold">
                {type === "company"
                  ? t("Company medicine portfolio", "محفظة أدوية الشركة")
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {type === "company"
                        "Every medicine below links back to its canonical encyclopedia page.",
                        "كل دواء أدناه يرتبط بصفحته في الموسوعة الموحدة.",
                      )
                    : t(
                        "Independent source records remain separate from official company information.",
                        "تظل سجلات المصادر المستقلة منفصلة عن معلومات الشركة الرسمية.",
                      )}
                </p>
              </div>
            </div>
            {type === "company" && (
              <form
                className="mt-4 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadCompanyProducts(entity.slug, portfolioQuery);
                }}
              >
                <Input
                  value={portfolioQuery}
                  onChange={(event) => setPortfolioQuery(event.target.value)}
                  placeholder={t(
                    "Search this portfolio by product, generic, therapy, or form...",
                    "ابحث داخل المحفظة بالمنتج أو المادة الفعالة أو المجال أو الشكل...",
                  )}
                />
                <Button type="submit" disabled={loadingProducts}>
                  <Search className="mr-2 h-4 w-4" />
                  {t("Search portfolio", "بحث المحفظة")}
                </Button>
                {portfolioQuery && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPortfolioQuery("");
                      void loadCompanyProducts(entity.slug, "");
                    }}
                  >
                    {t("Reset", "إعادة ضبط")}
                  </Button>
                )}
              </form>
            )}
            {type === "company" && (
              <p className="mt-3 text-sm text-muted-foreground">
                {portfolioTotal.toLocaleString()}{" "}
                {t(
                  "matching canonical medicine records",
                  "سجل دواء موحد مطابق",
                )}
              </p>
            )}
            {products.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} t={t} />
                ))}
              </div>
            ) : (
              <PortfolioEmpty profile={companyProfile} type={type} t={t} />
            )}
            {type === "company" && products.length < portfolioTotal && (
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  disabled={loadingProducts}
                  onClick={() =>
                    void loadCompanyProducts(
                      entity.slug,
                      portfolioQuery,
                      products.length,
                      true,
                    )
                  }
                >
                  {loadingProducts && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t(
                    "Load more portfolio medicines",
                    "تحميل المزيد من أدوية المحفظة",
                  )}
                </Button>
              </div>
            )}
          </section>

          {type === "company" && officialProfile && (
            <CompanyDistributionNetwork companyProfileId={officialProfile.id} />
          )}
          {type === "company" && (
            <EntitySocialPanel
              entityType="company"
              entityKey={entity.slug}
              companySlug={entity.slug}
              title={officialProfile?.display_name || entity.name}
            />
          )}
          <Alert className="mt-8">
            <AlertDescription>
              {t(
                "Dataset-derived company intelligence describes encyclopedia and attributed source records; it is not an official corporate claim. Official information is separately verified. Medicine pages, community observations, and portfolio listings do not replace licensed medical advice or regulatory verification.",
                "تصف معلومات الشركة المشتقة سجلات الموسوعة والمصادر المنسوبة ولا تمثل ادعاءً رسميًا من الشركة. يتم توثيق المعلومات الرسمية بشكل منفصل. صفحات الأدوية وملاحظات المجتمع وقوائم المحافظ لا تستبدل النصيحة الطبية المرخصة أو التحقق التنظيمي.",
              )}
            </AlertDescription>
          </Alert>
        </>
      )}
    </main>
  );
}

function DatasetSection({
  profile,
  imported,
  canonicalPortfolioTotal,
  t,
}: {
  profile: CompanyProfile;
  imported: boolean;
  canonicalPortfolioTotal: number;
  t: (en: string, ar: string) => string;
}) {
  const roles = companyRelationshipRoles(profile);
  return (
    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {t(
              "Encyclopedia-derived company intelligence",
              "معلومات الشركة المشتقة من الموسوعة",
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "Computed from canonical medicine-company relationships. Toll manufacturers and trademark owners remain separate entities and are kept separate from official company statements.",
              "محسوبة من علاقات الأدوية بالشركات في الموسوعة الموحدة. يظل المصنعون لحساب الغير ومالكو العلامات التجارية كيانات منفصلة، كما تظل هذه البيانات منفصلة عن بيانات الشركة الرسمية.",
            )}
          </p>
        </div>
        <Badge variant={imported ? "secondary" : "outline"}>
          {imported
            ? t("Canonical portfolio loaded", "المحفظة الموحدة محملة")
            : t("Aggregate portfolio ready", "ملخص المحفظة جاهز")}
        </Badge>
      </div>
      {roles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <Badge
              key={role}
              variant={role === "trademark_owner" ? "secondary" : "outline"}
            >
              {medicineCompanyRoleLabel(role, t)} ·{" "}
              {companyRelationshipCount(profile, role).toLocaleString()}{" "}
              {t("medicines", "دواء")}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t("Canonical portfolio medicines", "أدوية المحفظة الموحدة")}
          value={canonicalPortfolioTotal || profile.active_product_count}
        />
        <Metric
          label={t("Generics", "المواد الفعالة")}
          value={profile.generic_count}
        />
        <Metric
          label={t("Therapeutic categories", "الفئات العلاجية")}
          value={profile.disease_area_count}
        />
        <Metric
          label={t("Observed price range", "نطاق السعر المرصود")}
          value={
            profile.min_price != null && profile.max_price != null
              ? `${Number(profile.min_price).toLocaleString()}–${Number(profile.max_price).toLocaleString()} ${profile.source_currency}`
              : "—"
          }
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <TagGroup
          title={t("Leading therapeutic categories", "أبرز الفئات العلاجية")}
          values={list(profile.therapeutic_areas)}
          hrefFor={(value) =>
            seoEntityPath(
              "disease",
              seoEntitySlug(cleanDiseaseEntityName(value)),
            )
          }
        />
        <TagGroup
          title={t("Leading generics", "أبرز المواد الفعالة")}
          values={list(profile.leading_generics)}
          hrefFor={(value) => seoEntityPath("generic", seoEntitySlug(value))}
        />
        <TagGroup
          title={t("Portfolio sample", "عينة من المحفظة")}
          values={list(profile.portfolio_sample)}
          hrefFor={(value) => `/medicines?q=${encode(value)}`}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {t("Source", "المصدر")}: {profile.source_name} ·{" "}
        {t("Currency", "العملة")}: {profile.source_currency}
        {profile.latest_source_update
          ? ` · ${t("Refreshed", "آخر تحديث")}: ${new Date(profile.latest_source_update).toLocaleDateString()}`
          : ""}
      </p>
    </section>
  );
}

function OfficialSection({
  profile,
  t,
}: {
  profile: OfficialProfile;
  t: (en: string, ar: string) => string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("Official company information", "بيانات الشركة الرسمية")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {humanize(profile.company_type)} ·{" "}
            {[profile.city, profile.country].filter(Boolean).join(", ")}
          </p>
        </div>
        {profile.website_url && (
          <a
            href={profile.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border bg-background px-4 py-2 text-sm font-semibold"
          >
            <Globe2 className="mr-2 h-4 w-4" />
            {t("Company website", "موقع الشركة")}
          </a>
        )}
      </div>
      {profile.differentiators && (
        <div className="mt-5 rounded-xl border bg-background/80 p-4">
          <h3 className="font-semibold">
            {t("What makes this company unique", "ما الذي يميز هذه الشركة")}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {profile.differentiators}
          </p>
        </div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TagGroup
          title={t("Therapeutic areas", "المجالات العلاجية")}
          values={profile.therapeutic_areas}
          hrefFor={(value) =>
            seoEntityPath(
              "disease",
              seoEntitySlug(cleanDiseaseEntityName(value)),
            )
          }
        />
        <TagGroup
          title={t("Product categories", "فئات المنتجات")}
          values={profile.product_categories}
          hrefFor={(value) => `/search?q=${encode(value)}`}
        />
        <TagGroup
          title={t("Capabilities", "القدرات")}
          values={profile.capabilities}
          hrefFor={(value) => `/search?q=${encode(value)}`}
        />
        <TagGroup
          title={t("Services", "الخدمات")}
          values={profile.services}
          hrefFor={(value) => `/search?q=${encode(value)}`}
        />
        <TagGroup
          title={t("Patient-support programs", "برامج دعم المرضى")}
          values={profile.support_programs}
          hrefFor={(value) => `/search?q=${encode(value)}`}
        />
      </div>
    </section>
  );
}

function PortfolioEmpty({
  profile,
  type,
  t,
}: {
  profile: CompanyProfile | null;
  type: SeoEntityType;
  t: (en: string, ar: string) => string;
}) {
  const sample = list(profile?.portfolio_sample);
  return (
    <Card className="mt-4">
      <CardContent className="p-6 text-sm text-muted-foreground">
        {type === "company" && sample.length > 0 ? (
          <>
            <p>
              {t(
                "The aggregate portfolio is available while detailed canonical links are being resolved.",
                "ملخص المحفظة متاح بينما يتم استكمال ربط السجلات الموحدة التفصيلية.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sample.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          t(
            "No independent source products are linked yet.",
            "لا توجد منتجات مرتبطة بمصدر مستقل حتى الآن.",
          )
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </CardContent>
    </Card>
  );
}
function TagGroup({
  title,
  values,
  hrefFor,
}: {
  title: string;
  values: string[];
  hrefFor?: (value: string) => string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.slice(0, 12).map((value) =>
            hrefFor ? (
              <a
                key={value}
                href={hrefFor(value)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge
                  variant="secondary"
                  className="cursor-pointer transition hover:bg-primary hover:text-primary-foreground"
                >
                  {value}
                </Badge>
              </a>
            ) : (
              <Badge key={value} variant="secondary">
                {value}
              </Badge>
            ),
          )
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  t,
}: {
  product: Product;
  t: (en: string, ar: string) => string;
}) {
  const diseaseLabel = product.disease_name
    ? cleanDiseaseEntityName(product.disease_name)
    : null;
  const internal = Boolean(product.product_url?.startsWith("/"));
  const medicineLink =
    product.product_url || `/medicines?q=${encode(product.product_name)}`;
  return (
    <Card className="h-full shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-lg leading-7">
          <a
            href={medicineLink}
            target={internal || !product.product_url ? undefined : "_blank"}
            rel={internal || !product.product_url ? undefined : "noreferrer"}
            className="hover:text-primary hover:underline"
          >
            {product.product_name}
          </a>
        </CardTitle>
        {product.generic_name ? (
          <a
            href={seoEntityPath("generic", seoEntitySlug(product.generic_name))}
            className="text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            {product.generic_name}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            {product.drug_variant || "—"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {diseaseLabel && (
            <a href={seoEntityPath("disease", seoEntitySlug(diseaseLabel))}>
              <Badge className="cursor-pointer">{diseaseLabel}</Badge>
            </a>
          )}
          {product.prescription_required && (
            <Badge variant="outline">{product.prescription_required}</Badge>
          )}
          {product.final_price != null && (
            <Badge variant="secondary">
              {Number(product.final_price).toLocaleString()}{" "}
              {product.price_currency}
            </Badge>
          )}
        </div>
        {product.company_name && product.company_slug && (
          <a
            href={seoEntityPath("company", product.company_slug)}
            className="inline-flex items-center font-semibold text-primary hover:underline"
          >
            <Building2 className="mr-1.5 h-4 w-4" />
            {product.company_name}
          </a>
        )}
        {product.drug_content_summary && (
          <p className="line-clamp-3 text-muted-foreground">
            {product.drug_content_summary}
          </p>
        )}
        <a
          href={medicineLink}
          target={internal || !product.product_url ? undefined : "_blank"}
          rel={internal || !product.product_url ? undefined : "noreferrer"}
          className="inline-flex items-center font-semibold text-primary hover:underline"
        >
          {internal || !product.product_url
            ? t(
                "Open medicine encyclopedia page",
                "فتح صفحة الدواء في الموسوعة",
              )
            : t("Open source listing", "فتح قائمة المصدر")}
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  );
}

function buildRelatedLinks(
  type: SeoEntityType,
  products: Product[],
  directory: SeoEntityDirectory | null,
) {
  const byKey = new Map<string, SeoEntity>();
  for (const item of directory?.entities || []) {
    byKey.set(`${item.type}:${item.name}`, item);
    if (item.sourceValue) byKey.set(`${item.type}:${item.sourceValue}`, item);
  }
  const result = new Map<string, SeoEntity>();
  function add(
    nextType: SeoEntityType,
    sourceName: string | null,
    providedSlug?: string | null,
  ) {
    if (!sourceName) return;
    const found = byKey.get(`${nextType}:${sourceName}`);
    const publicName =
      nextType === "disease" ? cleanDiseaseEntityName(sourceName) : sourceName;
    const nextSlug =
      providedSlug ||
      found?.slug ||
      (nextType === "company" ? "" : seoEntitySlug(publicName));
    if (!nextSlug) return;
    result.set(
      `${nextType}:${nextSlug}`,
      found || {
        type: nextType,
        name: publicName,
        sourceValue: sourceName,
        slug: nextSlug,
        records: 0,
      },
    );
  }
  for (const product of products) {
    if (type !== "company")
      add("company", product.company_name, product.company_slug);
    if (type !== "generic") add("generic", product.generic_name);
    if (type !== "disease") add("disease", product.disease_name);
  }
  return [...result.values()].sort(
    (a, b) => b.records - a.records || a.name.localeCompare(b.name),
  );
}
