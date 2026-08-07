import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Globe2, Loader2, Scan, Search, X } from "lucide-react";
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
import { buildWorldSourceLinks, worldSourceLabel } from "@/lib/medicine-aggregator";
import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";
import { applyLocalProductUpdates } from "@/lib/search-engine";

type Medicine = MedicineListItem;

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

const PAGE_SIZE = 24;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"appwrite" | "static_fallback" | null>(null);
  const searchRequestId = useRef(0);
  const lastUrlKey = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLock = useRef(false);
  const nextCursorRef = useRef<string | null>(null);

  const worldLinks = useMemo(
    () => buildWorldSourceLinks(query.trim() || "medicine"),
    [query],
  );

  const load = useCallback(
    async (
      nextQuery: string,
      nextFilters: Filters,
      mode: "replace" | "append" = "replace",
      cursorAfter: string | null = null,
    ) => {
      const currentRequestId = ++searchRequestId.current;
      if (mode === "replace") {
        setLoading(true);
        setError(null);
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
          },
        });

        if (currentRequestId !== searchRequestId.current) return;

        const updated = applyLocalProductUpdates(page.items) as Medicine[];
        setTotal(page.total);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
        nextCursorRef.current = page.nextCursor;
        setDataSource(page.source);

        if (mode === "append") {
          setItems((prev) => {
            const seen = new Set(
              prev.map((p) => p.$id || `${p.canonical_id}|${p.name_en}`),
            );
            const merged = [...prev];
            for (const row of updated) {
              const k = row.$id || `${row.canonical_id}|${row.name_en}`;
              if (!seen.has(k)) {
                seen.add(k);
                merged.push(row);
              }
            }
            return merged;
          });
        } else {
          setItems(updated);
        }

        if (page.source === "static_fallback" && page.total === 0) {
          setError(
            t(
              "Live catalog unavailable — check Appwrite connection.",
              "الموسوعة المباشرة غير متاحة — تحقق من اتصال Appwrite.",
            ),
          );
        }
      } catch (err: unknown) {
        if (currentRequestId !== searchRequestId.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (currentRequestId === searchRequestId.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreLock.current = false;
        }
      }
    },
    [t],
  );

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
      void load(query, filters, "replace", null);
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
    nextCursorRef.current = null;
    void load(query, filters, "replace", null);
  };

  const handleResetFilters = () => {
    setQuery("");
    setFilters(defaultFilters);
    writeQueryParams("", defaultFilters);
    lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    nextCursorRef.current = null;
    void load("", defaultFilters, "replace", null);
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
                "Search Egyptian pharmaceuticals first — then open world encyclopedias when data is missing.",
                "ابحث في المستحضرات المصرية أولاً — ثم افتح الموسوعات العالمية عند نقص البيانات.",
              )}
            </p>
          </div>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="outline" className="gap-2 rounded-xl border-sky-500/30 text-sky-700 dark:text-sky-300">
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
                  nextCursorRef.current = null;
                  void load("", filters, "replace", null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">
            {t("Search Catalog", "بحث الدليل")}
          </Button>
          <Link href="/scan">
            <Button type="button" variant="outline" className="w-full sm:w-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded-xl gap-2">
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
                nextCursorRef.current = null;
                void load(p.q, filters, "replace", null);
              }}
              className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 transition"
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

      <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3 mb-4 gap-2 flex-wrap">
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
        <div className="flex items-center gap-2">
          {dataSource === "appwrite" && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {t("Live Appwrite", "Appwrite مباشر")}
            </Badge>
          )}
          {nextCursor && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              cursor
            </Badge>
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
        <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed p-8 space-y-4">
          <div className="text-4xl mb-1">🔍</div>
          <h3 className="text-lg font-semibold">
            {query.trim()
              ? t("Not in the local catalog yet", "غير موجود في الموسوعة المحلية بعد")
              : t("No medicines found", "لم يتم العثور على أدوية")}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {query.trim() && (
              <Link href={`/world-search?q=${encodeURIComponent(query.trim())}`}>
                <Button className="gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl">
                  <Globe2 className="h-4 w-4" />
                  {t("Search the world", "بحث عالمي")}
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="rounded-xl">
              {t("Clear search", "مسح البحث")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const img = displayImageUrl(item.image_url);
              return (
                <Card
                  key={item.$id || `${item.canonical_id}-${item.name_en}`}
                  className="group hover:shadow-md transition-all duration-200 border-border hover:border-emerald-500/40 flex flex-col justify-between overflow-hidden"
                >
                  <a href={monographHref(item)} className="block relative aspect-[4/3] bg-muted/40 overflow-hidden border-b border-border">
                    {img ? (
                      <img
                        src={img}
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
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground ${img ? "hidden" : ""}`}>
                      <span className="text-3xl opacity-50" aria-hidden>💊</span>
                      <span className="text-[10px] font-medium uppercase tracking-wide">{t("No photo", "لا توجد صورة")}</span>
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
                        <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] shrink-0">
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
                          🏢 <span className="font-medium text-foreground">{item.manufacturer}</span>
                        </div>
                      )}
                      {item.drug_class && <div className="truncate">📋 {item.drug_class}</div>}
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{t("Official Price", "السعر الرسمي")}</span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {item.current_price_egp
                            ? `EGP ${Number(item.current_price_egp).toFixed(2)}`
                            : t("Price on request", "السعر حسب التعريفة")}
                        </span>
                      </div>
                      <a href={monographHref(item)} className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                        {t("Monograph →", "التفاصيل →")}
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

          <div className="flex flex-col items-center gap-3 pt-4 pb-8">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("Loading more\u2026", "جاري تحميل المزيد\u2026")}
              </div>
            )}
            {!loadingMore && hasMore && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={loadMore}>
                {t("Load more", "تحميل المزيد")} ({items.length} / {total.toLocaleString()})
              </Button>
            )}
            {!hasMore && items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("End of catalog", "نهاية الدليل")} \u00b7 {total.toLocaleString()}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
