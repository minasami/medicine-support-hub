import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Globe2, LayoutGrid, LayoutList, Loader2, Rows3, Scan, Search, Settings2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { Link, useLocation } from "wouter";
import { readEncyclopediaQueryFromLocation } from "@/lib/catalog-links";
import { fetchMedicinesPage, type MedicineListItem } from "@/lib/medicines-appwrite-page";
import { applyLocalProductUpdates } from "@/lib/search-engine";
import { adaptiveRankMedicineResults, recordAdaptiveEvent, resolveAdaptiveQuery } from "@/lib/adaptive";
import { MobileVoiceSearchButton } from "@/components/mobile-voice-search-button";
import { CatalogEmptyState } from "@/components/catalog-empty-state";
import { EncyclopediaCatalogCard } from "@/components/encyclopedia-catalog-card";

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

function isMedicinesPath(pathname: string) {
  return pathname === "/medicines" || pathname === "/medicines/";
}

export default function MedicinesEncyclopediaPage() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [items, setItems] = useState<MedicineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView] = useState<CatalogView>(() => readStoredView());
  const [showIngredient, setShowIngredient] = useState(true);
  const [showDrugClass, setShowDrugClass] = useState(false);
  const [showManufacturer, setShowManufacturer] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const searchAttrRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLock = useRef(false);

  const persistView = (next: CatalogView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(
    async (nextQuery: string, nextFilters: Filters, mode: "replace" | "append" = "replace") => {
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);
      try {
        const page = await fetchMedicinesPage({
          limit: PAGE_SIZE,
          cursorAfter: mode === "append" ? nextCursorRef.current : null,
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
        if (page.searchAttr) searchAttrRef.current = page.searchAttr;
        const ranked = adaptiveRankMedicineResults(
          applyLocalProductUpdates(page.items) as MedicineListItem[],
          nextQuery,
        );
        setTotal(page.total);
        setHasMore(page.hasMore);
        nextCursorRef.current = page.nextCursor;
        if (mode === "replace") {
          setItems(ranked);
          const q = nextQuery.trim();
          if (q) {
            recordAdaptiveEvent({
              type: ranked.length > 0 ? "search_success" : "search_empty",
              query: resolveAdaptiveQuery(q).primary,
            });
          }
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.$id || `${p.canonical_id}|${p.name_en}`));
            return [
              ...prev,
              ...ranked.filter((row) => {
                const k = row.$id || `${row.canonical_id}|${row.name_en}`;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              }),
            ];
          });
        }
        setError(page.connectionError && page.items.length === 0 ? page.errorMessage || "Catalog unavailable" : null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreLock.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !isMedicinesPath(window.location.pathname)) return;
    const q = readEncyclopediaQueryFromLocation(window.location) || new URLSearchParams(window.location.search).get("q") || "";
    setQuery(q);
    void load(q, filters, "replace");
    void location;
  }, [location, load, filters]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    if (typeof window !== "undefined") {
      const hash = query.trim() ? `#q=${encodeURIComponent(query.trim())}` : "";
      window.history.replaceState(null, "", `/medicines${hash}`);
    }
    void load(query, filters, "replace");
  };

  const loadMore = () => {
    if (loading || loadingMore || loadingMoreLock.current || !hasMore || !nextCursorRef.current) return;
    loadingMoreLock.current = true;
    void load(query, filters, "append");
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  });

  return (
    <div className="container mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-5">
      <div className="sticky top-0 z-20 -mx-3 px-3 sm:-mx-4 sm:px-4 py-2 mb-3 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="hidden sm:flex items-center justify-between gap-3 mb-2.5">
          <h1 className="text-xl font-bold">{t("Medicines catalog", "كتالوج الأدوية")}</h1>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-sky-700 h-8">
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
              className="pl-8 pr-9 h-10 rounded-2xl bg-muted/30 text-sm shadow-none"
              autoComplete="off"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); void load("", filters, "replace"); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Button type="submit" size="icon" className="h-10 w-10 rounded-2xl bg-emerald-600 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
          <Link href="/scan" className="shrink-0">
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl">
              <Scan className="h-4 w-4" />
            </Button>
          </Link>
          <div className="shrink-0 [&_button]:h-10 [&_button]:w-10 [&_button]:rounded-2xl">
            <MobileVoiceSearchButton onTranscript={(text) => setQuery(text)} />
          </div>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-xs text-muted-foreground flex-1 tabular-nums">
          {loading && items.length === 0 ? t("Searching…", "جاري البحث…") : `${items.length.toLocaleString()} / ${total.toLocaleString()}`}
        </p>
        <div className="inline-flex items-center rounded-full border border-border/60 bg-card p-0.5">
          {([
            { id: "grid" as const, icon: LayoutGrid },
            { id: "comfortable" as const, icon: Rows3 },
            { id: "list" as const, icon: LayoutList },
          ]).map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => persistView(id)}
              className={`rounded-full p-1.5 ${view === id ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setDisplayOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full border px-2 py-1.5 text-[11px]">
            <Settings2 className="h-3.5 w-3.5" />
            {t("Details", "التفاصيل")}
          </button>
          {displayOpen ? (
            <div className="absolute end-0 top-full mt-1.5 z-40 w-48 rounded-xl border bg-popover p-1.5 shadow-lg">
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs" onClick={() => setShowIngredient((v) => !v)}>
                <span>{t("Active ingredient", "المادة الفعالة")}</span><span>{showIngredient ? "on" : "off"}</span>
              </button>
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs" onClick={() => setShowDrugClass((v) => !v)}>
                <span>{t("Drug class", "التصنيف")}</span><span>{showDrugClass ? "on" : "off"}</span>
              </button>
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs" onClick={() => setShowManufacturer((v) => !v)}>
                <span>{t("Company", "الشركة")}</span><span>{showManufacturer ? "on" : "off"}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse rounded-2xl bg-muted/50 h-36" />)}
        </div>
      ) : items.length === 0 ? (
        <CatalogEmptyState query={query} medCareOnly={filters.medCareOnly} />
      ) : (
        <>
          <div
            className={
              view === "list"
                ? "flex flex-col gap-1.5"
                : view === "comfortable"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                  : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
            }
          >
            {items.map((item) => (
              <EncyclopediaCatalogCard
                key={item.$id || `${item.canonical_id}-${item.name_en}`}
                item={item}
                view={view}
                showIngredient={showIngredient}
                showDrugClass={showDrugClass}
                showManufacturer={showManufacturer}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="h-6" />
          <div className="flex justify-center pt-2 pb-8">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {!loadingMore && hasMore ? (
              <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={loadMore}>
                {t("Show more", "عرض المزيد")}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
