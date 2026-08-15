import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Globe2, LayoutGrid, LayoutList, Loader2, Rows3, Scan, Search, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { Link, useLocation } from "wouter";
import {
  encyclopediaProductUrl,
  readEncyclopediaQueryFromLocation,
} from "@/lib/catalog-links";
import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";
import { applyLocalProductUpdates } from "@/lib/search-engine";
import {
  adaptiveRankMedicineResults,
  recordAdaptiveEvent,
  resolveAdaptiveQuery,
} from "@/lib/adaptive";
import { MobileVoiceSearchButton } from "@/components/mobile-voice-search-button";
import { SearchRankingExamples } from "@/components/search-ranking-examples";
import { CatalogEmptyState } from "@/components/catalog-empty-state";

type Medicine = MedicineListItem;

type Filters = {
  manufacturer: string;
  drugClass: string;
  route: string;
  category: string;
  scientificName: string;
  verifiedOnly: boolean;
  medCareOnly: boolean;
};

const defaultFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  category: "",
  scientificName: "",
  verifiedOnly: false,
  medCareOnly: false,
};

const PAGE_SIZE = 24;

type CatalogView = "grid" | "comfortable" | "list";
const VIEW_STORAGE_KEY = "msh.medicines.catalogView";

function readStoredView(): CatalogView {
  if (typeof window === "undefined") return "grid";
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "grid" || v === "comfortable" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return "grid";
}

function writeStoredView(view: CatalogView) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}

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
    medCareOnly:
      searchParams.get("medCare") === "1" ||
      searchParams.get("medCareOnly") === "true",
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
  if (filters.medCareOnly) params.set("medCare", "1");
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

function displayImageUrl(url?: string | null): string | null {
  if (!url || !String(url).trim()) return null;
  if (/unsplash\.com|placeholder|via\.placeholder|no_image/i.test(url)) return null;
  return url;
}

export default function MedicinesEncyclopediaPage() {
  const { t, language } = useLanguage();
  const [location] = useLocation();

  const boot =
    typeof window !== "undefined"
      ? readQueryParams()
      : { query: "", filters: defaultFilters };
  const [query, setQuery] = useState(boot.query);
  const [filters, setFilters] = useState<Filters>(boot.filters);
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"appwrite" | "static_fallback" | null>(null);
  const [view, setView] = useState<CatalogView>(() => readStoredView());
  const setCatalogView = useCallback((next: CatalogView) => {
    setView(next);
    writeStoredView(next);
  }, []);
  const [showIngredient, setShowIngredient] = useState(true);
  const [showDrugClass, setShowDrugClass] = useState(false);
  const [showManufacturer, setShowManufacturer] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("msh.medicines.cardFields");
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.scientificName === "boolean") setShowIngredient(p.scientificName);
      if (typeof p.drugClass === "boolean") setShowDrugClass(p.drugClass);
      if (typeof p.manufacturer === "boolean") setShowManufacturer(p.manufacturer);
    } catch {
      /* ignore */
    }
  }, []);

  const persistFields = (next: {
    scientificName: boolean;
    drugClass: boolean;
    manufacturer: boolean;
  }) => {
    try {
      localStorage.setItem("msh.medicines.cardFields", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const searchRequestId = useRef(0);
  const lastUrlKey = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLock = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const searchAttrRef = useRef<string | null>(null);

  const load = useCallback(
    async (
      nextQuery: string,
      nextFilters: Filters,
      mode: "replace" | "append" = "replace",
      cursorAfter: string | null = null,
    ) => {
      const currentRequestId = ++searchRequestId.current;
      if (mode === "replace") {
        setError(null);
        searchAttrRef.current = null;
        setItems((prev) => {
          if (prev.length === 0) {
            setLoading(true);
            setIsRefreshing(false);
          } else {
            setLoading(false);
            setIsRefreshing(true);
          }
          return prev;
        });
      } else {
        setLoadingMore(true);
      }

      try {
        const page = await fetchMedicinesPage({
          limit: PAGE_SIZE,
          cursorAfter: mode === "append" ? cursorAfter : null,
          filters: {
            query: nextQuery,
            manufacturer: nextFilters.manufacturer,
            drugClass: nextFilters.drugClass,
            route: nextFilters.route,
            category: nextFilters.category,
            scientificName: nextFilters.scientificName,
            verifiedOnly: nextFilters.verifiedOnly,
            medCareOnly: nextFilters.medCareOnly,
            searchAttr: mode === "append" ? searchAttrRef.current : null,
          },
        });

        if (currentRequestId !== searchRequestId.current) return;

        if (page.searchAttr) searchAttrRef.current = page.searchAttr;

        const ranked = adaptiveRankMedicineResults(
          applyLocalProductUpdates(page.items) as Medicine[],
          nextQuery,
        );
        setTotal(page.total);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
        nextCursorRef.current = page.nextCursor;
        setDataSource(page.source);

        if (mode === "replace") {
          const q = (nextQuery || "").trim();
          if (q) {
            recordAdaptiveEvent({
              type: ranked.length > 0 ? "search_success" : "search_empty",
              query: resolveAdaptiveQuery(q).primary,
            });
          }
        }

        if (mode === "append") {
          setItems((prev) => {
            const seen = new Set(
              prev.map((p) => p.$id || `${p.canonical_id}|${p.name_en}`),
            );
            const merged = [...prev];
            for (const row of ranked) {
              const k = row.$id || `${row.canonical_id}|${row.name_en}`;
              if (!seen.has(k)) {
                seen.add(k);
                merged.push(row);
              }
            }
            return merged;
          });
        } else {
          setItems(ranked);
          if (typeof window !== "undefined" && (nextQuery || "").trim()) {
            requestAnimationFrame(() => {
              resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
        }

        if (page.connectionError && page.items.length === 0) {
          setError(
            page.errorMessage ||
              t(
                "Live catalog unavailable — check Appwrite connection.",
                "الموسوعة المباشرة غير متاحة — تحقق من اتصال Appwrite.",
              ),
          );
        } else {
          setError(null);
        }
      } catch (err: unknown) {
        if (currentRequestId !== searchRequestId.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (currentRequestId === searchRequestId.current) {
          setLoading(false);
          setIsRefreshing(false);
          setLoadingMore(false);
          loadingMoreLock.current = false;
        }
      }
    },
    [t],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!(query || "").trim()) return;
      setQuery("");
      writeQueryParams("", filters);
      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      nextCursorRef.current = null;
      searchAttrRef.current = null;
      void load("", filters, "replace", null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, filters, load]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || loadingMoreLock.current) return;
    if (!hasMore) return;
    const cursor = nextCursorRef.current;
    if (!cursor) return;
    loadingMoreLock.current = true;
    void load(query, filters, "append", cursor);
  }, [loading, loadingMore, hasMore, query, filters, load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "400px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, items.length, hasMore]);

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
      nextCursorRef.current = null;
      searchAttrRef.current = null;
      void load(q, f, "replace", null);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      if (!isMedicinesPath(window.location.pathname)) return;
      writeQueryParams(query, filters);
      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      nextCursorRef.current = null;
      searchAttrRef.current = null;
      void load(query, filters, "replace", null);
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    writeQueryParams(query, filters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    void load(query, filters, "replace", null);
  };

  const toggleMedCare = () => {
    const next = { ...filters, medCareOnly: !filters.medCareOnly };
    setFilters(next);
    writeQueryParams(query, next);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    void load(query, next, "replace", null);
  };

  const hasActiveQuery = Boolean((query || "").trim() || filters.medCareOnly);

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
      <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4 sticky top-0 z-20 -mx-3 px-3 sm:-mx-4 sm:px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-2xl">💊</span>{" "}
              {t("Medicines Encyclopedia & Price Catalog", "موسوعة الأدوية ودليل الأسعار")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
              {t(
                "Search Egyptian pharmaceuticals first — then open world encyclopedias when data is missing.",
                "ابحث في المستحضرات المصرية أولاً — ثم افتح الموسوعات العالمية عند نقص البيانات.",
              )}
            </p>
          </div>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-sky-500/30 text-sky-700 dark:text-sky-300">
              <Globe2 className="h-4 w-4" />
              {t("World search", "بحث عالمي")}
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Name, INN, company… e.g. paracetamol eva",
                "اسم، مادة فعالة، شركة… مثال: باراسيتامول إيفا",
              )}
              className="pl-9 pr-12 py-2 rounded-xl border-emerald-500/20 focus:border-emerald-500 h-10"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden">
              <MobileVoiceSearchButton onTranscript={(text) => setQuery(text)} />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  writeQueryParams("", filters);
                  lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  nextCursorRef.current = null;
                  searchAttrRef.current = null;
                  void load("", filters, "replace", null);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground md:right-3"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={loading && !isRefreshing} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-10">
            {t("Search Catalog", "بحث الدليل")}
          </Button>
          <Link href="/scan">
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded-xl gap-2 h-10">
              <Scan className="h-4 w-4" />
              {t("Scan Barcode", "مسح الباركود")}
            </Button>
          </Link>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
          <span className="text-[11px] sm:text-xs text-muted-foreground">{t("Popular:", "شائع:")}</span>
          {POPULAR_QUERIES.map((p) => (
            <button
              key={p.q}
              type="button"
              onClick={() => {
                setQuery(p.q);
                writeQueryParams(p.q, filters);
                lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                nextCursorRef.current = null;
                searchAttrRef.current = null;
                void load(p.q, filters, "replace", null);
              }}
              className="rounded-full border bg-card px-2.5 py-0.5 text-[11px] sm:text-xs font-medium hover:border-emerald-500/40 transition"
            >
              {language === "ar" ? p.ar : p.q}
            </button>
          ))}
          <span className="text-xs text-muted-foreground mx-1">|</span>
          <button
            type="button"
            onClick={toggleMedCare}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold transition ${
              filters.medCareOnly
                ? "border-teal-600 bg-teal-600 text-white"
                : "bg-card hover:border-teal-500/50 text-teal-800 dark:text-teal-200"
            }`}
          >
            {t("Med-Care portfolio", "محفظة ميد كير")}
            {filters.medCareOnly ? " ✓" : ""}
          </button>
        </div>
      </div>

      {hasActiveQuery && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {(query || "").trim() && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-200">
              <Search className="h-3 w-3" />
              <span className="max-w-[220px] truncate">{query.trim()}</span>
              <button
                type="button"
                className="ms-0.5 rounded-full p-0.5 hover:bg-emerald-500/20"
                aria-label={t("Clear search", "مسح البحث")}
                onClick={() => {
                  setQuery("");
                  writeQueryParams("", filters);
                  lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  nextCursorRef.current = null;
                  searchAttrRef.current = null;
                  void load("", filters, "replace", null);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.medCareOnly && (
            <button
              type="button"
              onClick={toggleMedCare}
              className="inline-flex items-center gap-1 rounded-full border border-teal-600/40 bg-teal-600/10 px-2.5 py-1 font-medium text-teal-800 dark:text-teal-200"
            >
              {t("Med-Care", "ميد كير")}
              <X className="h-3 w-3" />
            </button>
          )}
          {isRefreshing && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("Updating results…", "جاري تحديث النتائج…")}
            </span>
          )}
        </div>
      )}

      <div ref={resultsTopRef} className="scroll-mt-24" />

      {error && (
        <Alert variant="destructive" className="mb-4 sm:mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("Failed to load catalog data: ", "فشل تحميل بيانات الموسوعة: ")}
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground border-b pb-2 mb-3 sm:pb-3 sm:mb-4 gap-2 flex-wrap">
        <div>
          {loading && items.length === 0 ? (
            <span>{t("Searching catalog...", "جاري البحث في الدليل...")}</span>
          ) : (
            <span>
              {t("Showing ", "عرض ")}
              <strong className="text-foreground">{items.length.toLocaleString()}</strong>
              {t(" of ", " من ")}
              <strong className="text-foreground">{total.toLocaleString()}</strong>
              {t(" medicines", " مستحضر دوائي")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {filters.medCareOnly && (
            <Badge className="text-[10px] font-normal bg-teal-600 text-white">
              {t("Med-Care toll", "ميد كير تول")}
            </Badge>
          )}
          {dataSource === "appwrite" && (
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-normal text-muted-foreground">
              {t("Live catalog", "موسوعة مباشرة")}
            </Badge>
          )}
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-sm" role="group" aria-label={t("Catalog view", "طريقة العرض")}>
            {(
              [
                { id: "grid" as const, icon: LayoutGrid, label: t("Grid", "شبكة") },
                { id: "comfortable" as const, icon: Rows3, label: t("Comfortable", "مريح") },
                { id: "list" as const, icon: LayoutList, label: t("List", "قائمة") },
              ] as const
            ).map(({ id, icon: Icon, label }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  aria-label={label}
                  onClick={() => setCatalogView(id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    active ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-sm gap-0.5" role="group" aria-label={t("Card fields", "حقول الكارت")}>
            <button
              type="button"
              aria-pressed={showIngredient}
              onClick={() => {
                const v = !showIngredient;
                setShowIngredient(v);
                persistFields({ scientificName: v, drugClass: showDrugClass, manufacturer: showManufacturer });
              }}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                showIngredient ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              title={t("Active ingredient", "المادة الفعالة")}
            >
              {t("INN", "المادة")}
            </button>
            <button
              type="button"
              aria-pressed={showDrugClass}
              onClick={() => {
                const v = !showDrugClass;
                setShowDrugClass(v);
                persistFields({ scientificName: showIngredient, drugClass: v, manufacturer: showManufacturer });
              }}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                showDrugClass ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              title={t("Drug class", "التصنيف الدوائي")}
            >
              {t("Class", "التصنيف")}
            </button>
            <button
              type="button"
              aria-pressed={showManufacturer}
              onClick={() => {
                const v = !showManufacturer;
                setShowManufacturer(v);
                persistFields({ scientificName: showIngredient, drugClass: showDrugClass, manufacturer: v });
              }}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                showManufacturer ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              title={t("Manufacturer", "الشركة المنتجة")}
            >
              {t("Company", "الشركة")}
            </button>
          </div>
        </div>
      </div>

      <SearchRankingExamples className="mb-3 sm:mb-4" compact />

      {loading && items.length === 0 ? (
        <div
          className={
            view === "list"
              ? "flex flex-col gap-2"
              : view === "comfortable"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3"
          }
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className={`animate-pulse bg-muted/40 ${view === "list" ? "h-[88px]" : "h-40"}`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <CatalogEmptyState query={query} medCareOnly={filters.medCareOnly} />
      ) : (
        <>
          <div
            className={
              (view === "list"
                ? "flex flex-col gap-2"
                : view === "comfortable"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                  : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3") +
              (isRefreshing ? " opacity-60 pointer-events-none transition-opacity" : " transition-opacity")
            }
            aria-busy={isRefreshing}
          >
            {items.map((item) => {
              const img = displayImageUrl(item.image_url);
              const href = monographHref(item);
              const title = item.name_en || item.name_ar || "Unnamed Medicine";
              const isList = view === "list";
              const isComfort = view === "comfortable";
              return (
                <Card
                  key={item.$id || `${item.canonical_id}-${item.name_en}`}
                  className="group hover:shadow-md transition-all border-border hover:border-emerald-500/40 overflow-hidden"
                >
                  <a href={href} className={isList ? "flex flex-row h-full" : "flex flex-col h-full"}>
                    <div
                      className={
                        isList
                          ? "relative shrink-0 w-[72px] h-[72px] bg-muted/40 overflow-hidden border-e border-border"
                          : isComfort
                            ? "relative w-full aspect-[16/10] bg-muted/40 overflow-hidden border-b border-border"
                            : "relative w-full aspect-square max-h-[120px] bg-muted/40 overflow-hidden border-b border-border"
                      }
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-contain p-1"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fb) fb.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${img ? "hidden" : ""}`}>
                        <span className="text-2xl opacity-50">💊</span>
                      </div>
                    </div>
                    <CardContent className={`flex-1 min-w-0 flex flex-col justify-between ${isList ? "p-2.5" : "p-2 sm:p-2.5"} gap-1`}>
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <h4 className={`font-bold text-foreground group-hover:text-emerald-600 line-clamp-2 ${isList || isComfort ? "text-sm" : "text-[12px] sm:text-sm"}`}>
                            {title}
                          </h4>
                          {item.name_ar && item.name_en && (
                            <p className="text-[10px] text-muted-foreground dir-rtl mt-0.5 line-clamp-1">{item.name_ar}</p>
                          )}
                          {(item.strength || item.dosage_form) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                              {[item.dosage_form, item.strength].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        {item.has_verified_dataset && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0 bg-emerald-50 text-emerald-700">
                            ✓ {t("Verified", "موثق")}
                          </Badge>
                        )}
                      </div>

                      {(showIngredient || showDrugClass || showManufacturer) && (
                        <div className="space-y-0.5 text-[10px] sm:text-[11px] text-muted-foreground">
                          {showIngredient && item.scientific_name && (
                            <p className="font-mono bg-muted/50 px-1.5 py-0.5 rounded truncate" title={item.scientific_name}>
                              🧪 {item.scientific_name}
                            </p>
                          )}
                          {showDrugClass && item.drug_class && (
                            <p className="truncate" title={item.drug_class}>
                              📑 {item.drug_class}
                            </p>
                          )}
                          {showManufacturer && item.manufacturer && (
                            <p className="truncate" title={item.manufacturer}>
                              🏢 <span className="font-medium text-foreground">{item.manufacturer}</span>
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pt-0.5 flex items-end justify-between gap-1">
                        <div className="min-w-0">
                          <span className="text-[8px] text-muted-foreground block">{t("Official Price", "السعر الرسمي")}</span>
                          <span className="text-[11px] sm:text-sm font-extrabold text-emerald-600 tabular-nums">
                            {item.current_price_egp
                              ? `EGP ${Number(item.current_price_egp).toFixed(2)}`
                              : t("Price on request", "السعر حسب التعريفة")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </a>
                </Card>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

          <div className="flex flex-col items-center gap-3 pt-3 pb-6">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("Loading more…", "جاري تحميل المزيد…")}
              </div>
            )}
            {!loadingMore && hasMore && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={loadMore}>
                {t("Load more", "تحميل المزيد")} ({items.length} / {total.toLocaleString()})
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
