import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Scan, Search, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  id_source?: "live_db" | "static_dataset" | "unknown";
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

const POPULAR_QUERIES = [
  { q: "Panadol", ar: "بنادول" },
  { q: "Augmentin", ar: "أوجمنتين" },
  { q: "Concor", ar: "كونكور" },
  { q: "Insulin", ar: "أنسولين" },
  { q: "Vitamin D", ar: "فيتامين د" },
  { q: "Amoxicillin", ar: "أموكسيسيلين" },
] as const;

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
  if (filters.scientificName) params.set("scientificName", filters.scientificName);
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

function monographHref(item: Medicine): string {
  const pub = String(item.public_url || "").trim();
  if (pub.startsWith("/medicines")) return pub;
  return encyclopediaProductUrl({
    nameEn: item.name_en || item.name_ar,
    canonicalId: item.canonical_id,
    idSource: item.id_source === "live_db" ? "live_db" : "unknown",
  });
}

export default function MedicinesEncyclopediaPage() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [location] = useLocation();

  const boot =
    typeof window !== "undefined"
      ? readQueryParams()
      : { query: "", filters: defaultFilters };
  const [query, setQuery] = useState(boot.query);
  const [filters, setFilters] = useState<Filters>(boot.filters);
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const searchRequestId = useRef(0);
  const lastUrlKey = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            if (nextFilters.drugClass && item.drug_class !== nextFilters.drugClass) {
              return false;
            }
            if (nextFilters.route && item.route !== nextFilters.route) {
              return false;
            }
            if (nextFilters.category && item.category !== nextFilters.category) {
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
            params.set("drug_class", `eq.${encodeURIComponent(nextFilters.drugClass)}`);
          }
          if (nextFilters.route) {
            params.set("route", `eq.${encodeURIComponent(nextFilters.route)}`);
          }
          if (nextFilters.category) {
            params.set("category", `eq.${encodeURIComponent(nextFilters.category)}`);
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

  // Debounced live search while typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      if (!isMedicinesPath(window.location.pathname)) return;
      writeQueryParams(query, filters);
      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void load(0, query, filters);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    writeQueryParams(query, filters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    void load(0, query, filters);
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
                "Search Egyptian pharmaceuticals, prices, active ingredients, and manufacturers.",
                "ابحث في المستحضرات الدوائية المصرية والأسعار والمواد الفعالة والشركات.",
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
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
              autoComplete="off"
              enterKeyHint="search"
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">{t("Popular:", "شائع:")}</span>
          {POPULAR_QUERIES.map((p) => (
            <button
              key={p.q}
              type="button"
              onClick={() => {
                setQuery(p.q);
                writeQueryParams(p.q, filters);
                lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                void load(0, p.q, filters);
              }}
              className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
            >
              {language === "ar" ? p.ar : p.q}
            </button>
          ))}
        </div>
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

      <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3 mb-4">
        <div>
          {loading ? (
            <span>{t("Searching catalog...", "جاري البحث في الدليل...")}</span>
          ) : (
            <span>
              {t("Showing ", "عرض ")}
              <strong className="text-foreground">{items.length}</strong>
              {t(" of ", " من ")}
              <strong className="text-foreground">{total.toLocaleString()}</strong>
              {t(" medicines", " مستحضر دوائي")}
            </span>
          )}
        </div>
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
              "Try another trade name, active ingredient, or company — or clear the search.",
              "جرب اسماً تجارياً أو مادة فعالة أو شركة أخرى — أو امسح البحث.",
            )}
          </p>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            {t("Clear search", "مسح البحث")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={`${item.canonical_id}-${item.name_en}`}
              className="group hover:shadow-md transition-all duration-200 border-border hover:border-emerald-500/40 flex flex-col justify-between overflow-hidden"
            >
              <a
                href={monographHref(item)}
                className="block relative aspect-[4/3] bg-muted/40 overflow-hidden border-b border-border"
              >
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
                      <p className="text-xs text-muted-foreground dir-rtl mt-0.5">{item.name_ar}</p>
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
                      <span className="font-medium text-foreground">{item.manufacturer}</span>
                    </div>
                  )}
                  {item.drug_class && <div className="truncate">📋 {item.drug_class}</div>}
                  {(item.dosage_form || item.strength) && (
                    <div className="truncate">
                      💊 {[item.dosage_form, item.strength].filter(Boolean).join(" • ")}
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
        <div className="flex items-center justify-between pt-6 border-t mt-6">
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
    </div>
  );
}
