import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Globe2, LayoutGrid, LayoutList, Loader2, Rows3, Scan, Search, Settings2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [displayOpen, setDisplayOpen] = useState(false);

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
  const clearSearch = () => {
    setQuery("");
    writeQueryParams("", filters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    void load("", filters, "replace", null);
  };

  void dataSource;

  return (
    <div className="container mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-5">
      <div className="sticky top-0 z-20 -mx-3 px-3 sm:-mx-4 sm:px-4 py-2 mb-2 sm:mb-3 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 border-b border-border/40">
        <div className="hidden sm:flex items-center justify-between gap-3 mb-2.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t("Medicines catalog", "كتالوج الأدوية")}
          </h1>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-sky-700 dark:text-sky-300 h-8">
              <Globe2 className="h-4 w-4" />
              {t("World", "عالمي")}
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search name, INN, or company", "ابحث بالاسم أو المادة أو الشركة")}
              className="pl-8 pr-9 h-10 rounded-2xl border-border/80 bg-muted/30 focus-visible:bg-background text-sm shadow-none"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              aria-label={t("Search medicines", "بحث الأدوية")}
            />
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label={t("Clear", "مسح")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={loading && !isRefreshing}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
            aria-label={t("Search", "بحث")}
          >
            {isRefreshing || (loading && items.length === 0) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
          <Link href="/scan" className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-border/80"
              aria-label={t("Scan barcode", "مسح باركود")}
            >
              <Scan className="h-4 w-4" />
            </Button>
          </Link>
          <div className="shrink-0 [&_button]:h-10 [&_button]:w-10 [&_button]:rounded-2xl">
            <MobileVoiceSearchButton onTranscript={(text) => setQuery(text)} />
          </div>
        </form>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {hasActiveQuery ? (
            <>
              {(query || "").trim() ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-600/10 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 text-[11px] font-medium max-w-[65%]"
                >
                  <span className="truncate">{query.trim()}</span>
                  <X className="h-3 w-3 shrink-0 opacity-70" />
                </button>
              ) : null}
              {filters.medCareOnly ? (
                <button
                  type="button"
                  onClick={toggleMedCare}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-600/15 text-teal-800 dark:text-teal-200 px-2.5 py-1 text-[11px] font-medium"
                >
                  Med-Care
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleMedCare}
                  className="shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  + Med-Care
                </button>
              )}
            </>
          ) : (
            <>
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
                  className="shrink-0 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-emerald-500/40 transition"
                >
                  {language === "ar" ? p.ar : p.q}
                </button>
              ))}
              <button
                type="button"
                onClick={toggleMedCare}
                className="shrink-0 rounded-full border border-teal-600/30 px-2.5 py-1 text-[11px] font-semibold text-teal-800 dark:text-teal-200"
              >
                Med-Care
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={resultsTopRef} className="scroll-mt-14" />

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("Could not load catalog: ", "تعذر تحميل الدليل: ")}
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 mb-2.5 min-h-[32px]">
        <p className="text-[11px] sm:text-xs text-muted-foreground flex-1 min-w-0 tabular-nums">
          {loading && items.length === 0 ? (
            t("Searching…", "جاري البحث…")
          ) : (
            <>
              <span className="text-foreground font-semibold">{items.length.toLocaleString()}</span>
              <span className="mx-0.5">/</span>
              <span>{total.toLocaleString()}</span>
            </>
          )}
        </p>

        <div
          className="inline-flex items-center rounded-full border border-border/60 bg-card p-0.5"
          role="group"
          aria-label={t("View", "العرض")}
        >
          {(
            [
              { id: "grid" as const, icon: LayoutGrid, label: t("Grid", "شبكة") },
              { id: "comfortable" as const, icon: Rows3, label: t("Comfortable", "مريح") },
              { id: "list" as const, icon: LayoutList, label: t("List", "قائمة") },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              aria-label={label}
              onClick={() => setCatalogView(id)}
              className={`rounded-full p-1.5 transition ${
                view === id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-expanded={displayOpen}
            aria-label={t("Card details", "تفاصيل الكارت")}
            onClick={() => setDisplayOpen((o) => !o)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1.5 text-[11px] font-medium transition ${
              displayOpen || showDrugClass || showManufacturer
                ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("Details", "التفاصيل")}</span>
          </button>
          {displayOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                aria-label={t("Close", "إغلاق")}
                onClick={() => setDisplayOpen(false)}
              />
              <div className="absolute end-0 top-full mt-1.5 z-40 w-48 rounded-xl border bg-popover p-1.5 shadow-lg">
                {(
                  [
                    {
                      key: "inn",
                      label: t("Active ingredient", "المادة الفعالة"),
                      on: showIngredient,
                      toggle: () => {
                        const v = !showIngredient;
                        setShowIngredient(v);
                        persistFields({ scientificName: v, drugClass: showDrugClass, manufacturer: showManufacturer });
                      },
                    },
                    {
                      key: "class",
                      label: t("Drug class", "التصنيف"),
                      on: showDrugClass,
                      toggle: () => {
                        const v = !showDrugClass;
                        setShowDrugClass(v);
                        persistFields({ scientificName: showIngredient, drugClass: v, manufacturer: showManufacturer });
                      },
                    },
                    {
                      key: "mfr",
                      label: t("Company", "الشركة"),
                      on: showManufacturer,
                      toggle: () => {
                        const v = !showManufacturer;
                        setShowManufacturer(v);
                        persistFields({ scientificName: showIngredient, drugClass: showDrugClass, manufacturer: v });
                      },
                    },
                  ] as const
                ).map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={row.toggle}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-muted/80"
                  >
                    <span>{row.label}</span>
                    <span
                      className={`relative h-4 w-7 rounded-full p-0.5 transition ${
                        row.on ? "bg-emerald-600" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
                          row.on ? "end-0.5" : "start-0.5"
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div
          className={
            view === "list"
              ? "flex flex-col gap-2"
              : view === "comfortable"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
          }
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`animate-pulse rounded-2xl bg-muted/50 ${view === "list" ? "h-16" : "h-36"}`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <CatalogEmptyState query={query} medCareOnly={filters.medCareOnly} />
      ) : (
        <>
          <div
            className={
              (view === "list"
                ? "flex flex-col gap-1.5"
                : view === "comfortable"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                  : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2") +
              (isRefreshing ? " opacity-55 pointer-events-none transition-opacity" : " transition-opacity")
            }
            aria-busy={isRefreshing}
          >
            {items.map((item) => {
              const img = displayImageUrl(item.image_url);
              const href = monographHref(item);
              const title = item.name_en || item.name_ar || "Unnamed Medicine";
              const isList = view === "list";
              const isComfort = view === "comfortable";
              const formLine = [item.dosage_form, item.strength].filter(Boolean).join(" · ");
              return (
                <Card
                  key={item.$id || `${item.canonical_id}-${item.name_en}`}
                  className="group overflow-hidden rounded-2xl border-border/70 shadow-none hover:border-emerald-500/35 hover:shadow-sm transition-all"
                >
                  <a href={href} className={isList ? "flex flex-row gap-0 h-full" : "flex flex-col h-full"}>
                    <div
                      className={
                        isList
                          ? "relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-muted/30 overflow-hidden"
                          : isComfort
                            ? "relative w-full aspect-[2/1] max-h-[100px] bg-muted/30 overflow-hidden"
                            : "relative w-full aspect-[5/4] max-h-[96px] sm:max-h-[110px] bg-muted/30 overflow-hidden"
                      }
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain p-1.5"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fb) fb.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground/40 ${img ? "hidden" : ""}`}>
                        <span className="text-xl">💊</span>
                      </div>
                      {item.has_verified_dataset && !isList && (
                        <span className="absolute top-1 end-1 rounded-full bg-emerald-600 text-white text-[9px] font-semibold px-1.5 py-0.5 leading-none">
                          ✓
                        </span>
                      )}
                    </div>
                    <CardContent className={`flex-1 min-w-0 flex flex-col justify-between ${isList ? "py-2 px-2.5" : "p-2.5"} gap-1`}>
                      <div className="min-w-0">
                        <div className="flex items-start gap-1">
                          <h4
                            className={`font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 line-clamp-2 leading-snug ${
                              isList || isComfort ? "text-sm" : "text-[12px] sm:text-sm"
                            }`}
                          >
                            {title}
                          </h4>
                          {item.has_verified_dataset && isList && (
                            <span className="shrink-0 text-emerald-600 text-[10px] font-bold mt-0.5">✓</span>
                          )}
                        </div>
                        {item.name_ar && item.name_en ? (
                          <p className="text-[10px] text-muted-foreground dir-rtl mt-0.5 line-clamp-1 leading-tight">
                            {item.name_ar}
                          </p>
                        ) : null}
                        {formLine ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 leading-tight">
                            {formLine}
                          </p>
                        ) : null}
                        {(showIngredient || showDrugClass || showManufacturer) && (
                          <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                            {showIngredient && item.scientific_name ? (
                              <p className="truncate font-mono text-[10px] opacity-90" title={item.scientific_name}>
                                {item.scientific_name}
                              </p>
                            ) : null}
                            {showDrugClass && item.drug_class ? (
                              <p className="truncate" title={item.drug_class}>
                                {item.drug_class}
                              </p>
                            ) : null}
                            {showManufacturer && item.manufacturer ? (
                              <p className="truncate font-medium text-foreground/80" title={item.manufacturer}>
                                {item.manufacturer}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <p className="text-[13px] sm:text-sm font-bold text-emerald-600 tabular-nums leading-none pt-0.5">
                        {item.current_price_egp
                          ? `${Number(item.current_price_egp).toFixed(2)} EGP`
                          : t("Price on request", "السعر حسب الطلب")}
                      </p>
                    </CardContent>
                  </a>
                </Card>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-6 w-full" aria-hidden />

          <div className="flex flex-col items-center gap-2 pt-2 pb-8">
            {loadingMore && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("Loading more…", "المزيد…")}
              </div>
            )}
            {!loadingMore && hasMore && (
              <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={loadMore}>
                {t("Show more", "عرض المزيد")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
