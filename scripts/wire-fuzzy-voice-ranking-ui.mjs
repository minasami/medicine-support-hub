/**
 * Wire fuzzy ranking helpers + voice search + ranking examples into encyclopedia.
 *
 *   node scripts/wire-fuzzy-voice-ranking-ui.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");

let s = fs.readFileSync(pagePath, "utf8");
let changed = false;

// Imports
if (!s.includes("MobileVoiceSearchButton")) {
  const anchor = 'from "@/lib/medicines-appwrite-page";';
  if (s.includes(anchor)) {
    s = s.replace(
      anchor,
      anchor +
        '\nimport { MobileVoiceSearchButton } from "@/components/mobile-voice-search-button";\nimport { SearchRankingExamples } from "@/components/search-ranking-examples";',
    );
    changed = true;
  }
}

if (!s.includes("filterWeakFuzzyHits") && s.includes("rankMedicineResults")) {
  s = s.replace(
    'import { rankMedicineResults } from "@/lib/rank-medicine-results";',
    'import { rankMedicineResults, filterWeakFuzzyHits } from "@/lib/rank-medicine-results";',
  );
  changed = true;
} else if (!s.includes("rankMedicineResults")) {
  // ensure import exists
  const a = 'from "@/lib/medicines-appwrite-page";';
  if (s.includes(a) && !s.includes("rank-medicine-results")) {
    s = s.replace(
      a,
      a +
        '\nimport { rankMedicineResults, filterWeakFuzzyHits } from "@/lib/rank-medicine-results";',
    );
    changed = true;
  }
}

// Apply filterWeakFuzzyHits after rank if present
if (s.includes("rankMedicineResults(") && !s.includes("filterWeakFuzzyHits(")) {
  s = s.replace(
    /rankMedicineResults\(\s*applyLocalProductUpdates\(page\.items\) as Medicine\[],\s*nextQuery,\s*\)/,
    "filterWeakFuzzyHits(\n          rankMedicineResults(\n            applyLocalProductUpdates(page.items) as Medicine[],\n            nextQuery,\n          ),\n          nextQuery,\n        )",
  );
  changed = true;
}

// Voice button next to search input — look for Input with query onChange
if (!s.includes("<MobileVoiceSearchButton")) {
  const inputBlock = `className="pl-9 pr-4 py-2.5 rounded-xl border-emerald-500/20 focus:border-emerald-500"
              autoComplete="off"
              enterKeyHint="search"
            />`;
  const withVoice = `className="pl-9 pr-12 py-2.5 rounded-xl border-emerald-500/20 focus:border-emerald-500"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden">
              <MobileVoiceSearchButton
                onTranscript={(text) => {
                  setQuery(text);
                }}
              />
            </div>`;
  if (s.includes(inputBlock)) {
    s = s.replace(inputBlock, withVoice);
    changed = true;
  } else {
    // looser: after enterKeyHint search on Input
    const loose =
      'enterKeyHint="search"\n            />';
    if (s.includes(loose) && s.includes("setQuery")) {
      s = s.replace(
        loose,
        'enterKeyHint="search"\n              inputMode="search"\n            />\n            <div className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden">\n              <MobileVoiceSearchButton\n                onTranscript={(text) => {\n                  setQuery(text);\n                }}\n              />\n            </div>',
      );
      changed = true;
    }
  }
}

// Ranking examples under popular chips / before results
if (!s.includes("<SearchRankingExamples")) {
  const markers = [
    `{/* Results meta */}`,
    `<div className="flex flex-wrap items-center justify-between gap-2 mb-4">`,
    `Showing`,
  ];
  let inserted = false;
  for (const m of markers) {
    const i = s.indexOf(m);
    if (i >= 0) {
      s =
        s.slice(0, i) +
        `<SearchRankingExamples className="mb-4" compact />\n\n          ` +
        s.slice(i);
      inserted = true;
      changed = true;
      break;
    }
  }
  if (!inserted) {
    console.warn("Could not place SearchRankingExamples — add manually near results meta");
  }
}

if (changed) {
  fs.writeFileSync(pagePath, s);
  console.log("Updated", pagePath);
} else {
  console.log("No changes (already wired or markers moved)");
}
