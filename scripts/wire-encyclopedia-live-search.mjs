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

const needle =
  'const defaultFilters: Filters = {\n' +
  '  manufacturer: "",\n' +
  '  drugClass: "",\n' +
  '  route: "",\n' +
  '  category: "",\n' +
  '  scientificName: "",\n' +
  '  verifiedOnly: false,\n' +
  '};';

const insert =
  needle +
  '\n\n/** High-intent starter queries for empty / no-result states */\n' +
  'const POPULAR_QUERIES: { en: string; ar: string }[] = [\n' +
  '  { en: "Panadol", ar: "بنادول" },\n' +
  '  { en: "Augmentin", ar: "أوجمنتين" },\n' +
  '  { en: "Concor", ar: "كونكور" },\n' +
  '  { en: "Insulin", ar: "أنسولين" },\n' +
  '  { en: "Vitamin D", ar: "فيتامين د" },\n' +
  '  { en: "Amoxicillin", ar: "أموكسيسيلين" },\n' +
  '  { en: "Omeprazole", ar: "أوميبرازول" },\n' +
  '  { en: "Aspirin", ar: "أسبرين" },\n' +
  '];';

if (!text.includes(needle)) {
  console.error("defaultFilters block not found");
  process.exit(1);
}
text = text.replace(needle, insert);

const facets =
  '  useEffect(() => {\n' +
  '    void supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v2")\n' +
  '      .then((f) => setFacets(Array.isArray(f) ? f : []))\n' +
  '      .catch(() => setFacets([]));\n' +
  '  }, [supabaseFetch]);';

const debounce =
  facets +
  '\n\n  // Live search: debounce typing so results update without requiring Submit\n' +
  '  const bootstrapped = useRef(false);\n' +
  '  useEffect(() => {\n' +
  '    if (!bootstrapped.current) {\n' +
  '      bootstrapped.current = true;\n' +
  '      return;\n' +
  '    }\n' +
  '    const handle = window.setTimeout(() => {\n' +
  '      if (typeof window === "undefined") return;\n' +
  '      writeQueryParams(query, filters);\n' +
  '      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;\n' +
  '      void load(0, query, filters);\n' +
  '    }, 380);\n' +
  '    return () => window.clearTimeout(handle);\n' +
  '  }, [query]);';

if (!text.includes(facets)) {
  console.error("facets effect not found");
  process.exit(1);
}
text = text.replace(facets, debounce);

const formEnd = '        </form>\n\n        {activeFilters.length > 0 && (';

const chips =
  '        </form>\n\n' +
  '        {!query.trim() && activeFilters.length === 0 && (\n' +
  '          <div className="flex flex-wrap items-center gap-2 pt-1">\n' +
  '            <span className="text-xs text-muted-foreground font-medium">\n' +
  '              {t("Try:", "جرّب:")}\n' +
  '            </span>\n' +
  '            {POPULAR_QUERIES.map((p) => (\n' +
  '              <button\n' +
  '                key={p.en}\n' +
  '                type="button"\n' +
  '                onClick={() => {\n' +
  '                  setQuery(p.en);\n' +
  '                  writeQueryParams(p.en, filters);\n' +
  '                  lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;\n' +
  '                  void load(0, p.en, filters);\n' +
  '                }}\n' +
  '                className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"\n' +
  '              >\n' +
  '                {p.en}\n' +
  '                <span className="text-muted-foreground mx-1">·</span>\n' +
  '                <span className="dir-rtl">{p.ar}</span>\n' +
  '              </button>\n' +
  '            ))}\n' +
  '          </div>\n' +
  '        )}\n\n' +
  '        {activeFilters.length > 0 && (';

if (!text.includes(formEnd)) {
  console.error("form end not found");
  process.exit(1);
}
text = text.replace(formEnd, chips);

const oldEmpty =
  '            <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed p-8">\n' +
  '              <div className="text-4xl mb-3">🔍</div>\n' +
  '              <h3 className="text-lg font-semibold mb-1">\n' +
  '                {t("No medicines found", "لم يتم العثور على أدوية")}\n' +
  '              </h3>\n' +
  '              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">\n' +
  '                {t(\n' +
  '                  "Try adjusting your search terms or clearing active filters to expand your search.",\n' +
  '                  "جرب تعديل كلمات البحث أو مسح الفلاتر النشطة لتوسيع نطاق البحث.",\n' +
  '                )}\n' +
  '              </p>\n' +
  '              <Button variant="outline" size="sm" onClick={handleResetFilters}>\n' +
  '                {t("Clear all search filters", "مسح جميع فلاتر البحث")}\n' +
  '              </Button>\n' +
  '            </div>';

const newEmpty =
  '            <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed p-8">\n' +
  '              <div className="text-4xl mb-3">🔍</div>\n' +
  '              <h3 className="text-lg font-semibold mb-1">\n' +
  '                {t("No medicines found", "لم يتم العثور على أدوية")}\n' +
  '              </h3>\n' +
  '              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">\n' +
  '                {t(\n' +
  '                  "Try a shorter name, the active ingredient, or clear filters. Popular searches often work better than full product phrases.",\n' +
  '                  "جرّب اسماً أقصر أو المادة الفعالة أو امسح الفلاتر. عمليات البحث الشائعة غالباً أدق من العبارة الكاملة.",\n' +
  '                )}\n' +
  '              </p>\n' +
  '              <div className="flex flex-wrap justify-center gap-2 mb-4">\n' +
  '                {POPULAR_QUERIES.slice(0, 6).map((p) => (\n' +
  '                  <button\n' +
  '                    key={`empty-${p.en}`}\n' +
  '                    type="button"\n' +
  '                    onClick={() => {\n' +
  '                      setQuery(p.en);\n' +
  '                      writeQueryParams(p.en, defaultFilters);\n' +
  '                      setFilters(defaultFilters);\n' +
  '                      lastUrlKey.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;\n' +
  '                      void load(0, p.en, defaultFilters);\n' +
  '                    }}\n' +
  '                    className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:border-emerald-500/40"\n' +
  '                  >\n' +
  '                    {p.en}\n' +
  '                  </button>\n' +
  '                ))}\n' +
  '              </div>\n' +
  '              <div className="flex flex-wrap justify-center gap-2">\n' +
  '                <Button variant="outline" size="sm" onClick={handleResetFilters}>\n' +
  '                  {t("Clear all search filters", "مسح جميع فلاتر البحث")}\n' +
  '                </Button>\n' +
  '                <Button asChild variant="secondary" size="sm">\n' +
  '                  <Link href="/scan">{t("Scan barcode instead", "امسح الباركود بدلاً من ذلك")}</Link>\n' +
  '                </Button>\n' +
  '              </div>\n' +
  '            </div>';

if (!text.includes(oldEmpty)) {
  console.error("empty state not found");
  process.exit(1);
}
text = text.replace(oldEmpty, newEmpty);

fs.writeFileSync(file, text);
console.log("Wired live search UX into", file);
