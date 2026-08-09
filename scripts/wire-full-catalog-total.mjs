/**
 * Appwrite listDocuments.total is capped (~5000). Search still hits full indexes.
 * Wire clearer UI + totalCapped flag so users don't think the DB is only 5k rows.
 *
 *   node scripts/wire-full-catalog-total.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- medicines-appwrite-page.ts ---
{
  const p = path.join(root, "apps/web/src/lib/medicines-appwrite-page.ts");
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("totalCapped")) {
    s = s.replace(
      `export type MedicinePageResult = {
  items: MedicineListItem[];
  total: number;
  limit: number;
  source: "appwrite" | "static_fallback";
  searchAttr?: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  connectionError?: boolean;
  errorMessage?: string | null;
};`,
      `export type MedicinePageResult = {
  items: MedicineListItem[];
  total: number;
  /** Appwrite often caps total at ~5000; search still covers the full collection. */
  totalCapped?: boolean;
  limit: number;
  source: "appwrite" | "static_fallback";
  searchAttr?: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  connectionError?: boolean;
  errorMessage?: string | null;
};`,
    );

    s = s.replace(
      `  const total = typeof res.total === "number" ? res.total : items.length;
  const hasMoreStrict = items.length >= limit;
  return {
    items,
    total: total || items.length,
    limit,
    source: "appwrite",
    searchAttr,
    nextCursor: hasMoreStrict ? nextCursor : null,
    hasMore: hasMoreStrict,
    connectionError: false,
    errorMessage: null,
  };`,
      `  const total = typeof res.total === "number" ? res.total : items.length;
  // Cursor pagination: more pages exist if this page was full — independent of total cap.
  const hasMoreStrict = items.length >= limit;
  const totalCapped = total >= 5000;
  return {
    items,
    total: total || items.length,
    totalCapped,
    limit,
    source: "appwrite",
    searchAttr,
    nextCursor: hasMoreStrict ? nextCursor : null,
    hasMore: hasMoreStrict,
    connectionError: false,
    errorMessage: null,
  };`,
    );

    fs.writeFileSync(p, s);
    console.log("patched", p);
  } else {
    console.log("already patched", p);
  }
}

// --- medicines-encyclopedia.tsx ---
{
  const p = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
  let s = fs.readFileSync(p, "utf8");

  if (!s.includes("totalCapped")) {
    // state
    if (s.includes("const [total, setTotal] = useState(0);")) {
      s = s.replace(
        "const [total, setTotal] = useState(0);",
        "const [total, setTotal] = useState(0);\n  const [totalCapped, setTotalCapped] = useState(false);",
      );
    }

    // set from page
    s = s.replace(
      "setTotal(page.total);\n        setHasMore(page.hasMore);",
      "setTotal(page.total);\n        setTotalCapped(Boolean(page.totalCapped) || page.total >= 5000);\n        setHasMore(page.hasMore);",
    );

    // reset on replace? optional

    // UI badge
    s = s.replace(
      `{total >= 5000 && (
                <span className="text-[10px] ml-1 opacity-70">
                  {t("(total may be capped by API)", "(الإجمالي قد يكون محدوداً من الواجهة)")}
                </span>
              )}`,
      `{totalCapped && (
                <span className="text-[10px] ml-1 opacity-70">
                  {t(
                    "· full catalog searchable (count display capped by API)",
                    "· البحث في الموسوعة كاملة (عرض العدد محدود من الواجهة)",
                  )}
                </span>
              )}`,
    );

    // End of catalog message when capped and hasMore false only
    s = s.replace(
      `{!hasMore && items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("End of catalog", "نهاية الدليل")} · {total.toLocaleString()}
              </p>
            )}`,
      `{!hasMore && items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {totalCapped
                  ? t(
                      "End of this result set · search still covers the full live catalog",
                      "نهاية هذه النتائج · البحث ما زال يغطي الموسوعة الكاملة",
                    )
                  : `${t("End of catalog", "نهاية الدليل")} · ${total.toLocaleString()}`}
              </p>
            )}`,
    );

    fs.writeFileSync(p, s);
    console.log("patched", p);
  } else {
    console.log("already patched", p);
  }
}

console.log("Done. Search already uses fulltext indexes on the whole medicines collection; only the total number was capped at ~5000 by Appwrite.");
