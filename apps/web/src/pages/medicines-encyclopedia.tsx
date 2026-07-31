import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLocation, useSearch } from "wouter";
import {
  searchCollection,
  normalizeCompanyName,
  applyLocalProductUpdates,
} from "@/lib/search-engine";

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
  image_source_url?: string | null;
  image_source_domain?: string | null;
  image_source_kind?: string | null;
  image_authenticity_score?: number;
  image_match_score?: number;
  image_is_verified?: boolean;
  barcode: string | null;
  code: string | null;
  current_price_egp: number | null;
  price_currency: string | null;
  min_price_egp?: number | null;
  max_price_egp?: number | null;
  price_observation_count?: number;
  distinct_price_count?: number;
  has_price_history?: boolean;
  source_record_count?: number;
  source_count?: number;
  source_systems?: string[];
  has_verified_dataset?: boolean;
  has_company_verified_source?: boolean;
  marketplace_offer_count?: number;
  marketplace_seller_count?: number;
  lowest_marketplace_price_egp?: number | null;
  current_price_source?: string | null;
  complete_field_count?: number;
  available_field_count?: number;
  completeness_score?: number;
  completeness_percent?: number;
  relevance?: number;
  match_reason?: string;
  matched_terms?: number;
  total_count?: number;
};

type Facet = {
  facet_type: string;
  facet_value: string;
  product_count: number;
};

type Filters = {
  manufacturer: string;
  drugClass: string;
  route: string;
  category: string;
  scientificName: string;
  sourceSystem: string;
  minPrice: string;
  maxPrice: string;
  historyOnly: boolean;
  verifiedOnly: boolean;
  offersOnly: boolean;
  imageOnly: boolean;
  minCompleteness: string;
  queryMode: string;
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
  historyOnly: false,
  verifiedOnly: false,
  offersOnly: false,
  imageOnly: false,
  minCompleteness: "",
  queryMode: "hybrid",
  sort: "relevance",
};

function readQueryParams(): { query: string; filters: Filters } {
  if (typeof window === "undefined")
    return { query: "", filters: { ...defaultFilters } };
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get("q") || params.get("query") || "",
    filters: {
      ...defaultFilters,
      manufacturer: params.get("manufacturer") || "",
      drugClass: params.get("drugClass") || "",
      route: params.get("route") || "",
      category: params.get("category") || "",
      scientificName: params.get("scientificName") || "",
      sourceSystem: params.get("sourceSystem") || "",
      minPrice: params.get("minPrice") || "",
      maxPrice: params.get("maxPrice") || "",
      historyOnly: params.get("historyOnly") === "true",
      verifiedOnly: params.get("verifiedOnly") === "true",
      offersOnly: params.get("offersOnly") === "true",
      imageOnly: params.get("imageOnly") === "true",
      minCompleteness: params.get("minCompleteness") || "",
      queryMode: params.get("queryMode") || "hybrid",
      sort: params.get("sort") || "relevance",
    },
  };
}

function updateQueryParams(query: string, filters: Filters) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.manufacturer) params.set("manufacturer", filters.manufacturer);
  if (filters.drugClass) params.set("drugClass", filters.drugClass);
  if (filters.route) params.set("route", filters.route);
  if (filters.category) params.set("category", filters.category);
  if (filters.scientificName)
    params.set("scientificName", filters.scientificName);
  if (filters.sourceSystem) params.set("sourceSystem", filters.sourceSystem);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.historyOnly) params.set("historyOnly", "true");
  if (filters.verifiedOnly) params.set("verifiedOnly", "true");
  if (filters.offersOnly) params.set("offersOnly", "true");
  if (filters.imageOnly) params.set("imageOnly", "true");
  if (filters.minCompleteness)
    params.set("minCompleteness", filters.minCompleteness);
  if (filters.queryMode !== "hybrid") params.set("queryMode", filters.queryMode);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);

  const qs = params.toString();
  const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (newUrl !== current) {
    window.history.replaceState(null, "", newUrl);
  }
}

function numberOrNull(val: string): number | null {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
}

function filterChips(filters: Filters, t: (en: string, ar: string) => string) {
  const chips: { key: keyof Filters; label: string }[] = [];
  if (filters.manufacturer)
    chips.push({
      key: "manufacturer",
      label: `${t("Company", "الشركة")}: ${filters.manufacturer}`,
    });
  if (filters.drugClass)
    chips.push({
      key: "drugClass",
      label: `${t("Class", "الفئة")}: ${filters.drugClass}`,
    });
  if (filters.route)
    chips.push({
      key: "route",
      label: `${t("Route", "طريقة الاستعمال")}: ${filters.route}`,
    });
  if (filters.category)
    chips.push({
      key: "category",
      label: `${t("Type", "النوع")}: ${filters.category}`,
    });
  if (filters.scientificName)
    chips.push({
      key: "scientificName",
      label: `${t("Active INN", "المادة الفعالة")}: ${filters.scientificName}`,
    });
  if (filters.sourceSystem)
    chips.push({
      key: "sourceSystem",
      label: `${t("Source", "المصدر")}: ${filters.sourceSystem}`,
    });
  if (filters.minPrice)
    chips.push({ key: "minPrice", label: `Min ${filters.minPrice} EGP` });
  if (filters.maxPrice)
    chips.push({ key: "maxPrice", label: `Max ${filters.maxPrice} EGP` });
  if (filters.historyOnly)
    chips.push({
      key: "historyOnly",
      label: t("Price History", "سجل التغير"),
    });
  if (filters.verifiedOnly)
    chips.push({
      key: "verifiedOnly",
      label: t("Verified Dataset", "بيانات مؤكدة"),
    });
  if (filters.offersOnly)
    chips.push({
      key: "offersOnly",
      label: t("Marketplace Offers", "عروض الصيدليات"),
    });
  if (filters.imageOnly)
    chips.push({ key: "imageOnly", label: t("Has Image", "يتوفر صورة") });
  return chips;
}

export default function MedicinesEncyclopediaPage() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [location] = useLocation();
  // wouter search string ("?q=..." or "") — critical for SPA nav to /medicines?q=
  const [searchString] = useSearch();

  const boot = readQueryParams();
  const [query, setQuery] = useState(boot.query);
  const [filters, setFilters] = useState<Filters>(boot.filters);
  const [items, setItems] = useState<Medicine[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [showMetricsDialog, setShowMetricsDialog] = useState(false);
  const searchRequestId = useRef(0);
  const lastSyncedSearch = useRef<string | null>(null);

  const activeFilters = useMemo(() => filterChips(filters, t), [filters, t]);

  const load = useCallback(
    async (
      nextOffset = 0,
      nextQuery = query,
      nextFilters = filters,
      nextPageSize = pageSize,
    ) => {
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
          return (
            !nameLower.includes("mapped legacy") &&
            !nameLower.includes("unmapped legacy") &&
            !nameLower.includes("legacy placeholder")
          );
        });
        safeRows = applyLocalProductUpdates(safeRows);

        // Static dataset fallback when RPC returns nothing
        if (safeRows.length === 0) {
          try {
            const res = await fetch("/data/egyptian-medicines-dataset.json");
            const dataset = await res.json();
            if (dataset && Array.isArray(dataset.medicines)) {
              const searchResults = searchCollection(
                dataset.medicines,
                nextQuery,
              );
              let matchedItems = searchResults.map((r) => r.item);

              if (nextFilters.manufacturer.trim()) {
                const mfgKey = normalizeCompanyName(nextFilters.manufacturer);
                matchedItems = matchedItems.filter(
                  (m) =>
                    normalizeCompanyName(m.manufacturer || "") === mfgKey,
                );
              }

              const totalFallback = matchedItems.length;
              const sliced = matchedItems.slice(
                nextOffset,
                nextOffset + nextPageSize,
              );
              safeRows = sliced.map((item: any) => ({
                ...item,
                canonical_key: `med_${item.canonical_id}`,
                total_count: totalFallback,
              }));
            }
          } catch {
            /* ignore */
          }
        }

        if (requestId === searchRequestId.current) {
          setItems(safeRows);
          setTotal(safeRows[0]?.total_count ?? safeRows.length);
          setOffset(nextOffset);
          updateQueryParams(nextQuery, nextFilters);
        }
      } catch (err: any) {
        if (requestId === searchRequestId.current) {
          setError(
            err.message ||
              t("Failed to load medicines.", "فشل تحميل قائمة الأدوية."),
          );
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (requestId === searchRequestId.current) {
          setLoading(false);
        }
      }
    },
    [filters, pageSize, query, supabaseFetch, t],
  );

  // Keep React state + results in sync with ?q= (and filters) in the URL.
  // Fires on first mount, SPA navigations to /medicines?q=…, and back/forward.
  useEffect(() => {
    const syncKey = `${location}${searchString}`;
    if (lastSyncedSearch.current === syncKey) return;
    lastSyncedSearch.current = syncKey;

    const { query: qFromUrl, filters: fFromUrl } = readQueryParams();
    setQuery(qFromUrl);
    setFilters(fFromUrl);
    void load(0, qFromUrl, fFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional URL-driven sync
  }, [location, searchString]);

  useEffect(() => {
    void supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v2")
      .then((f) => setFacets(Array.isArray(f) ? f : []))
      .catch(() => setFacets([]));
  }, [supabaseFetch]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    lastSyncedSearch.current = null; // allow URL write from load
    void load(0, query, filters);
  };

  const handleClearFilter = (key: keyof Filters) => {
    const next = { ...filters, [key]: defaultFilters[key] };
    setFilters(next);
    lastSyncedSearch.current = null;
    void load(0, query, next);
  };

  const handleResetFilters = () => {
    setQuery("");
    setFilters(defaultFilters);
    setOffset(0);
    lastSyncedSearch.current = null;
    void load(0, "", defaultFilters);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <span>💊</span>{" "}
              {t(
                "Medicines Encyclopedia & Price Catalog",
                "موسوعة الأدوية ودليل الأسعار",
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "Search over 25,000 verified Egyptian pharmaceuticals, prices, active ingredients, and manufacturing entities.",
                "ابحث في أكثر من ٢٥,٠٠٠ مستحضر دوائي مصري موثق، الأسعار الرسمية، المواد الفعالة والشركات المصنعة.",
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetricsDialog(true)}
            className="text-xs font-semibold"
          >
            📊 {t("Dataset Registry Metrics", "إحصائيات السجل الدوائي")}
          </Button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Search by trade name, active INN, barcode, or company…",
                "ابحث باسم الدواء، المادة الفعالة، الباركود، أو اسم الشركة…",
              )}
              className="pl-9 pr-4 py-2.5 rounded-xl border-emerald-500/20 focus:border-emerald-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  lastSyncedSearch.current = null;
                  void load(0, "", filters);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
          >
            {t("Search Catalog", "بحث الدليل")}
          </Button>
        </form>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground font-semibold">
              {t("Active Filters:", "الفلاتر النشطة:")}
            </span>
            {activeFilters.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="gap-1 text-xs py-1 px-2.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
              >
                {chip.label}
                <X
                  className="h-3 w-3 cursor-pointer ml-1"
                  onClick={() => handleClearFilter(chip.key)}
                />
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-destructive hover:bg-destructive/10 h-7 px-2"
            >
              {t("Clear All", "مسح الكل")}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="animate-pulse h-48 bg-muted/40 border-border"
            />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="my-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Alert className="my-6 border-amber-500/30 bg-amber-50 dark:bg-amber-950/30">
          <AlertDescription className="text-center py-6 text-sm">
            {query.trim()
              ? t(
                  `No products matched “${query.trim()}”. Try a shorter name or clear filters.`,
                  `لا توجد منتجات مطابقة لـ “${query.trim()}”. جرّب اسماً أقصر أو امسح الفلاتر.`,
                )
              : t(
                  "No medicine products matched your search parameters.",
                  "لم يتم العثور على أدوية مطابقة لمعايير البحث الحالية.",
                )}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={handleResetFilters}>
                {t("Reset Search Criteria", "إعادة ضبط جميع الفلاتر")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.canonical_id}
              className="group relative flex flex-col justify-between border-border hover:border-emerald-500/50 hover:shadow-lg transition-all duration-200 overflow-hidden bg-card"
            >
              <div className="h-36 w-full overflow-hidden bg-slate-50 dark:bg-slate-900 border-b flex items-center justify-center p-2 relative">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name_en || "Medicine"}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-600">
                    <span className="text-3xl">💊</span>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                      {item.category || "Pharmaceutical"}
                    </span>
                  </div>
                )}
              </div>
              <CardContent className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {item.name_en}
                      </h3>
                      {item.name_ar && (
                        <p
                          className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1"
                          dir="rtl"
                        >
                          {item.name_ar}
                        </p>
                      )}
                    </div>
                    {item.current_price_egp !== null &&
                      item.current_price_egp !== undefined && (
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-lg">
                            {item.current_price_egp}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground block -mt-1 uppercase">
                            EGP
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-foreground">
                        🔬 {t("Active INN:", "المادة الفعالة:")}
                      </span>
                      <span className="truncate">
                        {item.scientific_name || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-foreground">
                        🏢 {t("Manufacturer:", "الشركة المصنعة:")}
                      </span>
                      <span className="truncate">
                        {item.manufacturer || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between mt-auto">
                  <a
                    href={`/catalog/${item.canonical_id}`}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1"
                  >
                    {t(
                      "View Full Monograph & Offers →",
                      "عرض النشرة وسجل الأسعار ←",
                    )}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {t("Showing", "عرض")} {offset + 1} -{" "}
            {Math.min(offset + pageSize, total)} {t("of", "من")} {total}{" "}
            {t("results", "نتيجة")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => void load(Math.max(0, offset - pageSize))}
            >
              {t("Previous", "السابق")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + pageSize >= total || loading}
              onClick={() => void load(offset + pageSize)}
            >
              {t("Next", "التالي")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showMetricsDialog} onOpenChange={setShowMetricsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Dataset Registry Metrics", "إحصائيات السجل الدوائي")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Facet counts load from the encyclopedia index when available.",
                "تُحمّل أعداد التصنيفات من فهرس الموسوعة عند التوفر.",
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Facet rows:", "صفوف التصنيف:")} {facets.length}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
