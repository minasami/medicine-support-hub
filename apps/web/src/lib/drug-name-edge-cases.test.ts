/**
 * Edge-case unit tests: Unicode forms, Arabic normalize, transliteration, WHO EML.
 * Run: npx tsx src/lib/drug-name-edge-cases.test.ts
 */

import {
  unicodeNormalize,
  normalizeUnicodeForMatch,
  supportsUnicodeNormalize,
} from "./unicode-normalize";
import {
  normalizeArabicDrugName,
  stripDoseTokens,
  arabicFuzzyScore,
  scoreProductFields,
} from "./arabic-fuzzy-match";
import {
  toLatinDrugKey,
  arabicDrugDictLookup,
  expandQueryVariants,
  hasArabicScript,
  transliterateArabicLetters,
} from "./arabic-transliterate";
import { searchWhoEmlLocal, isLikelyWhoEssential, WHO_EML_CORE } from "./who-eml";

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

section("ICU normalization forms");
assert(supportsUnicodeNormalize(), "runtime supports String.normalize");
assert(unicodeNormalize("\ufb01", "NFC") === "\ufb01", "NFC keeps fi ligature");
assert(unicodeNormalize("\ufb01", "NFKC") === "fi", "NFKC splits fi ligature");
assert(unicodeNormalize("\uff15\uff10\uff10", "NFC") === "\uff15\uff10\uff10", "NFC keeps fullwidth");
assert(unicodeNormalize("\uff15\uff10\uff10", "NFKC") === "500", "NFKC maps fullwidth digits");
assert(unicodeNormalize("\u2460", "NFKC") === "1", "NFKC maps circled digit");
assert(unicodeNormalize("a\u00a0b", "NFKC") === "a b", "NFKC maps NBSP to space");
for (const form of ["NFC", "NFD", "NFKC", "NFKD"] as const) {
  const once = unicodeNormalize("caf\u00e9 \ufb01 5", form);
  assert(once === unicodeNormalize(once, form), `idempotent ${form}`);
}
assert(
  normalizeUnicodeForMatch("metformin\u00a0500\u00a0mg") === "metformin 500 mg",
  "match path: NBSP collapsed",
);
assert(!normalizeUnicodeForMatch("\ufeffmetformin").includes("\ufeff"), "BOM stripped");
assert(!normalizeUnicodeForMatch("a\u200cb").includes("\u200c"), "ZWNJ stripped");
assert(!normalizeUnicodeForMatch("\u200fAR\u200e").includes("\u200f"), "RLM stripped");

section("Arabic drug-name normalize");
assert(normalizeArabicDrugName("") === "", "empty");
assert(normalizeArabicDrugName("METFORMIN") === "metformin", "Latin lowercased");
assert(
  normalizeArabicDrugName("\u0623\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646") ===
    normalizeArabicDrugName("\u0627\u0645\u0648\u0643\u0633\u064a\u0633\u064a\u0644\u064a\u0646"),
  "alef variants collapse",
);
assert(normalizeArabicDrugName("\u0661\u0662\u0663") === "123", "Arabic-Indic digits");
assert(
  stripDoseTokens(normalizeArabicDrugName("metformin 500 mg")).includes("metformin"),
  "dose tokens stripped",
);

section("Transliteration");
assert(hasArabicScript("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646") === true, "detects Arabic");
assert(hasArabicScript("metformin") === false, "Latin not Arabic");
assert(arabicDrugDictLookup("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646")[0] === "metformin", "dict metformin");
assert(toLatinDrugKey("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646") === "metformin", "latin key");
assert(expandQueryVariants("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646").includes("metformin"), "variants");
assert(transliterateArabicLetters("\u0645\u064a\u062a").length >= 2, "letter map");

section("Fuzzy score");
assert(arabicFuzzyScore("", "metformin") === 0, "empty query");
assert(arabicFuzzyScore("metformin", "metformin") === 100, "exact");
assert(arabicFuzzyScore("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646", "metformin") === 100, "AR-EN 100");
assert(arabicFuzzyScore("metformin 500mg", "metformin") >= 90, "dose-stripped");
assert(arabicFuzzyScore("xyz", "metformin") < 55, "unrelated low");
const scored = scoreProductFields("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646", {
  name_en: "Metformin",
  name_ar: "\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646",
  scientific_name: "metformin",
});
assert(scored.score >= 85, "multi-field high");

section("WHO EML");
assert(WHO_EML_CORE.length >= 80, "core list size");
assert(searchWhoEmlLocal("").length === 0, "empty query");
assert(searchWhoEmlLocal("metformin")[0]?.name_en === "metformin", "EN metformin");
assert(searchWhoEmlLocal("\u0645\u064a\u062a\u0641\u0648\u0631\u0645\u064a\u0646")[0]?.name_en === "metformin", "AR metformin");
assert(searchWhoEmlLocal("aspirin")[0]?.name_en === "acetylsalicylic acid", "alias aspirin");
assert(isLikelyWhoEssential("metformin") === true, "essential");
assert(isLikelyWhoEssential("not-a-real-drug-zzzz") === false, "junk");
assert(searchWhoEmlLocal("metformin")[0]?.source === "who_eml", "source");

console.log("\n========================================");
console.log(`passed=${passed} failed=${failed}`);
if (failures.length) {
  failures.forEach((f) => console.log(" -", f));
  process.exit(1);
}
console.log("ALL EDGE-CASE TESTS PASSED");
