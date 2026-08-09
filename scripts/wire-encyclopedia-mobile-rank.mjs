/**
 * Wire rankMedicineResults into medicines-encyclopedia.tsx and polish mobile UI.
 * Run: node scripts/wire-encyclopedia-mobile-rank.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
const cssPath = path.join(root, "apps/web/src/mobile-platform.css");

let src = fs.readFileSync(pagePath, "utf8");

if (!src.includes("rankMedicineResults")) {
  // import
  const imp = `import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";`;
  const imp2 = `import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";
import { rankMedicineResults } from "@/lib/rank-medicine-results";`;
  if (!src.includes(imp)) {
    console.error("import block not found");
    process.exit(1);
  }
  src = src.replace(imp, imp2);

  // rank after applyLocalProductUpdates
  const old =
    "const updated = applyLocalProductUpdates(page.items) as Medicine[];";
  const neu =
    "const updated = rankMedicineResults(\n          applyLocalProductUpdates(page.items) as Medicine[],\n          nextQuery,\n        );";
  if (!src.includes(old)) {
    console.error("applyLocalProductUpdates line not found");
    process.exit(1);
  }
  src = src.replace(old, neu);

  // Hide cursor badge on mobile; soften meta row
  src = src.replace(
    `{nextCursor && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              cursor
            </Badge>
          )}`,
    `{nextCursor && (
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] font-normal">
              cursor
            </Badge>
          )}`,
  );

  // Showing 0 of 0 while loading — prefer searching copy only
  src = src.replace(
    `{loading && items.length === 0 ? (
            <span>{t("Searching catalog...", "جاري البحث في الدليل...")}</span>
          ) : (`,
    `{loading && items.length === 0 ? (
            <span className="text-muted-foreground">{t("Searching catalog...", "جاري البحث في الدليل...")}</span>
          ) : items.length === 0 && !loading ? (
            <span>{t("No matches in this view", "لا توجد نتائج في هذا العرض")}</span>
          ) : (`,
  );

  // Compact mobile title
  src = src.replace(
    `className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"`,
    `className="text-xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2 sm:gap-3"`,
  );

  // Sticky search on mobile
  src = src.replace(
    `<div className="mb-8 space-y-4">`,
    `<div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4 sticky top-0 z-20 -mx-4 px-4 py-3 sm:static sm:mx-0 sm:px-0 sm:py-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b sm:border-0 border-border/60">`,
  );

  // Single column already on mobile; ensure gap comfortable
  src = src.replace(
    `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"`,
    `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"`,
  );

  // Popular chips horizontal scroll on mobile
  src = src.replace(
    `<div className="flex flex-wrap items-center gap-2 pt-1">`,
    `<div className="flex flex-nowrap sm:flex-wrap items-center gap-2 pt-1 overflow-x-auto mobile-scrollbar-hidden -mx-1 px-1">`,
  );

  fs.writeFileSync(pagePath, src);
  console.log("Updated", pagePath);
} else {
  console.log("Already ranked");
}

// Mobile CSS polish
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* encyclopedia-mobile */";
if (!css.includes(marker)) {
  css += `

${marker}
@media (max-width: 767px) {
  /* Encyclopedia: avoid bottom-nav overlap on last cards */
  main .container {
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
  }

  /* Search chips stay tappable without wrapping the whole page width oddly */
  .mobile-scrollbar-hidden {
    -webkit-overflow-scrolling: touch;
  }

  /* Product cards: denser on narrow screens */
  main [class*="grid-cols"] > .border,
  main [class*="grid-cols"] > div > .border {
    border-radius: 0.85rem;
  }
}
`;
  fs.writeFileSync(cssPath, css);
  console.log("Updated", cssPath);
} else {
  console.log("CSS already polished");
}

console.log("Done.");
