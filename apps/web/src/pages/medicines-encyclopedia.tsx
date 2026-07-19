import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Barcode,
  BookOpen,
  Building2,
  Database,
  History,
  ImageIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MedicineDataContributionHub } from "@/components/medicine-data-contribution-hub";
import {
  CompanyProductManagementMenu,
  type ManagedProductCompany,
} from "@/components/company-product-management-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { seoEntitySlug } from "@/lib/seo-entities";
import { useLocation } from "wouter";
import {
  medicineCompanyLookupKey,
  medicineCompanyRoleLabel,
  parseMedicineCompanyParties,
} from "@/lib/medicine-companies";

type Medicine = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  route: string | null;
  category: string | null;
  image_url: string | null;
  image_source_url: string | null;
  image_source_domain: string | null;
  image_source_kind: string | null;
  image_authenticity_score: number;
  image_match_score: number;
  image_is_verified: boolean;
  barcode: string | null;
  code: string | null;
  current_price_egp: number | null;
  price_currency: string | null;
  min_price_egp: number | null;
  max_price_egp: number | null;
  price_observation_count: number;
  distinct_price_count: number;
  has_price_history: boolean;
  source_record_count: number;
  source_count: number;
  source_systems: string[];
  has_verified_dataset: boolean;
  has_company_verified_source: boolean;
  marketplace_offer_count: number;
  marketplace_seller_count: number;
  lowest_marketplace_price_egp: number | null;
  current_price_source: string | null;
  complete_field_count: number;
  available_field_count: number;
  completeness_score: number;
  completeness_percent: number;
  relevance: number;
  match_reason: string;
  matched_terms: number;
  total_count: number;
};
type Metrics = {
  canonical_products: number;
  verified_dataset_products: number;
  operational_catalog_products: number;
  products_with_price_history: number;
  products_with_current_price: number;
  manufacturers: number;
  scientific_names: number;
  drug_classes: number;
  routes: number;
  source_records_merged: number;
};
type Facet = {
  facet_type:
    | "manufacturer"
    | "drug_class"
    | "route"
    | "category"
    | "source_system";
  facet_value: string;
  product_count: number;
};
type PublicSetting = { setting_key: string; value: unknown };
type CompanyLink = { company_name: string; company_slug: string };
type CompanyResolution = {
  source_company_slug: string;
  canonical_company_slug: string;
  display_name: string | null;
};
type OrganizationMembership = { organization_id: string };
type Filters = {
  manufacturer: string;
  drugClass: string;
  route: string;
  category: string;
  scientificName: string;
  sourceSystem: string;
  minPrice: string;
  maxPrice: string;
  minCompleteness: string;
  historyOnly: boolean;
  verifiedOnly: boolean;
  offersOnly: boolean;
  imageOnly: boolean;
  queryMode: "all" | "any";
  sort: string;
};

const defaultFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  category: "",
  scientificName: "",
  sourceSystem: "",
  minPrice: "",
  maxPrice: "",
  minCompleteness: "",
  historyOnly: false,
  verifiedOnly: false,
  offersOnly: false,
  imageOnly: false,
  queryMode: "all",
  sort: "best",
};
const formatPrice = (value: number | null, currency = "EGP") =>
  value == null ? null : `${Number(value).toLocaleString()} ${currency}`;
const numberOrNull = (value: string) => {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : null;
};
function sourceLabel(source: string) {
  if (source === "medicines5") return "Verified dataset";
  if (source === "medicines2") return "Operational catalog";
  if (source === "medicines3") return "EgyptDwa";
  if (source === "company_verified") return "Verified company";
  return source;
}
function imageLabel(kind: string | null, verified: boolean) {
  if (kind === "official_manufacturer") return "Official manufacturer image";
  if (kind === "regulator") return "Regulatory source image";
  if (kind === "verified_company") return "Verified company image";
  if (kind === "licensed_pharmacy") return "Reviewed pharmacy image";
  if (kind === "trusted_database")
    return verified ? "Reviewed database image" : "Source database image";
  return verified ? "Admin-approved image" : "Source image";
}
function matchLabel(reason: string, t: (en: string, ar: string) => string) {
  const labels: Record<string, [string, string]> = {
    exact_identifier: ["Exact barcode or code", "باركود أو كود مطابق"],
    exact_name: ["Exact name", "اسم مطابق"],
    name_prefix: ["Name starts with query", "الاسم يبدأ بالبحث"],
    exact_phrase: ["Exact phrase", "عبارة مطابقة"],
    all_terms: ["All terms matched", "كل الكلمات مطابقة"],
    partial_terms: ["Some terms matched", "بعض الكلمات مطابقة"],
    fuzzy: ["Similar spelling", "تهجئة متشابهة"],
    complete_record: ["Complete record", "سجل مكتمل"],
  };
  const label = labels[reason] || [
    reason.replaceAll("_", " "),
    reason.replaceAll("_", " "),
  ];
  return t(label[0], label[1]);
}
const canonicalCompanySlugs: Record<string, string> = {};

function initialState() {
  if (typeof window === "undefined")
    return {
      query: "",
      filters: defaultFilters,
      offset: 0,
      openExactProduct: false,
    };
  const params = new URLSearchParams(window.location.search);
  const filters: Filters = {
    manufacturer: params.get("manufacturer") || "",
    drugClass: params.get("class") || "",
    route: params.get("route") || "",
    category: params.get("category") || "",
    scientificName: params.get("scientific") || "",
    sourceSystem: params.get("source") || "",
    minPrice: params.get("min_price") || "",
    maxPrice: params.get("max_price") || "",
    minCompleteness: params.get("min_complete") || "",
    historyOnly: params.get("history") === "1",
    verifiedOnly: params.get("verified") === "1",
    offersOnly: params.get("offers") === "1",
    imageOnly: params.get("image") === "1",
    queryMode: params.get("mode") === "any" ? "any" : "all",
    sort: params.get("sort") || "best",
  };
  return {
    query: params.get("q") || "",
    filters,
    offset: Math.max(0, Number(params.get("offset") || 0) || 0),
    openExactProduct:
      params.size === 1 && params.has("q") && Boolean(params.get("q")?.trim()),
  };
}

export default function MedicinesEncyclopedia() {
  const { t, language } = useLanguage();
  const { supabaseFetch, session, isAuthenticated } = usePatientAuth();
  const [location] = useLocation();
  const initial = useMemo(() => initialState(), []);
  const openExactProduct = useRef(initial.openExactProduct);
  const searchRequestId = useRef(0);
  const realtimeSearchReady = useRef(false);
  const [query, setQuery] = useState(initial.query);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [offset, setOffset] = useState(initial.offset);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(36);
  const [showImages, setShowImages] = useState(true);
  const [showMarketplace, setShowMarketplace] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.hash === "#contribute-medicine-data",
  );
  const [managedCompanies, setManagedCompanies] = useState<
    ManagedProductCompany[]
  >([]);

  const facetValues = (type: Facet["facet_type"], limit = 700) =>
    facets.filter((f) => f.facet_type === type).slice(0, limit);
  const manufacturers = useMemo(() => facetValues("manufacturer"), [facets]);
  const drugClasses = useMemo(() => facetValues("drug_class"), [facets]);
  const routes = useMemo(() => facetValues("route"), [facets]);
  const categories = useMemo(() => facetValues("category"), [facets]);
  const sources = useMemo(() => facetValues("source_system", 50), [facets]);
  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = useMemo(() => filterChips(filters, t), [filters, t]);

  async function load(
    nextOffset = 0,
    nextQuery = query,
    nextFilters = filters,
    nextPageSize = pageSize,
  ) {
    const requestId = ++searchRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<Medicine[]>(
        "/rest/v1/rpc/search_medicine_encyclopedia_v4",
        {
          method: "POST",
          body: JSON.stringify({
            p_query: nextQuery.trim(),
            p_manufacturer: nextFilters.manufacturer.trim() || null,
            p_drug_class: nextFilters.drugClass.trim() || null,
            p_route: nextFilters.route.trim() || null,
            p_category: nextFilters.category.trim() || null,
            p_scientific_name: nextFilters.scientificName.trim() || null,
            p_source_system: nextFilters.sourceSystem || null,
            p_min_price: numberOrNull(nextFilters.minPrice),
            p_max_price: numberOrNull(nextFilters.maxPrice),
            p_has_price_history: nextFilters.historyOnly ? true : null,
            p_verified_only: nextFilters.verifiedOnly ? true : null,
            p_has_marketplace_offers: nextFilters.offersOnly ? true : null,
            p_has_image: nextFilters.imageOnly ? true : null,
            p_min_completeness: numberOrNull(nextFilters.minCompleteness),
            p_query_mode: nextFilters.queryMode,
            p_sort: nextFilters.sort,
            p_limit: nextPageSize,
            p_offset: nextOffset,
          }),
        },
      );
      if (requestId !== searchRequestId.current) return;
      if (openExactProduct.current) {
        openExactProduct.current = false;
        const exactProduct =
          nextOffset === 0 &&
          rows.length === 1 &&
          Number(rows[0]?.total_count || 0) === 1 &&
          rows[0]?.match_reason === "exact_name"
            ? rows[0]
            : null;
        if (exactProduct && typeof window !== "undefined") {
          window.location.replace(`/catalog/${exactProduct.canonical_id}`);
          return;
        }
      }
      setMedicines(rows);
      setOffset(nextOffset);
      setTotal(Number(rows[0]?.total_count || 0));
      syncUrl(nextQuery, nextFilters, nextOffset);
    } catch (cause) {
      if (requestId !== searchRequestId.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load medicines.", "تعذر تحميل الأدوية."),
      );
    } finally {
      if (requestId === searchRequestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      supabaseFetch<Metrics[]>(
        "/rest/v1/medicine_canonical_metrics_v1?select=*",
      ),
      supabaseFetch<Facet[]>(
        "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_type,facet_value,product_count&order=facet_type.asc,product_count.desc&limit=10000",
      ),
      supabaseFetch<PublicSetting[]>(
        "/rest/v1/platform_public_settings_v1?select=setting_key,value",
      ),
      supabaseFetch<CompanyLink[]>(
        "/rest/v1/medicine_company_profiles?select=company_name,company_slug&order=company_name.asc&limit=10000",
      ),
      supabaseFetch<CompanyResolution[]>(
        "/rest/v1/company_directory_resolutions_v1?select=source_company_slug,canonical_company_slug,display_name&limit=10000",
      ),
    ])
      .then(
        ([metricRows, facetRows, settingRows, companyRows, resolutionRows]) => {
          setMetrics(metricRows[0] || null);
          setFacets(facetRows);
          companyRows.forEach((row) => {
            canonicalCompanySlugs[medicineCompanyLookupKey(row.company_name)] =
              row.company_slug;
          });
          resolutionRows.forEach((row) => {
            canonicalCompanySlugs[
              medicineCompanyLookupKey(row.source_company_slug)
            ] = row.canonical_company_slug;
            if (row.display_name)
              canonicalCompanySlugs[
                medicineCompanyLookupKey(row.display_name)
              ] = row.canonical_company_slug;
          });
          const settings = Object.fromEntries(
            settingRows.map((row) => [row.setting_key, row.value]),
          );
          const configuredSize = Math.max(
            12,
            Math.min(Number(settings["search.page_size"] || 36), 100),
          );
          const configuredSort = String(
            settings["search.default_sort"] || "best",
          );
          const configuredMinimum = Number(
            settings["search.minimum_default_completeness"] || 0,
          );
          const nextFilters = {
            ...initial.filters,
            sort:
              initial.filters.sort !== "best"
                ? initial.filters.sort
                : configuredSort,
            minCompleteness:
              initial.filters.minCompleteness ||
              (configuredMinimum > 0 ? String(configuredMinimum) : ""),
          };
          setFilters(nextFilters);
          setPageSize(configuredSize);
          setShowImages(settings["search.show_product_images"] !== false);
          setShowMarketplace(
            settings["search.show_marketplace_connections"] !== false,
          );
          return load(
            initial.offset,
            initial.query,
            nextFilters,
            configuredSize,
          ).finally(() => {
            realtimeSearchReady.current = true;
          });
        },
      )
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : t(
                "Could not initialize medicine search.",
                "تعذر تهيئة بحث الأدوية.",
              ),
        );
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!realtimeSearchReady.current) return;
    const timer = window.setTimeout(() => void load(0, query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function syncFromUrl() {
      const nextInitial = initialState();
      let changed = false;

      if (nextInitial.query !== query) {
        setQuery(nextInitial.query);
        changed = true;
      }
      if (JSON.stringify(nextInitial.filters) !== JSON.stringify(filters)) {
        setFilters(nextInitial.filters);
        changed = true;
      }
      if (nextInitial.offset !== offset) {
        setOffset(nextInitial.offset);
        changed = true;
      }

      if (changed) {
        void load(nextInitial.offset, nextInitial.query, nextInitial.filters);
      }
    }

    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("pushState", syncFromUrl);
    window.addEventListener("replaceState", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("pushState", syncFromUrl);
      window.removeEventListener("replaceState", syncFromUrl);
    };
  }, [query, filters, offset]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!isAuthenticated || !userId) {
      setManagedCompanies([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const memberships = await supabaseFetch<OrganizationMembership[]>(
          `/rest/v1/organization_members?select=organization_id&user_id=eq.${userId}&is_active=eq.true`,
        );
        const organizationIds = memberships.map((row) => row.organization_id);
        if (organizationIds.length === 0) {
          if (!cancelled) setManagedCompanies([]);
          return;
        }
        const profiles = await supabaseFetch<ManagedProductCompany[]>(
          `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name&organization_id=in.(${organizationIds.join(",")})&verification_status=eq.verified`,
        );
        const resolutions = profiles.length
          ? await supabaseFetch<CompanyResolution[]>(
              `/rest/v1/company_directory_resolutions_v1?select=source_company_slug,canonical_company_slug,display_name&source_company_slug=in.(${profiles.map((profile) => encodeURIComponent(profile.company_slug)).join(",")})`,
            )
          : [];
        const canonicalBySlug = new Map(
          resolutions.map((row) => [
            row.source_company_slug,
            row.canonical_company_slug,
          ]),
        );
        if (!cancelled)
          setManagedCompanies(
            profiles.map((profile) => ({
              ...profile,
              canonical_company_slug:
                canonicalBySlug.get(profile.company_slug) ||
                profile.company_slug,
            })),
          );
      } catch {
        if (!cancelled) setManagedCompanies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, session?.user?.id]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(0);
  }
  function clearFilter(key: keyof Filters) {
    const next = {
      ...filters,
      [key]:
        typeof filters[key] === "boolean"
          ? false
          : key === "queryMode"
            ? "all"
            : key === "sort"
              ? "best"
              : "",
    } as Filters;
    setFilters(next);
    void load(0, query, next);
  }
  function syncUrl(
    nextQuery: string,
    nextFilters: Filters,
    nextOffset: number,
  ) {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const pairs: Array<[string, string]> = [
      ["manufacturer", nextFilters.manufacturer],
      ["class", nextFilters.drugClass],
      ["route", nextFilters.route],
      ["category", nextFilters.category],
      ["scientific", nextFilters.scientificName],
      ["source", nextFilters.sourceSystem],
      ["min_price", nextFilters.minPrice],
      ["max_price", nextFilters.maxPrice],
      ["min_complete", nextFilters.minCompleteness],
    ];
    pairs.forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (nextFilters.historyOnly) params.set("history", "1");
    if (nextFilters.verifiedOnly) params.set("verified", "1");
    if (nextFilters.offersOnly) params.set("offers", "1");
    if (nextFilters.imageOnly) params.set("image", "1");
    if (nextFilters.queryMode === "any") params.set("mode", "any");
    if (nextFilters.sort !== "best") params.set("sort", nextFilters.sort);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const url = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", url);
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-4 md:py-8">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <div className="p-5 md:p-8">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary">
              <BookOpen className="h-4 w-4" />
              {t(
                "Medicine search, evidence, and verified marketplace",
                "بحث الأدوية والأدلة والسوق الموثق",
              )}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              {t(
                "Search every useful medicine signal in one place",
                "ابحث في كل بيانات الدواء المفيدة من مكان واحد",
              )}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {t(
                "Use exact identifiers, natural multi-word searches, Arabic or English names, active ingredients, partial company filters, classifications, images, prices, provenance, and reviewed supply offers.",
                "استخدم المعرّفات الدقيقة والبحث الطبيعي متعدد الكلمات والأسماء العربية أو الإنجليزية والمواد الفعالة وفلاتر الشركات الجزئية والتصنيفات والصور والأسعار والمصادر وعروض التوريد المراجعة.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <a href="#medicine-search">
                  <Search className="mr-2 h-4 w-4" />
                  {t("Start searching", "ابدأ البحث")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/marketplace">
                  <Store className="mr-2 h-4 w-4" />
                  {t("Open marketplace", "فتح السوق")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label={t(
          "Medicine database overview",
          "نظرة عامة على قاعدة بيانات الأدوية",
        )}
        className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5"
      >
        <Metric
          label={t("Canonical products", "منتجات موحدة")}
          value={Number(metrics?.canonical_products || 0)}
        />
        <Metric
          label={t("Verified dataset products", "منتجات موثقة")}
          value={Number(metrics?.verified_dataset_products || 0)}
        />
        <Metric
          label={t("With price history", "لها تاريخ أسعار")}
          value={Number(metrics?.products_with_price_history || 0)}
        />
        <Metric
          label={t("Manufacturers", "الشركات المصنعة")}
          value={Number(metrics?.manufacturers || 0)}
        />
        <Metric
          label={t("Source records merged", "سجلات مصادر مترابطة")}
          value={Number(metrics?.source_records_merged || 0)}
        />
      </section>
      <Alert className="mt-5">
        <AlertDescription>
          {t(
            "Search ranking, completeness, and image authenticity are discovery signals—not clinical or regulatory endorsements. Verify registration, prescription requirements, licensing, expiry, availability, and source dates before use or purchase.",
            "ترتيب البحث واكتمال البيانات وموثوقية الصورة إشارات للاكتشاف وليست اعتمادًا سريريًا أو تنظيميًا. تحقق من التسجيل ومتطلبات الوصفة والترخيص والصلاحية والتوافر وتواريخ المصادر قبل الاستخدام أو الشراء.",
          )}
        </AlertDescription>
      </Alert>

      <section
        id="medicine-search"
        aria-label={t("Persistent medicine search", "بحث الدواء المستمر")}
        className="relative z-30 mt-6 scroll-mt-24 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-xl shadow-primary/10 backdrop-blur-xl supports-[backdrop-filter]:bg-card/90 md:p-5"
      >
        <form onSubmit={submit} className="grid gap-2.5">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t("Search medicines", "البحث عن الأدوية")}
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              className="h-12 pl-10 text-base shadow-sm md:h-11"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                "Try: Panadol Extra, paracetamol GSK, a barcode, or an Arabic name…",
                "جرّب: بانادول إكسترا أو باراسيتامول أو شركة أو باركود…",
              )}
            />
          </label>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {t("Advanced filters", "فلاتر متقدمة")}
            {activeFilters.length ? ` (${activeFilters.length})` : ""}
          </Button>
          <div className="text-sm text-muted-foreground">
            {loading
              ? t("Searching…", "جاري البحث…")
              : `${total.toLocaleString()} ${t("matching medicines", "دواء مطابق")}`}
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((chip) => (
              <button
                key={chip.key}
                onClick={() => clearFilter(chip.key)}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        {filtersOpen && (
          <div className="mt-5 grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
            <DatalistField
              id="manufacturer-options"
              label={t("Manufacturer contains", "الشركة تحتوي على")}
              value={filters.manufacturer}
              onChange={(value) =>
                setFilters((current) => ({ ...current, manufacturer: value }))
              }
              options={manufacturers}
            />
            <DatalistField
              id="class-options"
              label={t("Drug class contains", "التصنيف يحتوي على")}
              value={filters.drugClass}
              onChange={(value) =>
                setFilters((current) => ({ ...current, drugClass: value }))
              }
              options={drugClasses}
            />
            <DatalistField
              id="route-options"
              label={t("Route contains", "طريقة الاستخدام تحتوي على")}
              value={filters.route}
              onChange={(value) =>
                setFilters((current) => ({ ...current, route: value }))
              }
              options={routes}
            />
            <DatalistField
              id="category-options"
              label={t("Category contains", "الفئة تحتوي على")}
              value={filters.category}
              onChange={(value) =>
                setFilters((current) => ({ ...current, category: value }))
              }
              options={categories}
            />
            <div>
              <Label>
                {t("Scientific name contains", "الاسم العلمي يحتوي على")}
              </Label>
              <Input
                className="mt-1"
                value={filters.scientificName}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    scientificName: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>{t("Source system", "نظام المصدر")}</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={filters.sourceSystem}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sourceSystem: event.target.value,
                  }))
                }
              >
                <option value="">{t("All sources", "كل المصادر")}</option>
                {sources.map((source) => (
                  <option key={source.facet_value} value={source.facet_value}>
                    {sourceLabel(source.facet_value)} (
                    {Number(source.product_count).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("Minimum price (EGP)", "أقل سعر")}</Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={filters.minPrice}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    minPrice: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>{t("Maximum price (EGP)", "أعلى سعر")}</Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={filters.maxPrice}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    maxPrice: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>{t("Minimum completeness %", "أقل اكتمال %")}</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                max="100"
                value={filters.minCompleteness}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    minCompleteness: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>{t("Word matching", "مطابقة الكلمات")}</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={filters.queryMode}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    queryMode: event.target.value as "all" | "any",
                  }))
                }
              >
                <option value="all">
                  {t(
                    "Match all words when possible",
                    "طابق كل الكلمات قدر الإمكان",
                  )}
                </option>
                <option value="any">
                  {t("Broader: match any word", "أوسع: طابق أي كلمة")}
                </option>
              </select>
            </div>
            <div>
              <Label>{t("Sort", "الترتيب")}</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value,
                  }))
                }
              >
                <option value="best">
                  {t("Best match and completeness", "أفضل تطابق واكتمال")}
                </option>
                <option value="relevance">
                  {t("Search relevance", "صلة البحث")}
                </option>
                <option value="completeness">
                  {t("Most complete first", "الأكثر اكتمالًا أولًا")}
                </option>
                <option value="name">{t("Name", "الاسم")}</option>
                <option value="price_high">
                  {t("Highest evidence price", "أعلى سعر دليل")}
                </option>
                <option value="price_low">
                  {t("Lowest evidence price", "أقل سعر دليل")}
                </option>
                <option value="history">
                  {t("Most price history", "أكثر تاريخ أسعار")}
                </option>
                <option value="sources">
                  {t("Most connected sources", "أكثر مصادر")}
                </option>
                <option value="offers">
                  {t("Most marketplace offers", "أكثر عروض")}
                </option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-3 pb-1">
              <CheckField
                label={t("Only with images", "فقط ذات صور")}
                checked={filters.imageOnly}
                onChange={(checked) =>
                  setFilters((current) => ({ ...current, imageOnly: checked }))
                }
              />
              <CheckField
                label={t("Only with price history", "فقط ذات تاريخ أسعار")}
                checked={filters.historyOnly}
                onChange={(checked) =>
                  setFilters((current) => ({
                    ...current,
                    historyOnly: checked,
                  }))
                }
              />
              <CheckField
                label={t("Only verified products", "فقط المنتجات الموثقة")}
                checked={filters.verifiedOnly}
                onChange={(checked) =>
                  setFilters((current) => ({
                    ...current,
                    verifiedOnly: checked,
                  }))
                }
              />
              <CheckField
                label={t("Only with approved offers", "فقط ذات عروض معتمدة")}
                checked={filters.offersOnly}
                onChange={(checked) =>
                  setFilters((current) => ({ ...current, offersOnly: checked }))
                }
              />
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Button onClick={() => void load(0)} disabled={loading}>
                {t("Apply filters", "تطبيق الفلاتر")}
              </Button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <section className="mt-7 flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {query.trim()
              ? t("Search results", "نتائج البحث")
              : t("Medicine directory", "دليل الأدوية")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {loading
              ? t("Updating results…", "جارٍ تحديث النتائج…")
              : `${total.toLocaleString()} ${t("medicines found", "دواء متاح")}`}
          </p>
        </div>
        <a
          href="#medicine-search"
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t("Refine search", "تحسين البحث")}
        </a>
      </section>
      <section
        aria-label={t("Medicine results", "نتائج الأدوية")}
        className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {medicines.map((medicine) => (
          <MedicineCard
            key={medicine.canonical_id}
            medicine={medicine}
            language={language}
            t={t}
            queryActive={Boolean(query.trim())}
            showImage={showImages}
            showMarketplace={showMarketplace}
            managedCompanies={managedCompanies}
          />
        ))}
        {!loading && medicines.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t(
                "No medicines match the selected search and filters. Try broader word matching or remove one filter.",
                "لا توجد أدوية تطابق البحث والفلاتر. جرّب مطابقة أوسع أو احذف أحد الفلاتر.",
              )}
            </CardContent>
          </Card>
        )}
      </section>
      {total > pageSize && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            {t("Page", "صفحة")} {page.toLocaleString()} /{" "}
            {pages.toLocaleString()} · {pageSize} {t("per page", "في الصفحة")}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - pageSize))}
            >
              {t("Previous", "السابق")}
            </Button>
            <Button
              variant="outline"
              disabled={loading || offset + pageSize >= total}
              onClick={() => void load(offset + pageSize)}
            >
              {t("Next", "التالي")}
            </Button>
          </div>
        </section>
      )}

      <Card className="mt-8 border-dashed border-primary/30 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm">
              <img
                src="/medicine-support-hub-logo.png"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-semibold">
                {t(
                  "Can’t find a medicine or have a product dataset?",
                  "لا تجد دواءً أو لديك مجموعة بيانات للمنتجات؟",
                )}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t(
                  "Send one medicine request or upload an Excel, CSV, or database export for approval.",
                  "أرسل طلب دواء واحد أو ارفع ملف Excel أو CSV أو تصدير قاعدة بيانات للموافقة.",
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={contributionOpen ? "outline" : "default"}
            aria-expanded={contributionOpen}
            aria-controls="contribute-medicine-data"
            onClick={() => setContributionOpen((open) => !open)}
            className="shrink-0"
          >
            {contributionOpen
              ? t("Close contribution form", "إغلاق نموذج المساهمة")
              : t("Request or contribute", "طلب أو مساهمة")}
          </Button>
        </CardContent>
      </Card>
      {contributionOpen && <MedicineDataContributionHub />}
    </main>
  );
}

function MedicineCard({
  medicine,
  language,
  t,
  queryActive,
  showImage,
  showMarketplace,
  managedCompanies,
}: {
  medicine: Medicine;
  language: string;
  t: (en: string, ar: string) => string;
  queryActive: boolean;
  showImage: boolean;
  showMarketplace: boolean;
  managedCompanies: ManagedProductCompany[];
}) {
  const title =
    language === "ar"
      ? medicine.name_ar || medicine.name_en || `#${medicine.canonical_id}`
      : medicine.name_en || medicine.name_ar || `#${medicine.canonical_id}`;
  const subtitle = language === "ar" ? medicine.name_en : medicine.name_ar;
  const currentPrice = formatPrice(
    medicine.current_price_egp,
    medicine.price_currency || "EGP",
  );
  const range =
    medicine.min_price_egp != null &&
    medicine.max_price_egp != null &&
    medicine.min_price_egp !== medicine.max_price_egp
      ? `${Number(medicine.min_price_egp).toLocaleString()}–${Number(medicine.max_price_egp).toLocaleString()} EGP`
      : null;
  const companyRelationships = parseMedicineCompanyParties(
    medicine.manufacturer,
  ).map((party) => ({
    company_name: party.companyName,
    company_slug:
      canonicalCompanySlugs[medicineCompanyLookupKey(party.companyName)] ||
      seoEntitySlug(party.companyName),
  }));
  const portfolioSlugs = new Set(
    companyRelationships.map((relationship) => relationship.company_slug),
  );
  const authorizedProfiles = managedCompanies.filter((profile) =>
    portfolioSlugs.has(profile.canonical_company_slug || profile.company_slug),
  );
  return (
    <Card className="relative flex h-full flex-col overflow-hidden shadow-sm transition hover:-translate-y-.5 hover:shadow-md">
      {authorizedProfiles.length > 0 && (
        <div
          className={`absolute right-3 z-20 ${showImage ? "top-14" : "top-3"}`}
        >
          <CompanyProductManagementMenu
            canonicalId={medicine.canonical_id}
            productName={title}
            relationships={companyRelationships}
            authorizedProfiles={authorizedProfiles}
            cardMenu
          />
        </div>
      )}
      {showImage && (
        <div className="relative flex h-48 items-center justify-center border-b bg-muted/20">
          {medicine.image_url ? (
            <img
              src={medicine.image_url}
              alt={title}
              className="h-full w-full object-contain p-3"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="mx-auto h-10 w-10" />
              <div className="mt-2 text-xs">
                {t("Image pending verification", "الصورة قيد الاستكمال")}
              </div>
            </div>
          )}
          <Badge className="absolute left-3 top-3 bg-background/95 text-foreground hover:bg-background">
            {medicine.completeness_percent}% {t("complete", "مكتمل")}
          </Badge>
          {medicine.image_url && (
            <Badge variant="secondary" className="absolute right-3 top-3">
              {imageLabel(
                medicine.image_source_kind,
                medicine.image_is_verified,
              )}
            </Badge>
          )}
        </div>
      )}
      <CardContent className="flex flex-1 flex-col space-y-4 p-5">
        {!showImage && (
          <div className="flex justify-between">
            <Badge>
              {medicine.completeness_percent}% {t("complete", "مكتمل")}
            </Badge>
            {medicine.image_url && (
              <Badge variant="outline">
                {imageLabel(
                  medicine.image_source_kind,
                  medicine.image_is_verified,
                )}
              </Badge>
            )}
          </div>
        )}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <a
                href={`/catalog/${medicine.canonical_id}`}
                className="text-lg font-bold leading-7 hover:text-primary"
              >
                {title}
              </a>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
              {queryActive && (
                <Badge variant="outline" className="mt-2">
                  {matchLabel(medicine.match_reason, t)}
                  {medicine.matched_terms > 0
                    ? ` · ${medicine.matched_terms} ${t("terms", "كلمات")}`
                    : ""}
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {medicine.has_verified_dataset && (
                <Badge>
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {t("Verified", "موثق")}
                </Badge>
              )}
              {medicine.has_company_verified_source && (
                <Badge variant="secondary">
                  <Building2 className="mr-1 h-3 w-3" />
                  {t("Company", "شركة")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentPrice && <Badge>{currentPrice}</Badge>}
          {medicine.has_price_history && (
            <Badge variant="secondary">
              <History className="mr-1 h-3 w-3" />
              {medicine.distinct_price_count} {t("prices", "أسعار")}
            </Badge>
          )}
          {showMarketplace && medicine.marketplace_offer_count > 0 && (
            <Badge variant="outline">
              <Store className="mr-1 h-3 w-3" />
              {medicine.marketplace_offer_count} {t("offers", "عروض")}
            </Badge>
          )}
          {medicine.route && <Badge variant="outline">{medicine.route}</Badge>}
          {medicine.category && (
            <Badge variant="outline">{medicine.category}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Info
            label={t("Scientific name", "الاسم العلمي")}
            value={medicine.scientific_name}
          />
          <ManufacturerInfo value={medicine.manufacturer} t={t} />
          <Info
            label={t("Drug class", "التصنيف")}
            value={medicine.drug_class}
          />
          <Info label={t("Evidence range", "نطاق السعر")} value={range} />
          <Info label={t("Barcode", "الباركود")} value={medicine.barcode} />
          <Info label={t("Product code", "كود المنتج")} value={medicine.code} />
        </div>
        {showMarketplace && medicine.marketplace_offer_count > 0 && (
          <div className="rounded-lg border bg-primary/5 p-3">
            <div className="text-xs text-muted-foreground">
              {t("Lowest approved marketplace offer", "أقل عرض سوق معتمد")}
            </div>
            <div className="font-bold">
              {formatPrice(medicine.lowest_marketplace_price_egp)}
            </div>
            <div className="text-xs text-muted-foreground">
              {medicine.marketplace_seller_count}{" "}
              {t("verified sellers", "بائع موثق")}
            </div>
          </div>
        )}
        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {medicine.source_count} {t("connected sources", "مصادر مترابطة")}
            </span>
            <span>
              {medicine.complete_field_count}/{medicine.available_field_count}{" "}
              {t("core fields", "حقول أساسية")}
            </span>
          </div>
          {medicine.image_url && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>
                {medicine.image_source_domain ||
                  t("reviewed image source", "مصدر صورة مراجع")}{" "}
                · {medicine.image_authenticity_score}/100
              </span>
              {medicine.image_source_url && (
                <a
                  href={medicine.image_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("source", "المصدر")}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {medicine.source_systems.map((source) => (
            <Badge key={source} variant="outline">
              {sourceLabel(source)}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <a href={`/catalog/${medicine.canonical_id}`}>
              {t("Full product record", "السجل الكامل")}
            </a>
          </Button>
          {showMarketplace && medicine.marketplace_offer_count > 0 && (
            <Button asChild size="sm" variant="outline">
              <a href={`/marketplace?q=${encodeURIComponent(title)}`}>
                <ShoppingBag className="mr-1 h-4 w-4" />
                {t("Compare offers", "قارن العروض")}
              </a>
            </Button>
          )}
          {medicine.barcode && (
            <Badge variant="outline" className="gap-1">
              <Barcode className="h-3 w-3" />
              {medicine.barcode}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="min-w-48 snap-start sm:min-w-0">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
function DatalistField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Facet[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option.facet_value} value={option.facet_value}>
            {Number(option.product_count).toLocaleString()} products
          </option>
        ))}
      </datalist>
    </div>
  );
}
function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const generic = label === "Scientific name" || label === "الاسم العلمي";
  const therapeutic = label === "Drug class" || label === "التصنيف";
  const href = value
    ? generic
      ? `/generics/${seoEntitySlug(value)}?name=${encodeURIComponent(value)}`
      : therapeutic
        ? `/therapeutic-categories/${seoEntitySlug(value)}?name=${encodeURIComponent(value)}`
        : null
    : null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium">
        {value ? (
          href ? (
            <a href={href} className="text-primary hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}
function ManufacturerInfo({
  value,
  t,
}: {
  value: string | null | undefined;
  t: (en: string, ar: string) => string;
}) {
  const parties = parseMedicineCompanyParties(value);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("Manufacturer & trademark owner", "المُصنّع ومالك العلامة")}
      </div>
      <div className="mt-1 space-y-1">
        {parties.length ? (
          parties.map((party) => {
            const slug =
              canonicalCompanySlugs[
                medicineCompanyLookupKey(party.companyName)
              ];
            const href = slug
              ? `/companies/${encodeURIComponent(slug)}`
              : `/companies/${encodeURIComponent(seoEntitySlug(party.companyName))}`;
            return (
              <div key={`${party.role}-${party.companyName}`}>
                <div className="text-[10px] text-muted-foreground">
                  {medicineCompanyRoleLabel(party.role, t)}
                </div>
                <a
                  href={href}
                  className="break-words text-sm font-medium text-primary hover:underline"
                >
                  {party.companyName}
                </a>
              </div>
            );
          })
        ) : (
          <span className="text-sm font-medium">—</span>
        )}
      </div>
    </div>
  );
}
function filterChips(filters: Filters, t: (en: string, ar: string) => string) {
  const chips: Array<{ key: keyof Filters; label: string }> = [];
  const add = (key: keyof Filters, label: string, value: unknown) => {
    if (value) chips.push({ key, label });
  };
  add(
    "manufacturer",
    `${t("Manufacturer", "الشركة")}: ${filters.manufacturer}`,
    filters.manufacturer,
  );
  add(
    "drugClass",
    `${t("Class", "التصنيف")}: ${filters.drugClass}`,
    filters.drugClass,
  );
  add("route", `${t("Route", "الطريق")}: ${filters.route}`, filters.route);
  add(
    "category",
    `${t("Category", "الفئة")}: ${filters.category}`,
    filters.category,
  );
  add(
    "scientificName",
    `${t("Scientific", "العلمي")}: ${filters.scientificName}`,
    filters.scientificName,
  );
  add(
    "sourceSystem",
    `${t("Source", "المصدر")}: ${sourceLabel(filters.sourceSystem)}`,
    filters.sourceSystem,
  );
  add(
    "minPrice",
    `${t("Min price", "أقل سعر")}: ${filters.minPrice}`,
    filters.minPrice,
  );
  add(
    "maxPrice",
    `${t("Max price", "أعلى سعر")}: ${filters.maxPrice}`,
    filters.maxPrice,
  );
  add(
    "minCompleteness",
    `${t("Completeness", "الاكتمال")}: ${filters.minCompleteness}%+`,
    filters.minCompleteness,
  );
  add("historyOnly", t("Price history", "تاريخ أسعار"), filters.historyOnly);
  add("verifiedOnly", t("Verified", "موثق"), filters.verifiedOnly);
  add("offersOnly", t("Marketplace offers", "عروض السوق"), filters.offersOnly);
  add("imageOnly", t("Has image", "له صورة"), filters.imageOnly);
  if (filters.queryMode === "any")
    chips.push({ key: "queryMode", label: t("Any word", "أي كلمة") });
  if (filters.sort !== "best")
    chips.push({
      key: "sort",
      label: `${t("Sort", "الترتيب")}: ${filters.sort.replaceAll("_", " ")}`,
    });
  return chips;
}
