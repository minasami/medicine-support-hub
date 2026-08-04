#!/usr/bin/env node
/**
 * Applies live-search UX to medicines-encyclopedia.tsx
 * Run: node scripts/wire-encyclopedia-live-search.mjs
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join("apps/web/src/pages/medicines-encyclopedia.tsx");
let text = fs.readFileSync(file, "utf8");

if (text.includes("POPULAR_QUERIES")) {
  console.log("Already wired");
  process.exit(0);
}

const needle = `const defaultFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  category: "",
  scientificName: "",
  verifiedOnly: false,
}`; 

const insert = `const defaultFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  category: "",
  scientificName: "",
  verifiedOnly: false,
};

/** High-intent starter queries for empty / no-result states */
const POPULAR_QUERIES: { en: string; ar: string }[] = [
  { en: "Panadol", ar: "بنادول" },
  { en: "Augmentin", ar: "أوجمنتين" },
  { en: "Concor", ar: "كونكور" },
  { en: "Insulin", ar: "أنسولين" },
  { en: "Vitamin D", ar: "فيتامين د" },
  { en: "Amoxicillin", ar: "أموكسيسيلين" },
  { en: "Omeprazole", ar: "أوميبرازول" },
  { en: "Aspirin", ar: "أسبرين" },
]`;

if (!text.includes(needle)) throw new Error("defaultFilters not found");
text = text.replace(needle, insert);

const facets = `  useEffect(() => {
    void supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v2")
      .then((f) => setFacets(Array.isArray(f) ? f : []))
      .catch(() => setFacets([]));
  }, [supabaseFetch]);`;

const debounce = `  useEffect(() => {
    void supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v2")
      .then((f) => setFacets(Array.isArray(f) ? f : []))
      .catch(() => setFacets([]));
  }, [supabaseFetch]);

  // Live search: debounce typing so results update without requiring Submit
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      return;
    }
    const handle = window.setTimeout(() => {
      if (typeof window === "undefined") return;
      writeQueryParams(query, filters);
      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void load(0, query, filters);
    }, 380);
    return () => window.clearTimeout(handle);
  }, [query]);`;

if (!text.includes(facets)) throw new Error("facets effect not found");
text = text.replace(facets, debounce);

const formEnd = `        </form>

        {activeFilters.length > 0 && (`;

const chips = `        </form>

        {!query.trim() && activeFilters.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {t("Try:", "جرّب:")}
            </span>
            {POPULAR_QUERIES.map((p) => (
              <button
                key={p.en}
                type="button"
                onClick={() => {
                  setQuery(p.en);
                  writeQueryParams(p.en, filters);
                  lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  void load(0, p.en, filters);
                }}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
              >
                {p.en}
                <span className="text-muted-foreground mx-1">·</span>
                <span className="dir-rtl">{p.ar}</span>
              </button>
            ))}
          </div>
        )}

        {activeFilters.length > 0 && (`;

if (!text.includes(formEnd)) throw new Error("form end not found");
text = text.replace(formEnd, chips);

const oldEmpty = `            <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed p-8">
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
            </div>`;

const newEmpty = `            <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed p-8">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold mb-1">
                {t("No medicines found", "لم يتم العثور على أدوية")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                {t(
                  "Try a shorter name, the active ingredient, or clear filters. Popular searches often work better than full product phrases.",
                  "جرّب اسماً أقصر أو المادة الفعالة أو امسح الفلاتر. عمليات البحث الشائعة غالباً أدق من العبارة الكاملة.",
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {POPULAR_QUERIES.slice(0, 6).map((p) => (
                  <button
                    key={`empty-${p.en}`}
                    type="button"
                    onClick={() => {
                      setQuery(p.en);
                      writeQueryParams(p.en, defaultFilters);
                      setFilters(defaultFilters);
                      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                      void load(0, p.en, defaultFilters);
                    }}
                    className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:border-emerald-500/40"
                  >
                    {p.en}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  {t("Clear all search filters", "مسح جميع فلاتر البحث")}
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/scan">{t("Scan barcode instead", "امسح الباركود بدلاً من ذلك")}</Link>
                </Button>
              </div>
            </div>`;

if (!text.includes(oldEmpty)) throw new Error("empty state not found");
text = text.replace(oldEmpty, newEmpty);

fs.writeFileSync(file, text);
console.log("Wired live search UX into", file);
