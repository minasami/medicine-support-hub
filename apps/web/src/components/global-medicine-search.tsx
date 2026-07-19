import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Clock3, Search, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type MedicineSuggestion = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
};

type RecentSearch = {
  query: string;
  canonicalId?: number;
};

const RECENT_SEARCHES_KEY = "msh:medicine-recent-searches:v1";

function readRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(value)
      ? value
          .map((item): RecentSearch | null => {
            if (typeof item === "string") return { query: item };
            if (
              item &&
              typeof item === "object" &&
              typeof item.query === "string" &&
              item.query.trim()
            ) {
              const rawId = item.canonicalId ?? item.canonical_id;
              const canonicalId =
                typeof rawId === "number"
                  ? rawId
                  : typeof rawId === "string"
                    ? parseInt(rawId, 10)
                    : undefined;
              return {
                query: item.query,
                canonicalId: Number.isSafeInteger(canonicalId)
                  ? canonicalId
                  : undefined,
              };
            }
            return null;
          })
          .filter((item): item is RecentSearch => item !== null)
          .slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export function GlobalMedicineSearch({
  isStaffPage,
}: {
  isStaffPage: boolean;
}) {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [, setLocation] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [recentSearches, setRecentSearches] =
    useState<RecentSearch[]>(readRecentSearches);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  function remember(value: string, canonicalId?: number) {
    const normalized = value.trim();
    if (!normalized) return;
    const next = [
      { query: normalized, canonicalId },
      ...recentSearches.filter(
        (item) => item.query.toLowerCase() !== normalized.toLowerCase(),
      ),
    ].slice(0, 6);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }

  function openMedicine(item: MedicineSuggestion) {
    remember(item.name_en || item.name_ar || query, item.canonical_id);
    setLocation(`/catalog/${item.canonical_id}`);
  }

  function searchAll(value = query) {
    const normalized = value.trim();
    if (!normalized) return;
    remember(normalized);
    setLocation(`/medicines?q=${encodeURIComponent(normalized)}`);
  }

  function openRecentSearch(item: RecentSearch) {
    if (item.canonicalId) {
      setLocation(`/catalog/${item.canonicalId}`);
      return;
    }
    searchAll(item.query);
  }

  useEffect(() => {
    if (!expanded) return;
    inputRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [expanded]);

  useEffect(() => {
    const normalized = query.trim();
    setActiveIndex(-1);
    if (normalized.length < 2) {
      requestId.current += 1;
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void supabaseFetch<MedicineSuggestion[]>(
        "/rest/v1/rpc/search_medicine_encyclopedia_v4",
        {
          method: "POST",
          body: JSON.stringify({
            p_query: normalized,
            p_manufacturer: null,
            p_drug_class: null,
            p_route: null,
            p_category: null,
            p_scientific_name: null,
            p_source_system: null,
            p_min_price: null,
            p_max_price: null,
            p_has_price_history: null,
            p_verified_only: null,
            p_has_marketplace_offers: null,
            p_has_image: null,
            p_min_completeness: null,
            p_query_mode: "all",
            p_sort: "best",
            p_limit: 7,
            p_offset: 0,
          }),
        },
      )
        .then((rows) => {
          if (currentRequest === requestId.current) setSuggestions(rows);
        })
        .catch(() => {
          if (currentRequest === requestId.current) setSuggestions([]);
        })
        .finally(() => {
          if (currentRequest === requestId.current) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, supabaseFetch]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const selected = suggestions[activeIndex];
    if (selected) openMedicine(selected);
    else searchAll();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Escape") {
      setExpanded(false);
    }
  }

  const showDropdown =
    expanded && (query.trim().length >= 2 || recentSearches.length > 0);

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 flex-1 justify-center px-1"
    >
      {true ? (
        <form onSubmit={submit} className="w-full max-w-3xl">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="global-medicine-search-results"
              aria-activedescendant={
                activeIndex >= 0
                  ? `medicine-suggestion-${activeIndex}`
                  : undefined
              }
              aria-label={t("Search medicines", "البحث عن الأدوية")}
              value={query}
              onFocus={() => setExpanded(true)}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t("Search medicines…", "ابحث عن دواء…")}
              className={`h-11 rounded-full border-0 pl-12 pr-20 text-base shadow-sm ring-1 ring-border transition-shadow focus-visible:ring-2 focus-visible:ring-primary sm:h-12 ${isStaffPage ? "bg-slate-800 text-white placeholder:text-slate-400" : "bg-muted/70 hover:bg-muted"}`}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label={t("Clear search", "مسح البحث")}
                className="absolute right-11 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              type="submit"
              aria-label={t("Search", "بحث")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background/80 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Search className="h-5 w-5" />
            </button>
          </label>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded="false"
          aria-label={t("Open medicine search", "فتح البحث عن الأدوية")}
          onClick={() => setExpanded(true)}
          className={`h-10 min-w-10 gap-2 rounded-full sm:h-9 sm:w-full sm:max-w-xs sm:justify-start sm:border ${isStaffPage ? "text-slate-300 sm:border-slate-700 sm:bg-slate-800/70" : "sm:bg-muted/40"}`}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate text-muted-foreground sm:inline">
            {t("Search medicines…", "ابحث عن دواء…")}
          </span>
        </Button>
      )}

      {showDropdown && (
        <div
          id="global-medicine-search-results"
          role="listbox"
          className="absolute left-1/2 top-[calc(100%+0.45rem)] z-[80] max-h-[min(26rem,70dvh)] w-[min(38rem,calc(100vw-1rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border bg-popover p-2 text-popover-foreground shadow-2xl"
        >
          {query.trim().length < 2 ? (
            <>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Recent searches", "عمليات البحث الأخيرة")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                  }}
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("Clear", "مسح")}
                </Button>
              </div>
              {recentSearches.map((item) => (
                <button
                  key={`${item.query}-${item.canonicalId ?? "search"}`}
                  type="button"
                  role="option"
                  onClick={() => openRecentSearch(item)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.query}</span>
                </button>
              ))}
            </>
          ) : loading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("Finding medicines…", "جارٍ البحث عن الأدوية…")}
            </p>
          ) : suggestions.length ? (
            suggestions.map((item, index) => (
              <button
                id={`medicine-suggestion-${index}`}
                key={item.canonical_id}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openMedicine(item)}
                className={`flex min-h-14 w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none ${activeIndex === index ? "bg-accent" : ""}`}
              >
                <Search className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.name_en || item.name_ar}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.scientific_name, item.manufacturer]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={() => searchAll()}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-accent"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              {t("Search all medicines for", "ابحث في كل الأدوية عن")} “
              {query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
