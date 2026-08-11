/**
 * Wire adaptive rank + search success/empty signals into medicines-encyclopedia.
 *
 *   node scripts/wire-adaptive-encyclopedia.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
let s = fs.readFileSync(pagePath, "utf8");
let changed = false;

if (!s.includes("@/lib/adaptive")) {
  const anchors = [
    'import { rankMedicineResults } from "@/lib/rank-medicine-results";',
    'import { rankMedicineResults, filterWeakFuzzyHits } from "@/lib/rank-medicine-results";',
  ];
  let done = false;
  for (const a of anchors) {
    if (s.includes(a)) {
      s = s.replace(
        a,
        a +
          '\nimport { adaptiveRankMedicineResults, recordAdaptiveEvent, resolveAdaptiveQuery } from "@/lib/adaptive";',
      );
      done = true;
      changed = true;
      break;
    }
  }
  if (!done) {
    // after medicines-appwrite-page import
    const a = 'from "@/lib/medicines-appwrite-page";';
    if (s.includes(a)) {
      s = s.replace(
        a,
        a +
          '\nimport { adaptiveRankMedicineResults, recordAdaptiveEvent, resolveAdaptiveQuery } from "@/lib/adaptive";',
      );
      changed = true;
    }
  }
}

// Prefer adaptiveRankMedicineResults over rankMedicineResults when ranking
if (s.includes("rankMedicineResults(") && !s.includes("adaptiveRankMedicineResults(")) {
  s = s.replace(/rankMedicineResults\(/g, "adaptiveRankMedicineResults(");
  changed = true;
}

// After setItems on replace mode, record signals — look for setHasMore(page.hasMore)
if (!s.includes("recordAdaptiveEvent(")) {
  const marker = "setHasMore(page.hasMore);";
  if (s.includes(marker)) {
    s = s.replace(
      marker,
      `setHasMore(page.hasMore);
        if (mode === "replace") {
          const q = (nextQuery || "").trim();
          if (q) {
            recordAdaptiveEvent({
              type: (page.items?.length || 0) > 0 ? "search_success" : "search_empty",
              query: resolveAdaptiveQuery(q).primary,
            });
          }
        }`,
    );
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(pagePath, s);
  console.log("Wired adaptive layer into", pagePath);
} else {
  console.log("No changes (already wired or markers missing)");
}
