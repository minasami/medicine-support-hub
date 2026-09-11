import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Globe2, Loader2, Scan, Search, Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CatalogEmptyState } from "@/components/catalog-empty-state";
import { EncyclopediaCatalogCard } from "@/components/encyclopedia-catalog-card";
import { MobileVoiceSearchButton } from "@/components/mobile-voice-search-button";
import { groupCatalogNearDuplicates } from "@/lib/encyclopedia-catalog";
import { companyCollectionUrl, encyclopediaSearchUrl } from "@/lib/catalog-links";
import { useLanguage } from "@/lib/i18n";
import { looksLikeNetworkError } from "@/lib/network-status";
import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";
import { Client, Databases, Query } from "appwrite";

type CompanyHit = {
  company_slug: string;
  display_name: string;
  product_count?: number | null;
  verification_status?: string | null;
  origin?: string | null;
};

type MetricState = {
  catalogTotal: number | null;
  companyTotal: number | null;
  loading: boolean;
  error: string | null;
};

const ENDPOINT =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_ENDPOINT) ||
  "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_PROJECT_ID) ||
  "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COMPANIES_COLLECTION =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_COMPANIES_COLLECTION_ID) ||
  "company_profiles";

function getDatabases(): Databases | null {
  try {
    if (!PROJECT_ID) return null;
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    return new Databases(client);
  } catch {
    return null;
  }
}

async function fetchCompanyHits(term: string, limit = 8): Promise<CompanyHit[]> {
  const db = getDatabases();
  if (!db) return [];
  const q = term.trim();
  if (!q) {
    try {
      const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
        Query.limit(limit),
        Query.orderDesc("product_count"),
      ]);
      return (res.documents || []).map((doc) => ({
        company_slug: String(doc.company_slug || ""),
        display_name: String(doc.display_name || doc.company_slug || ""),
        product_count:
          doc.product_count != null ? Number(doc.product_count) : null,
        verification_status: (doc.verification_status as string) || null,
        origin: (doc.origin as string) || null,
      }));
    } catch {
      return [];
    }
  }

  const prefix = q.slice(0, 1).toUpperCase() + q.slice(1);
  const variants = Array.from(
    new Set([q, q.toUpperCase(), q.toLowerCase(), prefix]),
  );
  const seen = new Set<string>();
  const hits: CompanyHit[] = [];

  for (const variant of variants) {
    if (hits.length >= limit) break;
    try {
      const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
        Query.limit(limit),
        Query.startsWith("display_name", variant),
      ]);
      for (const doc of res.documents || []) {
        const slug = String(doc.company_slug || "");
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        hits.push({
          company_slug: slug,
          display_name: String(doc.display_name || slug),
          product_count:
            doc.product_count != null ? Number(doc.product_count) : null,
          verification_status: (doc.verification_status as string) || null,
          origin: (doc.origin as string) || null,
        });
      }
    } catch {
      /* try next variant */
    }
  }
  return hits.slice(0, limit);
}

async function loadLiveMetrics(): Promise<Omit<MetricState, "loading">> {
  try {
    const [catalog, companies] = await Promise.all([
      fetchMedicinesPage({ limit: 1, filters: {} }),
      (async () => {
        const db = getDatabases();
        if (!db) return null;
        try {
          const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
            Query.limit(1),
          ]);
          return typeof res.total === "number" ? res.total : null;
        } catch {
          return null;
        }
      })(),
    ]);

    const catalogTotal =
      catalog.connectionError && catalog.total <= 0
        ? null
        : typeof catalog.total === "number"
          ? catalog.total
          : null;

    return {
      catalogTotal,
      companyTotal: companies,
      error:
        catalog.connectionError && catalogTotal == null
          ? catalog.errorMessage || "Catalog unavailable"
          : null,
    };
  } catch (err) {
    return {
      catalogTotal: null,
      companyTotal: null,
      error: err instanceof Error ? err.message : "Metrics unavailable",
    };
  }
}

function formatMetric(value: number | null, loading: boolean): string {
  if (loading) return "…";
  if (value == null) return "—";
  // Appwrite often caps reported totals at 5000 for large collections.
  if (value >= 5000) return `${value.toLocaleString()}+`;
  return value.toLocaleString();
}

function readInitialQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get("query") || params.get("q") || "").trim();
  } catch {
    return "";
  }
}

export default function PlatformSearch() {
  const { t } = useLanguage();
  const [query, setQuery] = useState(readInitialQuery);
  const [items, setItems] = useState<MedicineListItem[]>([]);
  const [companies, setCompanies] = useState<CompanyHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultTotal, setResultTotal] = useState(0);
  const [metrics, setMetrics] = useState<MetricState>({
    catalogTotal: null,
    companyTotal: null,
    loading: true,
    error: null,
  });
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadLiveMetrics();
      if (cancelled) return;
      setMetrics({ ...next, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async (raw: string) => {
    const id = ++requestId.current;
    const term = raw.trim();
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          if (term) url.searchParams.set("q", term);
          else url.searchParams.delete("q");
          url.searchParams.delete("query");
          window.history.replaceState({}, "", url.toString());
        } catch {
          /* ignore */
        }
      }

      const [page, companyHits] = await Promise.all([
        fetchMedicinesPage({
          limit: term ? 36 : 18,
          filters: { query: term },
        }),
        fetchCompanyHits(term, term ? 8 : 6),
      ]);

      if (id !== requestId.current) return;

      if (page.connectionError && page.items.length === 0) {
        setItems([]);
        setCompanies([]);
        setResultTotal(0);
        setError(
          page.errorMessage ||
            t("Could not reach the medicine catalog.", "تعذر الوصول إلى كتالوج الأدوية."),
        );
        return;
      }

      setItems(page.items);
      setCompanies(companyHits);
      setResultTotal(page.total || page.items.length);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setItems([]);
      setCompanies([]);
      setResultTotal(0);
      setError(
        err instanceof Error
          ? err.message
          : t("Search failed. Please try again.", "فشل البحث. يرجى المحاولة مرة أخرى."),
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, query.trim() ? 280 : 0);
    return () => window.clearTimeout(handle);
  }, [query, runSearch]);

  useEffect(() => {
    // Focus search on mount for mobile usability
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, []);

  const displayItems = useMemo(() => groupCatalogNearDuplicates(items), [items]);
  const offline = Boolean(error && looksLikeNetworkError(error) && displayItems.length === 0);
  const showEmpty =
    !loading && !offline && displayItems.length === 0 && companies.length === 0;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <div className="container mx-auto max-w-6xl px-3 py-2 sm:px-4 sm:py-5 pb-24">
      <div className="sticky top-0 z-20 -mx-3 px-3 sm:-mx-4 sm:px-4 py-2 mb-3 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Universal search", "بحث شامل")}
            </p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {t("Search medicines & companies", "ابحث في الأدوية والشركات")}
            </h1>
          </div>
          <Link href={query.trim() ? `/world-search?q=${encodeURIComponent(query.trim())}` : "/world-search"}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-teal-700 h-8 shrink-0">
              <Globe2 className="h-4 w-4" />
              {t("World", "عالمي")}
            </Button>
          </Link>
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <button
              type="submit"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-emerald-700"
              aria-label={t("Search", "بحث")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
                  onClick={() => setQuery("")}
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
                <MobileVoiceSearchButton onTranscript={(text) => setQuery(text)} />
              </div>
            </div>
          </div>
        </form>
      </div>

      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {t(
          "Search the live medicines catalog together with company profiles. Open any result for product details, similars, or company pages.",
          "ابحث في كتالوج الأدوية المباشر مع ملفات الشركات. افتح أي نتيجة لتفاصيل المنتج أو المثائل أو صفحة الشركة.",
        )}
      </p>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricCard
          label={t("Catalog products", "منتجات الكتالوج")}
          value={formatMetric(metrics.catalogTotal, metrics.loading)}
          hint={
            metrics.error
              ? t("Unavailable", "غير متاح")
              : t("Live Appwrite catalog", "كتالوج Appwrite المباشر")
          }
        />
        <MetricCard
          label={t("Companies", "الشركات")}
          value={formatMetric(metrics.companyTotal, metrics.loading)}
          hint={t("Verified profiles", "ملفات موثقة")}
        />
        <MetricCard
          label={t("This search", "هذا البحث")}
          value={
            loading
              ? "…"
              : query.trim()
                ? resultTotal >= 5000
                  ? `${resultTotal.toLocaleString()}+`
                  : resultTotal.toLocaleString()
                : "—"
          }
          hint={
            query.trim()
              ? t("Matching products", "منتجات مطابقة")
              : t("Type to search", "اكتب للبحث")
          }
          className="col-span-2 sm:col-span-1"
        />
      </section>

      {error && !offline ? (
        <Alert className="mb-4 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      ) : null}

      {companies.length > 0 ? (
        <section className="mb-5">
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
                    <div className="font-semibold leading-snug truncate">
                      {company.display_name}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        company.origin,
                        company.product_count != null
                          ? t(
                              `${company.product_count} products`,
                              `${company.product_count} منتج`,
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {query.trim()
              ? t("Medicine results", "نتائج الأدوية")
              : t("From the catalog", "من الكتالوج")}
          </h2>
          {query.trim() ? (
            <Link
              href={encyclopediaSearchUrl(query)}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              {t("Open in encyclopedia", "افتح في الموسوعة")}
            </Link>
          ) : null}
        </div>

        {loading && displayItems.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
            {t("Searching catalog…", "جاري البحث في الكتالوج…")}
          </div>
        ) : null}

        {offline ? <CatalogEmptyState query={query} offline /> : null}

        {showEmpty ? <CatalogEmptyState query={query} /> : null}

        {displayItems.length > 0 ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item) => (
              <EncyclopediaCatalogCard
                key={item.$id || `${item.canonical_id}-${item.name_en}`}
                item={item}
                view="comfortable"
                showIngredient
                showDrugClass={false}
                showManufacturer
              />
            ))}
          </div>
        ) : null}

        {loading && displayItems.length > 0 ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("Updating results…", "تحديث النتائج…")}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardContent className="p-3.5">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
          {value}
        </div>
        {hint ? (
          <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
