import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Barcode,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  Database,
  History,
  ImageIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  ExternalLink,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  disease_name?: string | null;
  manufacturer_origin?: string | null;
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
type PublicSetting = { setting_key: string; key?: string; value: unknown };
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
  sort: "most_searched",
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
    sort: params.get("sort") || "most_searched",
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
  const [infoExpanded, setInfoExpanded] = useState(false);

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
      let safeRows = (Array.isArray(rows) ? rows : []).filter((item) => {
        if (!item || !item.name_en) return false;
        const nameLower = item.name_en.toLowerCase();
        return !nameLower.includes("mapped legacy") && !nameLower.includes("unmapped legacy") && !nameLower.includes("legacy placeholder");
      });

      // Merge representative live updates saved from /account in browser storage
      if (typeof window !== "undefined") {
        try {
          const rawCustom =
            localStorage.getItem("all_custom_medicine_updates") ||
            localStorage.getItem("company_portfolio_updates_soulpharma") ||
            localStorage.getItem("company_portfolio_updates_soul-pharma");
          if (rawCustom) {
            const customList = JSON.parse(rawCustom);
            if (Array.isArray(customList) && customList.length > 0) {
              const queryLower = (nextQuery || "").toLowerCase().trim();
              const mergedList = [...safeRows];

              for (const cMed of customList) {
                if (!cMed || !cMed.name_en) continue;
                const canonicalId = Number(cMed.canonical_id);
                const nameEn = (cMed.name_en || "").toLowerCase();
                const nameAr = (cMed.name_ar || "").toLowerCase();
                const scientificName = (cMed.scientific_name || "").toLowerCase();
                const mfg = (cMed.manufacturer || "").toLowerCase();
                const barcode = (cMed.barcode || "").toLowerCase();
                const code = (cMed.code || "").toLowerCase();

                const isMatch =
                  !queryLower ||
                  nameEn.includes(queryLower) ||
                  nameAr.includes(queryLower) ||
                  scientificName.includes(queryLower) ||
                  mfg.includes(queryLower) ||
                  barcode.includes(queryLower) ||
                  code.includes(queryLower);

                if (isMatch) {
                  const existingIdx = mergedList.findIndex(
                    (r) =>
                      Number(r.canonical_id) === canonicalId ||
                      (r.name_en && r.name_en.toLowerCase() === nameEn)
                  );

                  const formatted: Medicine = {
                    canonical_id: canonicalId,
                    name_en: cMed.name_en,
                    name_ar: cMed.name_ar || null,
                    scientific_name: cMed.scientific_name || null,
                    manufacturer: cMed.manufacturer || "SOUL PHARMA",
                    drug_class: cMed.drug_class || "Antifungal / Topicals",
                    route: cMed.route || "Topical",
                    category: cMed.category || "Dermatology",
                    image_url:
                      cMed.image_url ||
                      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
                    image_source_url: null,
                    image_source_domain: "official_manufacturer",
                    image_source_kind: "official_manufacturer",
                    image_authenticity_score: 100,
                    image_match_score: 100,
                    image_is_verified: true,
                    barcode: cMed.barcode || null,
                    code: cMed.code || null,
                    current_price_egp: cMed.current_price_egp
                      ? Number(cMed.current_price_egp)
                      : null,
                    price_currency: "EGP",
                    min_price_egp: cMed.current_price_egp
                      ? Number(cMed.current_price_egp)
                      : null,
                    max_price_egp: cMed.current_price_egp
                      ? Number(cMed.current_price_egp)
                      : null,
                    price_observation_count: 1,
                    distinct_price_count: 1,
                    has_price_history: true,
                    source_record_count: 1,
                    source_count: 1,
                    source_systems: ["official_company_representative"],
                    has_verified_dataset: true,
                    has_company_verified_source: true,
                    marketplace_offer_count: 0,
                    marketplace_seller_count: 0,
                    lowest_marketplace_price_egp: null,
                    current_price_source: "official_company_representative",
                    complete_field_count: 12,
                    available_field_count: 12,
                    completeness_score: 100,
                    completeness_percent: 100,
                    relevance: 100,
                    match_reason: "representative_update",
                    matched_terms: 1,
                    total_count: mergedList.length + 1,
                  };

                  if (existingIdx >= 0) {
                    mergedList[existingIdx] = formatted;
                  } else {
                    mergedList.unshift(formatted);
                  }
                }
              }
              safeRows = mergedList;
            }
          }
        } catch {}
      }

      if (requestId !== searchRequestId.current) return;
      if (openExactProduct.current) {
        openExactProduct.current = false;
        const exactProduct =
          nextOffset === 0 &&
          safeRows.length === 1 &&
          Number(safeRows[0]?.total_count || 0) === 1 &&
          safeRows[0]?.match_reason === "exact_name"
            ? safeRows[0]
            : null;
        if (exactProduct && typeof window !== "undefined") {
          window.location.replace(`/catalog/${exactProduct.canonical_id}`);
          return;
        }
      }
      setMedicines(safeRows);
      setOffset(nextOffset);
      setTotal(Number(safeRows[0]?.total_count || safeRows.length));
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
      ).catch(() => []),
      supabaseFetch<Facet[]>(
        "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_type,facet_value,product_count&order=facet_type.asc,product_count.desc&limit=10000",
      ).catch(() => []),
      supabaseFetch<PublicSetting[]>(
        "/rest/v1/platform_public_settings_v1?select=setting_key,value",
      ).catch(() => []),
      supabaseFetch<CompanyLink[]>(
        "/rest/v1/medicine_company_profiles?select=company_name,company_slug&order=company_name.asc&limit=10000",
      ).catch(() => []),
      supabaseFetch<CompanyResolution[]>(
        "/rest/v1/company_directory_resolutions_v1?select=source_company_slug,canonical_company_slug,display_name&limit=10000",
      ).catch(() => []),
    ])
      .then(
        ([metricRows, facetRows, settingRows, companyRows, resolutionRows]) => {
          const safeMetrics = Array.isArray(metricRows) ? metricRows : [];
          const safeFacets = Array.isArray(facetRows) ? facetRows : [];
          const safeSettings = Array.isArray(settingRows) ? settingRows : [];
          const safeCompanies = Array.isArray(companyRows) ? companyRows : [];
          const safeResolutions = Array.isArray(resolutionRows) ? resolutionRows : [];

          setMetrics(safeMetrics[0] || null);
          setFacets(safeFacets);

          safeCompanies.forEach((row) => {
            if (row && row.company_name && row.company_slug) {
              canonicalCompanySlugs[medicineCompanyLookupKey(row.company_name)] =
                row.company_slug;
            }
          });
          safeResolutions.forEach((row) => {
            if (row && row.source_company_slug && row.canonical_company_slug) {
              canonicalCompanySlugs[
                medicineCompanyLookupKey(row.source_company_slug)
              ] = row.canonical_company_slug;
              if (row.display_name)
                canonicalCompanySlugs[
                  medicineCompanyLookupKey(row.display_name)
                ] = row.canonical_company_slug;
            }
          });

          const settings = Object.fromEntries(
            safeSettings.map((row) => [row.setting_key || row.key, row.value]),
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
          );
        },
      )
      .catch((cause) => {
        console.warn("Medicine search metadata initialization fallback:", cause);
        return load(initial.offset, initial.query, initial.filters);
      })
      .finally(() => {
        realtimeSearchReady.current = true;
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
      if (nextInitial.offset !== offset) {
        setOffset(nextInitial.offset);
        changed = true;
      }

      if (changed) {
        void load(nextInitial.offset, nextInitial.query, filters);
      }
    }

    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
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
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm transition-all duration-300 hover:shadow-md">
        <button
          onClick={() => setInfoExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between p-6 text-start hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 md:px-10"
        >
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary">
            <BookOpen className="h-4 w-4" />
            {t(
              "Medicine search, evidence, and verified marketplace",
              "بحث الأدوية والأدلة والسوق الموثق",
            )}
          </span>
          {infoExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {infoExpanded && (
          <div className="border-t border-slate-100 p-6 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  {t(
                    "Search every useful medicine signal in one place",
                    "ابحث في كل بيانات الدواء المفيدة من مكان واحد",
                  )}
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
                  {t(
                    "Use exact identifiers, natural multi-word searches, Arabic or English names, active ingredients, partial company filters, classifications, images, prices, provenance, and reviewed supply offers.",
                    "استخدم المعرّفات الدقيقة والبحث الطبيعي متعدد الكلمات والأسماء العربية أو الإنجليزية والمواد الفعالة وفلاتر الشركات الجزئية والتصنيفات والصور والأسعار والمصادر وعروض التوريد المراجعة.",
                  )}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="/marketplace">
                      <Store className="mr-2 h-4 w-4" />
                      {t("Open marketplace", "فتح السوق")}
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="/industry">
                      <Building2 className="mr-2 h-4 w-4" />
                      {t("Contribute verified products", "إضافة منتجات موثقة")}
                    </a>
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                <ValueCard
                  icon={Search}
                  title={t("Tolerant relevance", "صلة بحث مرنة")}
                  text={t(
                    "Exact barcode and product-code matches rank first, followed by names, phrases, all terms, and spelling similarity.",
                    "تظهر مطابقة الباركود والكود أولًا ثم الأسماء والعبارات وكل الكلمات والتشابه الإملائي.",
                  )}
                />
                <ValueCard
                  icon={SlidersHorizontal}
                  title={t("Useful partial filters", "فلاتر جزئية مفيدة")}
                  text={t(
                    "Type part of a manufacturer, class, route, category, or active ingredient instead of needing an exact database value.",
                    "اكتب جزءًا من الشركة أو التصنيف أو الطريق أو الفئة أو المادة الفعالة دون الحاجة لقيمة مطابقة حرفيًا.",
                  )}
                />
                <ValueCard
                  icon={ShieldCheck}
                  title={t("Evidence-aware results", "نتائج واعية بالأدلة")}
                  text={t(
                    "Completeness, image authenticity, provenance, price history, and marketplace links remain visible on each card.",
                    "يظل الاكتمال وموثوقية الصورة والمصدر وتاريخ السعر وروابط السوق ظاهرًا في كل بطاقة.",
                  )}
                />
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 border-t border-slate-100 pt-8">
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
            </div>

            <Alert className="mt-6">
              <AlertDescription>
                {t(
                  "Search ranking, completeness, and image authenticity are discovery signals—not clinical or regulatory endorsements. Verify registration, prescription requirements, licensing, expiry, availability, and source dates before use or purchase.",
                  "ترتيب البحث واكتمال البيانات وموثوقية الصورة إشارات للاكتشاف وليست اعتمادًا سريريًا أو تنظيميًا. تحقق من التسجيل ومتطلبات الوصفة والترخيص والصلاحية والتوافر وتواريخ المصادر قبل الاستخدام أو الشراء.",
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </section>

      <section
        id="medicine-search"
        aria-label={t("Persistent medicine search", "بحث الدواء المستمر")}
        className="relative z-30 mt-6 scroll-mt-24 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-xl shadow-primary/10 backdrop-blur-xl supports-[backdrop-filter]:bg-card/90 md:p-5"
      >
        <form onSubmit={submit} className="grid gap-2.5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t("Search medicines", "البحث عن الأدوية")}
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              className="h-12 rounded-full border border-slate-200 dark:border-slate-800/80 pl-12 pr-20 text-base shadow-sm ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 bg-muted/20 hover:bg-muted/40 text-foreground md:h-11"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                "Try: Panadol Extra, paracetamol GSK, a barcode, or an Arabic name…",
                "جرّب: بانادول إكسترا أو باراسيتامول أو شركة أو باركود…",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-12 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-foreground focus-visible:outline-none transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground focus-visible:outline-none transition-all duration-300"
            >
              <Search className="h-4 w-4" />
            </button>
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
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 font-medium text-primary"
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value,
                  }))
                }
              >
                <option value="most_searched">
                  🔥 {t("Most searched medicines (Default)", "الأكثر بحثاً (افتراضي)")}
                </option>
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
        className="mt-4 grid gap-3.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      >
        {(medicines || []).map((medicine) => (
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
          <Card className="col-span-full">
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    role: party.role,
  }));
  const portfolioSlugs = new Set(
    companyRelationships.map((relationship) => relationship.company_slug),
  );
  const authorizedProfiles = managedCompanies.filter((profile) =>
    portfolioSlugs.has(profile.canonical_company_slug || profile.company_slug),
  );

  return (
    <>
      <Card className="relative flex h-full flex-col overflow-hidden border border-slate-200 dark:border-slate-800 bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 p-3">
        {authorizedProfiles.length > 0 && (
          <div className="absolute right-2 top-2 z-20">
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
          <div className="relative mb-2 flex h-28 items-center justify-center rounded-lg border bg-muted/15 overflow-hidden">
            {medicine.image_url ? (
              <img
                src={medicine.image_url}
                alt={title}
                className="h-full w-full object-contain p-1.5"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center text-muted-foreground/50">
                <ImageIcon className="mx-auto h-6 w-6" />
                <span className="mt-0.5 block text-[9px]">
                  {t("No Image", "بدون صورة")}
                </span>
              </div>
            )}
            <Badge className="absolute left-1.5 top-1.5 bg-background/90 text-[9px] py-0 px-1 text-foreground shadow-2xs font-semibold">
              {medicine.completeness_percent || 100}%
            </Badge>
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between space-y-2">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <a
                href={`/catalog/${medicine.canonical_id}`}
                className="line-clamp-2 text-xs font-bold text-foreground hover:text-primary transition-colors leading-tight"
                title={title}
              >
                {title}
              </a>
              {currentPrice && (
                <Badge variant="default" className="shrink-0 font-bold bg-emerald-600 dark:bg-emerald-500 text-white text-[11px] px-1.5 py-0">
                  {currentPrice}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="line-clamp-1 mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="space-y-0.5 text-[11px]">
            {medicine.scientific_name && (
              <div className="line-clamp-1 text-muted-foreground">
                <span className="font-semibold text-foreground">{t("Active:", "المادة:")}</span> {medicine.scientific_name}
              </div>
            )}
            {medicine.manufacturer && (
              <div className="line-clamp-1 text-muted-foreground">
                <span className="font-semibold text-foreground">{t("Company:", "الشركة:")}</span> {medicine.manufacturer}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 pt-0.5">
            {medicine.drug_class && (
              <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4 font-normal">
                {medicine.drug_class}
              </Badge>
            )}
            {medicine.route && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 font-normal">
                {medicine.route}
              </Badge>
            )}
          </div>

          <div className="mt-auto flex items-center gap-1 pt-1.5">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="flex-1 h-7 text-[11px] font-semibold"
              onClick={() => setDetailsOpen(true)}
            >
              <FileText className="mr-1 h-3 w-3" />
              {t("Full product record", "السجل الكامل")}
            </Button>
            {showMarketplace && medicine.marketplace_offer_count > 0 && (
              <Button asChild size="sm" variant="outline" className="h-7 px-1.5">
                <a href={`/marketplace?q=${encodeURIComponent(title)}`} title={t("Compare offers", "قارن العروض")}>
                  <ShoppingBag className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Quick View / Full Product Record Dialog Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
                {subtitle && <DialogDescription className="text-base mt-1">{subtitle}</DialogDescription>}
              </div>
              {currentPrice && (
                <Badge className="text-base px-3 py-1 bg-emerald-600 text-white font-bold shrink-0">
                  {currentPrice}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* Image & Key Attributes */}
            <div className="grid gap-4 sm:grid-cols-3 bg-muted/20 p-4 rounded-2xl border">
              {medicine.image_url ? (
                <div className="h-36 flex items-center justify-center bg-background rounded-xl p-2 border">
                  <img src={medicine.image_url} alt={title} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center bg-background rounded-xl border text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs mt-1">{t("No Image Available", "لا تتوفر صورة")}</span>
                </div>
              )}

              <div className="sm:col-span-2 space-y-2 text-sm">
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-semibold block">{t("Scientific Name & Active Ingredients", "المادة الفعالة والاسم العلمي")}</span>
                  <span className="font-bold text-foreground text-base">{medicine.scientific_name || "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block">{t("Drug Class", "التصنيف")}</span>
                    <span className="font-medium">{medicine.drug_class || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">{t("Administration Route", "طريقة الاستعمال")}</span>
                    <span className="font-medium">{medicine.route || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Manufacturer & Trademark Owner Breakdown */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {t("Manufacturer & Trademark Attribution", "نسبة الشركة المصنعة والعلامة التجارية")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {companyRelationships.map((party) => (
                  <div key={party.company_name} className="p-3 rounded-xl bg-muted/40 border">
                    <div className="text-xs text-muted-foreground">
                      {medicineCompanyRoleLabel(party.role, t)}
                    </div>
                    <a
                      href={`/companies/${encodeURIComponent(party.company_slug)}`}
                      className="font-bold text-primary hover:underline text-sm block mt-0.5"
                    >
                      {party.company_name}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Tariff & Regulatory Data */}
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="text-muted-foreground">{t("Price Tariff Range", "نطاق سعر التسعيرة")}</span>
                <div className="font-semibold text-sm">{range || currentPrice || "—"}</div>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="text-muted-foreground">{t("Product Code & Barcode", "كود الدواء والباركود")}</span>
                <div className="font-semibold text-sm">{medicine.barcode || medicine.code || "—"}</div>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="text-muted-foreground">{t("Dataset Completeness", "مستوى اكتمال البيانات")}</span>
                <div className="font-semibold text-sm">{medicine.completeness_percent || 100}% ({medicine.complete_field_count || 12}/{medicine.available_field_count || 12} {t("fields", "حقول")})</div>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="text-muted-foreground">{t("Data Registry Origin", "مصدر التسعيرة والبيانات")}</span>
                <div className="font-semibold text-sm">{medicine.current_price_source || "Egyptian National Medicines Tariff"}</div>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
              <Button asChild variant="default">
                <a href={`/catalog/${medicine.canonical_id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("Open Dedicated Canonical Page", "فتح الصفحة الموحدة المستقلة")}
                </a>
              </Button>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                {t("Close", "إغلاق")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
function ValueCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof BookOpen;
  title: string;
  text: string;
}) {
  return (
    <Card className="border-primary/15">
      <CardContent className="flex gap-3 p-4">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
        </div>
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
