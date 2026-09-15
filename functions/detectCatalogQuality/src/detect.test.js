/**
 * Run: node functions/detectCatalogQuality/src/detect.test.js
 */
import { detectIssues } from "./main.js";

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.log("FAIL", name);
  }
}

const docs = [
  {
    $id: "a",
    canonical_id: 1,
    name_en: "Panadol Extra 500mg",
    manufacturer: "GSK",
    strength: "500mg",
    barcode: "6224000123456",
    search_count_30d: 20,
    completeness_score: 0.1,
  },
  {
    $id: "b",
    canonical_id: 2,
    name_en: "Panadol Extra 500 mg",
    manufacturer: "GSK Egypt",
    strength: "500mg",
    barcode: "6224000123456",
  },
  {
    $id: "c",
    canonical_id: 3,
    name_en: "Unrelated Cream",
    manufacturer: "Other Co",
    image_url: "https://via.placeholder.com/100",
  },
];

const flags = detectIssues(docs);
assert(flags.some((f) => f.flag_type === "same_barcode"), "same_barcode detected");
assert(flags.some((f) => f.flag_type === "near_duplicate"), "near_duplicate detected");
assert(flags.some((f) => f.flag_type === "broken_image"), "broken_image detected");
assert(flags.some((f) => f.flag_type === "popular_incomplete"), "popular_incomplete detected");

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
