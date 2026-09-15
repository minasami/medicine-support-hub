/**
 * Smoke tests: EN+AR search normalize, expand aliases, fuzzy ranker, Did-you-mean.
 * Run: npx tsx src/lib/search-intelligence.test.ts
 */

import { normalizeSearchKey } from "./search-normalize";
import { expandSearchQuery, preferredCorrection } from "./expand-search-query";
import {
  fuzzyMatchScore,
  isStrongFuzzyMatch,
  normalizeFuzzy,
  pharmaFuzzyScore,
} from "./fuzzy-search";
import {
  medicineQueryScore,
  rankMedicineResults,
} from "./rank-medicine-results";
import { suggestDidYouMean } from "./did-you-mean";
import { scoreComboboxOption } from "./combobox-rank";
import { normalizeArabicDrugName } from "./arabic-fuzzy-match";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(detail ? `${name}: ${detail}` : name);
    console.log("  FAIL", name, detail || "");
  }
}

function section(title: string) {
  console.log("\n===", title, "===");
}

section("normalizeSearchKey EN+AR");
assert(normalizeSearchKey("Concor 5mg") === "concor 5mg", "EN lower+punct");
assert(
  normalizeSearchKey("\u0623\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646") ===
    normalizeSearchKey("\u0627\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646"),
  "alef variants equal",
);
assert(
  normalizeSearchKey("\u0645\u064e\u062a\u0652\u0641\u064f\u0648\u0631\u0645\u0650\u064a\u0646") ===
    normalizeArabicDrugName("\u0645\u062a\u0641\u0648\u0631\u0645\u064a\u0646") ||
    normalizeSearchKey("\u0645\u064e\u062a\u0652\u0641\u064f\u0648\u0631\u0645\u0650\u064a\u0646").includes("\u0645\u062a\u0641"),
  "tashkeel stripped",
);
assert(normalizeSearchKey("congestal\u0640\u0640") === normalizeSearchKey("congestal"), "tatweel");
assert(normalizeFuzzy("Panadol") === "panadol", "fuzzy uses same key");

section("expandSearchQuery aliases");
const congesta = expandSearchQuery("congesta");
assert(congesta.some((v) => /congestal/i.test(v)), "congesta → congestal");
assert(preferredCorrection("congesta")?.toLowerCase() === "congestal", "preferred congesta");
const concoer = expandSearchQuery("concoer");
assert(concoer.some((v) => /concor/i.test(v)), "concoer → concor");
const amox = expandSearchQuery("amoxycillin");
assert(amox.some((v) => /amoxicillin/i.test(v)), "amoxycillin → amoxicillin");
const arAlef = expandSearchQuery("\u0623\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646");
assert(arAlef.length >= 2, "AR expands to variants");
assert(expandSearchQuery("").length === 0, "empty expand");

section("fuzzy EN misspellings");
assert(fuzzyMatchScore("congesta", "Congestal") >= 0.78, "congesta~congestal");
assert(fuzzyMatchScore("concoer", "Concor") >= 0.7, "concoer~concor");
assert(isStrongFuzzyMatch("panadole", "Panadol"), "panadole strong");
assert(pharmaFuzzyScore("omeprezole", "omeprazole") >= 0.8, "pharma omeprazole");
assert(fuzzyMatchScore("zzzzxx", "Congestal") < 0.55, "unrelated low");

section("rankMedicineResults");
const catalog = [
  { name_en: "Congestal", name_ar: "كونجستال", scientific_name: "paracetamol + pseudoephedrine", manufacturer: "EVA" },
  { name_en: "Congestal Plus Cold & Flu Combination Syrup Extra Strength", name_ar: null, scientific_name: "paracetamol", manufacturer: "EVA" },
  { name_en: "Concor", name_ar: "كونكور", scientific_name: "bisoprolol", manufacturer: "Merck" },
  { name_en: "Panadol", name_ar: "بانادول", scientific_name: "paracetamol", manufacturer: "GSK" },
  { name_en: "Metformin", name_ar: "ميتفورمين", scientific_name: "metformin", manufacturer: "CID" },
];
const rankedCongesta = rankMedicineResults(catalog, "congesta");
assert(
  rankedCongesta[0]?.name_en?.toLowerCase().startsWith("congestal"),
  "congesta ranks Congestal first",
);
assert(
  medicineQueryScore(catalog[0], "congesta") < medicineQueryScore(catalog[2], "congesta"),
  "Congestal beats Concor for congesta",
);
const rankedConcor = rankMedicineResults(catalog, "concoer");
assert(rankedConcor[0]?.name_en === "Concor", "concoer → Concor first");
// Short standalone preferred over long combo when both match
const rankedShort = rankMedicineResults(catalog, "congestal");
assert(
  rankedShort[0]?.name_en === "Congestal",
  "short Congestal above long combo",
);

section("Arabic ranking");
const arQuery = "\u0623\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646"; // أموكسيسيلين
const arCatalog = [
  { name_en: "Amoxicillin", name_ar: "\u0627\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646", scientific_name: "amoxicillin", manufacturer: "EIPICO" },
  { name_en: "Metformin", name_ar: "\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646", scientific_name: "metformin", manufacturer: "CID" },
];
const arRanked = rankMedicineResults(arCatalog, arQuery);
assert(arRanked[0]?.name_en === "Amoxicillin", "AR alef variant finds Amoxicillin");
assert(medicineQueryScore(arCatalog[0], arQuery) <= 65, "AR fuzzy tier or better");

section("Did you mean");
const dym = suggestDidYouMean("congesta", rankedCongesta);
assert(Boolean(dym?.suggestion), "suggests for congesta");
assert(/congestal/i.test(dym?.suggestion || ""), "suggestion congestal");
assert(suggestDidYouMean("Concor", rankedConcor) == null, "no suggest on exactish");
assert(suggestDidYouMean("xy", catalog) == null, "no suggest short");

section("combobox rank");
assert(scoreComboboxOption("congesta", "Congestal") > 0, "combobox fuzzy hit");
assert(
  scoreComboboxOption("metformin", "Metformin") >
    scoreComboboxOption("metformin", "Metformin + Sitagliptin Combination Tablets Extra"),
  "combobox prefers short",
);

console.log("\n========================================");
console.log(`passed=${passed} failed=${failed}`);
if (failures.length) {
  failures.forEach((f) => console.log(" -", f));
  process.exit(1);
}
console.log("ALL SEARCH-INTELLIGENCE TESTS PASSED");
