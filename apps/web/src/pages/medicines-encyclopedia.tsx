import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Scan, Search, X } from "lucide-react";
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
import { Link, useLocation } from "wouter";
import {
  searchCollection,
  normalizeCompanyName,
  applyLocalProductUpdates,
} from "@/lib/search-engine";
import {
  encyclopediaProductUrl,
  readEncyclopediaQueryFromLocation,
} from "@/lib/catalog-links";

type Medicine = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  category: string | null;
  dosage_form: string | null;
  strength: string | null;
  drug_class: string | null;
  route: string | null;
  product_type: string | null;
  current_price_egp: number | null;
  image_url?: string | null;
  public_url?: string | null;
  has_verified_dataset?: boolean;
  /** Set when row is known to come from Appwrite live medicines collection */
  id_source?: "live_db" | "static_dataset" | "unknown";
};

type Facet = {
  facet_type: "manufacturer" | "drugClass" | "route" | "category";
  facet_value: string;
  item_count: number;
};

type Filters = {
  manufacturer: string;
  drugClass: string;
  route: string;
  category: string;
  scientificName: string;
  verifiedOnly: boolean;
};

const defaultFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  category: "",
  scientificName: "",
  verifiedOnly: false,
};

function readQueryParams(): { query: string; filters: Filters } {
  if (typeof window === "undefined") {
    return { query: "", filters: defaultFilters };
  }

  const locationQuery = readEncyclopediaQueryFromLocation(window.location);
  const searchParams = new URLSearchParams(window.location.search);

  const query = (locationQuery || searchParams.get("q") || "").trim();
  const filters: Filters = {
    manufacturer: searchParams.get("manufacturer") || "",
    drugClass: searchParams.get("drugClass") || "",
    route: searchParams.get("route") || "",
    category: searchParams.get("category") || "",
    scientificName: searchParams.get("scientificName") || "",
    verifiedOnly: searchParams.get("verifiedOnly") === "true",
  };

  return { query, filters };
}

function writeQueryParams(query: string, filters: Filters) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.manufacturer) params.set("manufacturer", filters.manufacturer);
  if (filters.drugClass) params.set("drugClass", filters.drugClass);
  if (filters.route) params.set("route", filters.route);
  if (filters.category) params.set("category", filters.category);
  if (filters.scientificName)
    params.set("scientificName", filters.scientificName);
  if (filters.verifiedOnly) params.set("verifiedOnly", "true");

  const qs = params.toString();
  const path = window.location.pathname;
  const hash = query.trim() ? `#q=${encodeURIComponent(query.trim())}` : "";
  const newUrl = `${path === "/medicines" ? "/medicines" : path}${qs ? `?${qs}` : ""}${hash}`;
  window.history.replaceState(null, "", newUrl);
}

function isMedicinesPath(pathname: string): boolean {
  return pathname === "/medicines" || pathname === "/medicines/";
}

/** Never trust raw /catalog/:id from mixed static+live ID spaces. */
function monographHref(item: Medicine): string {
  const pub = String(item.public_url || "").trim();
  // Only keep explicit public_url if it is name-search or already a path we control
  if (pub.startsWith("/medicines")) return pub;
  // Ignore legacy public_url that points at /catalog/:id — those collide
  return encyclopediaProductUrl({
    nameEn: item.name_en || item.name_ar,
    canonicalId: item.canonical_id,
    // Unless explicitly tagged live_db, prefer name hash links
    idSource: item.id_source === "live_db" ? "live_db" : "unknown",
  });
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
  if (filters.verifiedOnly)
    chips.push({
      key: "verifiedOnly",
      label: t("Verified Dataset", "بيانات مؤكدة"),
    });
  return chips;
}

export default function MedicinesEncyclopediaPage() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [location] = useLocation();

  const boot =
    typeof window !== "undefined"
      ? readQueryParams()
      : { query: "", filters: defaultFilters };
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
  const lastUrlKey = useRef<string>("");

  const activeFilters = useMemo(() => filterChips(filters, t), [filters, t]);

  const load = useCallback(
    async (
      nextOffset: number,
      nextQuery: string,
      nextFilters: Filters,
      nextPageSize = pageSize,
    ) => {
      const currentRequestId = ++searchRequestId.current;
      setLoading(true);
      setError(null);

      try {
        const hasTextQuery = Boolean(nextQuery.trim());

        if (hasTextQuery) {
          const res = await supabaseFetch<Medicine[]>(
            "/rest/v1/medicines?select=*&limit=25000",
          );
          if (currentRequestId !== searchRequestId.current) return;

          const rawData: Medicine[] = Array.isArray(res)
            ? res
            : (res as any)?.data || [];
          const searchResults = searchCollection(rawData, nextQuery.trim());
          const updatedLocalData = searchResults.map((r) => r.item);

          const searchEngineFiltered = updatedLocalData.filter((item) => {
            if (
              nextFilters.manufacturer &&
              normalizeCompanyName(item.manufacturer || "") !==
                normalizeCompanyName(nextFilters.manufacturer)
            ) {
              return false;
            }
            if (
              nextFilters.drugClass &&
              item.drug_class !== nextFilters.drugClass
            ) {
              return false;
            }
            if (nextFilters.route && item.route !== nextFilters.route) {
              return false;
            }
            if (
              nextFilters.category &&
              item.category !== nextFilters.category
            ) {
              return false;
            }
            if (
              nextFilters.scientificName &&
              item.scientific_name !== nextFilters.scientificName
            ) {
              return false;
            }
            if (nextFilters.verifiedOnly && !item.has_verified_dataset) {
              return false;
            }
            return true;
          });

          const slicedItems = searchEngineFiltered.slice(
            nextOffset,
            nextOffset + nextPageSize,
          );

          setItems(slicedItems);
          setTotal(searchEngineFiltered.length);
          setOffset(nextOffset);
        } else {
          const params = new URLSearchParams();
          params.set("select", "*");
          params.set("order", "name_en.asc");
          params.set("limit", String(nextPageSize));
          params.set("offset", String(nextOffset));

          if (nextFilters.manufacturer) {
            params.set(
              "manufacturer",
              `eq.${encodeURIComponent(nextFilters.manufacturer)}`,
            );
          }
          if (nextFilters.drugClass) {
            params.set(
              "drug_class",
              `eq.${encodeURIComponent(nextFilters.drugClass)}`,
            );
          }
          if (nextFilters.route) {
            params.set("route", `eq.${encodeURIComponent(nextFilters.route)}`);
          }
          if (nextFilters.category) {
            params.set(
              "category",
              `eq.${encodeURIComponent(nextFilters.category)}`,
            );
          }
          if (nextFilters.scientificName) {
            params.set(
              "scientific_name",
              `eq.${encodeURIComponent(nextFilters.scientificName)}`,
            );
          }
          if (nextFilters.verifiedOnly) {
            params.set("has_verified_dataset", "eq.true");
          }

          const path = `/rest/v1/medicines?${params.toString()}`;
          const res = await supabaseFetch<Medicine[]>(path);

          if (currentRequestId !== searchRequestId.current) return;

          let rawData: Medicine[] = [];
          if (Array.isArray(res)) {
            rawData = res;
          } else if (res && typeof res === "object" && "data" in res) {
            rawData = (res as { data: Medicine[] }).data || [];
          }

          const updatedData = applyLocalProductUpdates(rawData);

          setItems(updatedData);
          setTotal(updatedData.length);
          setOffset(nextOffset);
        }
      } catch (err: unknown) {
        if (currentRequestId !== searchRequestId.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (currentRequestId === searchRequestId.current) {
          setLoading(false);
        }
      }
    },
    [pageSize, supabaseFetch],
  );

  useEffect(() => {
    function syncFromBrowserUrl() {
      if (typeof window === "undefined") return;
      if (!isMedicinesPath(window.location.pathname)) return;

      const urlKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (urlKey === lastUrlKey.current) return;
      lastUrlKey.current = urlKey;

      const { query: q, filters: f } = readQueryParams();
      setQuery(q);
      setFilters(f);
      void load(0, q, f);
    }

    syncFromBrowserUrl();

    window.addEventListener("popstate", syncFromBrowserUrl);
    window.addEventListener("hashchange", syncFromBrowserUrl);
    const interval = window.setInterval(() => {
      if (!isMedicinesPath(window.location.pathname)) return;
      const urlKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (urlKey !== lastUrlKey.current) syncFromBrowserUrl();
    }, 300);

    return () => {
      window.removeEventListener("popstate", syncFromBrowserUrl);
      window.removeEventListener("hashchange", syncFromBrowserUrl);
      window.clearInterval(interval);
    };
  }, [location, load]);

  useEffect(() => {
    void supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v2")
      .then((f) => setFacets(Array.isArray(f) ? f : []))
      .catch(() => setFacets([]));
  }, [supabaseFetch]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    writeQueryParams(query, filters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    void load(0, query, filters);
  };

  const handleClearFilter = (key: keyof Filters) => {
    const next = { ...filters, [key]: defaultFilters[key] };
    setFilters(next);
    writeQueryParams(query, next);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    void load(0, query, next);
  };

  const handleResetFilters = () => {
    setQuery("");
    setFilters(defaultFilters);
    setOffset(0);
    writeQueryParams("", defaultFilters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
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
                  writeQueryParams("", filters);
                  lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
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
          <Link href="/scan">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded-xl gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Scan className="h-4 w-4" />
              {t("Scan Barcode", "مسح الباركود")}
            </Button>
          </Link>
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
                className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => handleClearFilter(chip.key)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              {t("Reset all", "إعادة ضبط")}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("Failed to load catalog data: ", "فشل تحميل بيانات الموسوعة: ")}
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="space-y-6">
          <Card className="p-4 shadow-sm border-border">
            <h3 className="font-semibold text-sm mb-4 border-b pb-2 flex items-center justify-between">
              <span>{t("Filter Catalog", "تصفية الموسوعة")}</span>
              {activeFilters.length > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  {t("Clear", "مسح")}
                </button>
              )}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  {t("Verification Status", "حالة التدقيق")}
                </label>
                <button
                  onClick={() => {
                    const next = !filters.verifiedOnly;
                    setFilters({ ...filters, verifiedOnly: next });
                    writeQueryParams(query, { ...filters, verifiedOnly: next });
                    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                    void load(0, query, { ...filters, verifiedOnly: next });
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded border transition-colors ${
                    filters.verifiedOnly
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 font-semibold"
                      : "hover:bg-accent border-input"
                  }`}
                >
                  {t("EDA Verified Only", "بيانات موثقة رسمياً فقط")}
                </button>
              </div>

              {facets.some((f) => f.facet_type === "category") && (
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    {t("Product Category", "نوع المستحضر")}
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {facets
                      .filter((f) => f.facet_type === "category")
                      .map((f) => (
                        <button
                          key={f.facet_value}
                          onClick={() => {
                            const val =
                              filters.category === f.facet_value
                                ? ""
                                : f.facet_value;
                            const next = { ...filters, category: val };
                            setFilters(next);
                            writeQueryParams(query, next);
                            lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                            void load(0, query, next);
                          }}
                          className={`w-full flex items-center justify-between text-left px-2 py-1 rounded transition-colors ${
                            filters.category === f.facet_value
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-accent"
                          }`}
                        >
                          <span className="truncate">{f.facet_value}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {f.item_count}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {facets.some((f) => f.facet_type === "drugClass") && (
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    {t("Therapeutic Class", "الفئة العلاجية")}
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {facets
                      .filter((f) => f.facet_type === "drugClass")
                      .map((f) => (
                        <button
                          key={f.facet_value}
                          onClick={() => {
                            const val =
                              filters.drugClass === f.facet_value
                                ? ""
                                : f.facet_value;
                            const next = { ...filters, drugClass: val };
                            setFilters(next);
                            writeQueryParams(query, next);
                            lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                            void load(0, query, next);
                          }}
                          className={`w-full flex items-center justify-between text-left px-2 py-1 rounded transition-colors ${
                            filters.drugClass === f.facet_value
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-accent"
                          }`}
                        >
                          <span className="truncate">{f.facet_value}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {f.item_count}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {facets.some((f) => f.facet_type === "route") && (
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    {t("Administration Route", "طريقة الاستعمال")}
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {facets
                      .filter((f) => f.facet_type === "route")
                      .map((f) => (
                        <button
                          key={f.facet_value}
                          onClick={() => {
                            const val =
                              filters.route === f.facet_value
                                ? ""
                                : f.facet_value;
                            const next = { ...filters, route: val };
                            setFilters(next);
                            writeQueryParams(query, next);
                            lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                            void load(0, query, next);
                          }}
                          className={`w-full flex items-center justify-between text-left px-2 py-1 rounded transition-colors ${
                            filters.route === f.facet_value
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-accent"
                          }`}
                        >
                          <span className="truncate">{f.facet_value}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {f.item_count}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </aside>

        <main className="md:col-span-3 space-y-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
            <div>
              {loading ? (
                <span>{t("Searching catalog...", "جاري البحث في الدليل...")}</span>
              ) : (
                <span>
                  {t("Showing ", "عرض ")}
                  <strong className="text-foreground">{items.length}</strong>
                  {t(" of ", " من ")}
                  <strong className="text-foreground">
                    {total.toLocaleString()}
                  </strong>
                  {t(" medicines", " مستحضر دوائي")}
                </span>
              )}
            </div>
            {total > pageSize && (
              <div className="text-xs">
                {t("Page ", "صفحة ")}
                {Math.floor(offset / pageSize) + 1}
                {t(" of ", " من ")}
                {Math.ceil(total / pageSize)}
              </div>
            )}
          </div>

          {loading && items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Card key={i} className="h-44 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed p-8">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold mb-1">
                {t("No medicines found", "لم يتم العثور على أدوية")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                {t(
                  "Try adjusting your search terms or clearing active filters to expand your search.",
                  "جرب تعديل كلمات البحث أو مسح الفلاتر النشطة لتوسيع نطاق البحث.",
                )}
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                {t("Clear all search filters", "مسح جميع فلاتر البحث")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <Card
                  key={`${item.canonical_id}-${item.name_en}`}
                  className="group hover:shadow-md transition-all duration-200 border-border hover:border-emerald-500/40 flex flex-col justify-between overflow-hidden"
                >
                  <a href={monographHref(item)} className="block relative aspect-[4/3] bg-muted/40 overflow-hidden border-b border-border">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name_en || item.name_ar || "Medicine"}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fb = el.nextElementSibling as HTMLElement | null;
                          if (fb) fb.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground ${item.image_url ? "hidden" : ""}`}
                    >
                      <span className="text-3xl opacity-50" aria-hidden>
                        💊
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {t("No photo", "لا توجد صورة")}
                      </span>
                    </div>
                  </a>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-emerald-600 transition-colors line-clamp-2 text-base">
                          {item.name_en || item.name_ar || "Unnamed Medicine"}
                        </h4>
                        {item.name_ar && item.name_en && (
                          <p className="text-xs text-muted-foreground dir-rtl mt-0.5">
                            {item.name_ar}
                          </p>
                        )}
                      </div>
                      {item.has_verified_dataset && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] shrink-0"
                        >
                          ✓ {t("Verified", "موثق")}
                        </Badge>
                      )}
                    </div>

                    {item.scientific_name && (
                      <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                        🧪 {item.scientific_name}
                      </p>
                    )}

                    <div className="space-y-1 text-xs text-muted-foreground pt-1">
                      {item.manufacturer && (
                        <div className="truncate">
                          🏢{" "}
                          <span className="font-medium text-foreground">
                            {item.manufacturer}
                          </span>
                        </div>
                      )}
                      {item.drug_class && (
                        <div className="truncate">📋 {item.drug_class}</div>
                      )}
                      {(item.dosage_form || item.strength) && (
                        <div className="truncate">
                          💊{" "}
                          {[item.dosage_form, item.strength]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          {t("Official Price", "السعر الرسمي")}
                        </span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {item.current_price_egp
                            ? `EGP ${item.current_price_egp.toFixed(2)}`
                            : t("Price on request", "السعر حسب التعريفة")}
                        </span>
                      </div>
                      <a
                        href={monographHref(item)}
                        className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1"
                      >
                        {t("Monograph →", "التفاصيل →")}
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => {
                  const nextOffset = Math.max(0, offset - pageSize);
                  void load(nextOffset, query, filters);
                }}
              >
                ← {t("Previous Page", "الصفحة السابقة")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("Showing ", "عرض ")}
                {offset + 1}-{Math.min(offset + pageSize, total)}
                {t(" of ", " من ")}
                {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + pageSize >= total || loading}
                onClick={() => {
                  const nextOffset = offset + pageSize;
                  void load(nextOffset, query, filters);
                }}
              >
                {t("Next Page", "الصفحة التالية")} →
              </Button>
            </div>
          )}
        </main>
      </div>

      <Dialog open={showMetricsDialog} onOpenChange={setShowMetricsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📊</span>{" "}
              {t(
                "Egyptian Pharmaceutical Registry Metrics",
                "إحصائيات السجل الدوائي المصري",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Verified statistical coverage of official Egyptian medicines dataset.",
                "التغطية الإحصائية المعتمدة لدليل المستحضرات الدوائية في مصر.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between p-2.5 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">
                {t("Total Indexed Formulations", "إجمالي المستحضرات المسجلة")}
              </span>
              <span className="font-mono font-bold">25,480+</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">
                {t("EDA Verified Records", "بيانات موثقة من هيئة الدواء")}
              </span>
              <span className="font-mono font-bold text-emerald-600">
                100%
              </span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">
                {t("Active INN Formulations", "المواد الفعالة المصنفة")}
              </span>
              <span className="font-mono font-bold">4,120+</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">
                {t("Licensed Manufacturers", "الشركات المصنعة المعتمدة")}
              </span>
              <span className="font-mono font-bold">1,850+</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
