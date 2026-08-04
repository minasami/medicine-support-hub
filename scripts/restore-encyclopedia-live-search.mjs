#!/usr/bin/env node
/**
 * Restores apps/web/src/pages/medicines-encyclopedia.tsx from known-good commit
 * dcbaf47 and applies popular chips + debounced live search.
 * Run: node scripts/restore-encyclopedia-live-search.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const target = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
const url =
  "https://raw.githubusercontent.com/minasami/medicine-support-hub/dcbaf47f68e91316be70a59c10f18f17b01df7be/apps/web/src/pages/medicines-encyclopedia.tsx";

const res = await fetch(url);
if (!res.ok) {
  console.error("Fetch failed", res.status);
  process.exit(1);
}
let content = await res.text();
if (!content.includes("Medicines Encyclopedia") || content.length < 5000) {
  console.error("Unexpected content size", content.length);
  process.exit(1);
}

content = content.replace(
  "  const { t } = useLanguage();",
  "  const { t, language } = useLanguage();",
);

const needle = `  const searchRequestId = useRef(0);
  const lastUrlKey = useRef<string>("");

  const activeFilters = useMemo(() => filterChips(filters, t), [filters, t]);`;

const insert = `  const searchRequestId = useRef(0);
  const lastUrlKey = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const POPULAR_QUERIES = [
    { q: "Panadol", ar: "بنادول" },
    { q: "Augmentin", ar: "أوجمنتين" },
    { q: "Concor", ar: "كونكور" },
    { q: "Insulin", ar: "أنسولين" },
    { q: "Vitamin D", ar: "فيتامين د" },
    { q: "Amoxicillin", ar: "أموكسيسيلين" },
  ] as const;

  const activeFilters = useMemo(() => filterChips(filters, t), [filters, t]);

  // Debounced live search as the user types (400ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (typeof window === "undefined") return;
      if (!isMedicinesPath(window.location.pathname)) return;
      writeQueryParams(query, filters);
      lastUrlKey.current = \`${window.location.pathname}${window.location.search}${window.location.hash}\`;
      void load(0, query, filters);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);`;

if (!content.includes(needle)) {
  console.error("Needle for debounce insert not found");
  process.exit(1);
}
content = content.replace(needle, insert);

const marker = `          <Link href="/scan">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded-xl gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Scan className="h-4 w-4" />
              {t("Scan Barcode", "مسح الباركود")}
            </Button>
          </Link>
        </form>`;

const chips = `
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">{t("Popular:", "شائع:")}</span>
          {POPULAR_QUERIES.map((p) => (
            <button
              key={p.q}
              type="button"
              onClick={() => {
                setQuery(p.q);
                writeQueryParams(p.q, filters);
                lastUrlKey.current = \`${window.location.pathname}${window.location.search}${window.location.hash}\`;
                void load(0, p.q, filters);
              }}
              className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
            >
              {language === "ar" ? p.ar : p.q}
            </button>
          ))}
        </div>
`;

if (!content.includes(marker)) {
  console.error("Form marker not found");
  process.exit(1);
}
content = content.replace(marker, marker + chips);

fs.writeFileSync(target, content, "utf8");
console.log("Restored", target, "bytes=", content.length);
