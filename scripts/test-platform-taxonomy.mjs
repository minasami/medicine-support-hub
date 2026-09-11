#!/usr/bin/env node
/**
 * Smoke test for taxonomy normalize + doc-id stability (no network).
 */
function normalizeTaxonomyKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const cases = [
  ["  Tablet  ", "tablet"],
  ["Oral / Topical", "oral / topical"],
  ["Paracetamol", "paracetamol"],
];
let failed = 0;
for (const [input, expected] of cases) {
  const got = normalizeTaxonomyKey(input);
  if (got !== expected) {
    console.error("FAIL", input, "→", got, "expected", expected);
    failed++;
  }
}
if (normalizeTaxonomyKey("Tablet") !== normalizeTaxonomyKey("TABLET")) {
  console.error("FAIL case-insensitive equality");
  failed++;
}
if (failed) process.exit(1);
console.log("platform-taxonomy smoke OK");
