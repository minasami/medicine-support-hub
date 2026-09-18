import { rememberRecentSearch } from "@/lib/recent-searches";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Globe2,
  LayoutGrid,
  LayoutList,
  Loader2,
  Rows3,
  Scan,
  Search,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { Link, useLocation } from "wouter";
import { readEncyclopediaQueryFromLocation, companyCollectionUrl } from "@/lib/catalog-links";
import { fetchMedicinesPage, type MedicineListItem, type MedicineSort } from "@/lib/medicines-appwrite-page";
import { logSearchClick } from "@/lib/search-logs";
import { applyLocalProductUpdates } from "@/lib/search-engine";
import { adaptiveRankMedicineResults, recordAdaptiveEvent, resolveAdaptiveQuery } from "@/lib/adaptive";
import { MobileVoiceSearchButton } from "@/components/mobile-voice-search-button";
import { CatalogEmptyState } from "@/components/catalog-empty-state";
import { EncyclopediaCatalogCard } from "@/components/encyclopedia-catalog-card";
import { groupCatalogNearDuplicates } from "@/lib/encyclopedia-catalog";
import { looksLikeNetworkError } from "@/lib/network-status";
import {
  fetchCompanyHits,
  type CompanyHit,
} from "@/lib/company-search-hits";
import { suggestDidYouMean, type DidYouMeanSuggestion } from "@/lib/did-you-mean";
import { usePatientAuth } from "@/lib/patient-auth";
import { useRole } from "@/lib/role";
import { isPlatformAdminUser } from "@/lib/platform-admin";

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

function syncMedicinesQueryUrl(term: string) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.pathname = "/medicines";
    if (term.trim()) url.searchParams.set("q", term.trim());
    else url.searchParams.delete("q");
    url.searchParams.delete("query");
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}

export default function MedicinesEncyclopediaPage() {
  const { t } = useLanguage();
  const { session, profile } = usePatientAuth();
  const { user } = useRole();
  const isAdmin = isPlatformAdminUser({
    email: session?.user?.email || (user as { username?: string } | null)?.username || null,
    profileRole: profile?.role || (user as { role?: string } | null)?.role || null,
  });
  const [location] = useLocation();
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      readEncyclopediaQueryFromLocation(window.location) ||
      new URLSearchParams(window.location.search).get("q") ||
      ""
    );
  });
  const [filters] = useState<Filters>(defaultFilters);
  const [items, setItems] = useState<MedicineListItem[]>([]);
  const [companies, setCompanies] = useState<CompanyHit[]>([]);
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
  const [catalogSort, setCatalogSort] = useState<MedicineSort>("search_score");
  const [didYouMean, setDidYouMean] = useState<DidYouMeanSuggestion | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const searchAttrRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLock = useRef(false);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipDebounceOnce = useRef(false);

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
      const id = mode === "replace" ? ++requestId.current : requestId.current;
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);
      try {
        const term = nextQuery.trim();
        const pagePromise = fetchMedicinesPage({
          limit: PAGE_SIZE,
          cursorAfter: mode === "append" ? nextCursorRef.current : null,
          filters: {
            query: term,
            manufacturer: nextFilters.manufacturer,
            drugClass: nextFilters.drugClass,
            route: nextFilters.route,
            category: nextFilters.category,
            scientificName: nextFilters.scientificName,
            verifiedOnly: nextFilters.verifiedOnly,
            medCareOnly: nextFilters.medCareOnly,
            searchAttr: mode === "append" ? searchAttrRef.current : null,
            sort: catalogSort,
            includeHidden: isAdmin,
          },
        });

        const companyPromise =
          mode === "replace"
            ? fetchCompanyHits(term, term ? 8 : 0)
            : Promise.resolve(null);

        const [page, companyHits] = await Promise.all([pagePromise, companyPromise]);

        if (mode === "replace" && id !== requestId.current) return;

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
          if (companyHits) setCompanies(companyHits);
          const q = nextQuery.trim();
          setDidYouMean(q ? suggestDidYouMean(q, ranked) : null);
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
        setError(
          page.connectionError && page.items.length === 0
            ? page.errorMessage || "Catalog unavailable"
            : null,
        );
      } catch (err: unknown) {
        if (mode === "replace" && id !== requestId.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mode === "replace") {
          if (id === requestId.current) setLoading(false);
        } else {
          setLoadingMore(false);
          loadingMoreLock.current = false;
        }
      }
    },
    [catalogSort, isAdmin],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !isMedicinesPath(window.location.pathname)) return;
    const q =
      readEncyclopediaQueryFromLocation(window.location) ||
      new URLSearchParams(window.location.search).get("q") ||
      "";
    skipDebounceOnce.current = true;
    setQuery(q);
    void location;
  }, [location]);

  useEffect(() => {
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    const immediate = skipDebounceOnce.current;
    skipDebounceOnce.current = false;
    const delay = immediate || !query.trim() ? 0 : 280;
    const handle = window.setTimeout(() => {
      syncMedicinesQueryUrl(query);
      void load(query, filters, "replace");
    }, delay);
    return () => window.clearTimeout(handle);
  }, [query, filters, catalogSort, load]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    rememberRecentSearch(query);
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    syncMedicinesQueryUrl(query);
    void load(query, filters, "replace");
  };

  const clearQuery = () => {
    setQuery("");
    nextCursorRef.current = null;
    searchAttrRef.current = null;
    syncMedicinesQueryUrl("");
  };

  const loadMore = () => {
    if (loading || loadingMore || loadingMoreLock.current || !hasMore || !nextCursorRef.current) return;
    loadingMoreLock.current = true;
    void load(query, filters, "append");
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  });

  const displayItems = useMemo(() => groupCatalogNearDuplicates(items), [items]);
  const offline = Boolean(error && looksLikeNetworkError(error) && displayItems.length === 0);
  const showBrowseHint = !loading && !query.trim() && displayItems.length > 0;

  return (
    <div className="container mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-5 pb-24">
      <div className="sticky top-0 z-20 -mx-3 px-3 sm:-mx-4 sm:px-4 py-2 mb-2.5 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {t("Medicines", "الأدوية")}
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
              {t(
                "Search and browse the live catalog — one place for names, barcodes, companies, and ingredients.",
                "ابحث وتصفح الكتالوج المباشر — مكان واحد للأسماء والباركود والشركات والمواد الفعالة.",
              )}
            </p>
          </div>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-teal-700 h-8 shrink-0">
              <Globe2 className="h-4 w-4" />
              {t("World", "عالمي")}
            </Button>
          </Link>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <button
              type="submit"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-emerald-700"
              aria-label={t("Search", "بحث")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Search name, barcode, company, ingredient…",
                "ابحث بالاسم أو الباركود أو الشركة أو المادة…",
              )}
              className="pl-9 pr-[4.5rem] h-11 rounded-2xl bg-muted/25 border-emerald-500/20 text-sm shadow-sm focus-visible:ring-emerald-500/30"
              autoComplete="off"
              enterKeyHint="search"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {query ? (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={t("Clear", "مسح")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <Link href="/scan" className="shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-emerald-700"
                  aria-label={t("Scan barcode", "مسح باركود")}
                >
                  <Scan className="h-4 w-4" />
                </Button>
              </Link>
              <div className="shrink-0 [&_button]:h-8 [&_button]:w-8 [&_button]:rounded-xl [&_button]:border-0 [&_button]:shadow-none [&_button]:bg-transparent [&_button]:text-muted-foreground">
                <MobileVoiceSearchButton
                  onTranscript={(text) => {
                    setQuery(text);
                  }}
                />
              </div>
            </div>
          </div>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Link
            href="/rx/upload"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-50/70 px-3 py-1 text-[11px] font-semibold text-teal-800 transition-colors hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-900/50"
          >
            <Upload className="h-3.5 w-3.5" />
            {t("Upload prescription", "رفع الروشتة")}
          </Link>
        </div>
        {didYouMean && query.trim() ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {t("Did you mean", "هل تقصد")}{" "}
            <button
              type="button"
              className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              onClick={() => {
                skipDebounceOnce.current = true;
                setQuery(didYouMean.suggestion);
              }}
            >
              {didYouMean.suggestion}
            </button>
            {"?"}
          </div>
        ) : null}
      </div>

      {error && !offline ? (
        <Alert className="mb-3 border-amber-500/30 bg-amber-50/80 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "The catalog is taking longer than usual. Check your connection and try again — or scan a barcode.",
              "الكتالوج يستغرق وقتًا أطول من المعتاد. تحقق من الاتصال وحاول مجددًا — أو امسح باركودًا.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {query.trim() && companies.length > 0 ? (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-emerald-700" />
              {t("Companies", "الشركات")}
            </h2>
            <Badge variant="secondary" className="text-[11px]">
              {companies.length}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {companies.map((company) => (
              <Link
                key={company.company_slug}
                href={
                  company.company_slug
                    ? `/companies/${encodeURIComponent(company.company_slug)}`
                    : companyCollectionUrl(company.display_name)
                }
                className="rounded-2xl border bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold leading-snug truncate">{company.display_name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        company.origin,
                        company.product_count != null
                          ? t(`${company.product_count} products`, `${company.product_count} منتج`)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" \u00b7 ")}
                    </p>
                  </div>
                  {company.verification_status ? (
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {company.verification_status}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {(
          [
            { id: "search_score" as const, en: "Best match", ar: "الأفضل" },
            { id: "completeness" as const, en: "Most Complete", ar: "الأكمل" },
            { id: "trending" as const, en: "Trending", ar: "الرائج" },
            { id: "name" as const, en: "A\u2013Z", ar: "أ\u2013ي" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setCatalogSort(opt.id);
              nextCursorRef.current = null;
              searchAttrRef.current = null;
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
              catalogSort === opt.id
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-card text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            {t(opt.en, opt.ar)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs text-muted-foreground flex-1 tabular-nums">
          {loading && items.length === 0
            ? t("Searching\u2026", "جاري البحث\u2026")
            : query.trim()
              ? displayItems.length !== items.length
                ? t(
                    `${displayItems.length.toLocaleString()} shown \u00b7 ${total.toLocaleString()} matches`,
                    `${displayItems.length.toLocaleString()} معروض \u00b7 ${total.toLocaleString()} مطابقة`,
                  )
                : t(
                    `${displayItems.length.toLocaleString()} / ${total.toLocaleString()} matches`,
                    `${displayItems.length.toLocaleString()} / ${total.toLocaleString()} مطابقة`,
                  )
              : showBrowseHint
                ? t(
                    `${displayItems.length.toLocaleString()} shown \u00b7 browse or search above`,
                    `${displayItems.length.toLocaleString()} معروض \u00b7 تصفح أو ابحث أعلاه`,
                  )
                : `${displayItems.length.toLocaleString()} / ${total.toLocaleString()}`}
        </p>
        <div className="inline-flex items-center rounded-full border border-border/50 bg-card/80 p-0.5">
          {(
            [
              { id: "grid" as const, icon: LayoutGrid, labelEn: "Grid view", labelAr: "عرض شبكة" },
              { id: "comfortable" as const, icon: Rows3, labelEn: "Comfortable view", labelAr: "عرض مريح" },
              { id: "list" as const, icon: LayoutList, labelEn: "List view", labelAr: "عرض قائمة" },
            ] as const
          ).map(({ id, icon: Icon, labelEn, labelAr }) => (
            <button
              key={id}
              type="button"
              onClick={() => persistView(id)}
              className={`rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                view === id ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={t(labelEn, labelAr)}
              aria-pressed={view === id}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDisplayOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">{t("Details", "التفاصيل")}</span>
          </button>
          {displayOpen ? (
            <div className="absolute end-0 top-full mt-1.5 z-40 w-48 rounded-xl border bg-popover p-1.5 shadow-lg">
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-muted/60" onClick={() => setShowIngredient((v) => !v)}>
                <span>{t("Active ingredient", "المادة الفعالة")}</span>
                <span className="text-muted-foreground">{showIngredient ? t("On", "تشغيل") : t("Off", "إيقاف")}</span>
              </button>
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-muted/60" onClick={() => setShowDrugClass((v) => !v)}>
                <span>{t("Drug class", "التصنيف")}</span>
                <span className="text-muted-foreground">{showDrugClass ? t("On", "تشغيل") : t("Off", "إيقاف")}</span>
              </button>
              <button type="button" className="flex w-full justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-muted/60" onClick={() => setShowManufacturer((v) => !v)}>
                <span>{t("Company", "الشركة")}</span>
                <span className="text-muted-foreground">{showManufacturer ? t("On", "تشغيل") : t("Off", "إيقاف")}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-muted/40 h-36" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <CatalogEmptyState query={query} medCareOnly={filters.medCareOnly} offline={offline} />
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
            {displayItems.map((item) => (
              <div
                key={item.$id || `${item.canonical_id}-${item.name_en}`}
                onClick={() => {
                  void logSearchClick({
                    query,
                    drugId: item.$id,
                    medicineId: item.$id,
                    canonicalId: item.canonical_id,
                    source: "encyclopedia",
                  });
                }}
              >
                <EncyclopediaCatalogCard
                  item={item}
                  view={view}
                  showIngredient={showIngredient}
                  showDrugClass={showDrugClass}
                  showManufacturer={showManufacturer}
                  onAdminChanged={(patch) => {
                    setItems((prev) =>
                      prev.map((row) =>
                        (row.$id && row.$id === item.$id) ||
                        row.canonical_id === item.canonical_id
                          ? { ...row, ...patch }
                          : row,
                      ),
                    );
                  }}
                />
              </div>
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
