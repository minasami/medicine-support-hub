/**
 * Run: npx tsx src/lib/encyclopedia-catalog.test.ts
 */
import {
  formatCatalogTitle,
  catalogIdentityKey,
  groupCatalogNearDuplicates,
  formatCatalogPriceRange,
  scrubCatalogNameRaw,
} from "./encyclopedia-catalog";
import type { MedicineListItem } from "./medicines-appwrite-page";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log("  FAIL", name);
  }
}

function item(partial: Partial<MedicineListItem> & { name_en: string }): MedicineListItem {
  return {
    canonical_id: partial.canonical_id ?? 1,
    name_en: partial.name_en,
    name_ar: partial.name_ar ?? null,
    scientific_name: partial.scientific_name ?? null,
    manufacturer: partial.manufacturer ?? null,
    category: null,
    dosage_form: null,
    strength: null,
    drug_class: partial.drug_class ?? null,
    route: null,
    product_type: null,
    current_price_egp: partial.current_price_egp ?? null,
    $id: partial.$id,
    image_url: partial.image_url ?? null,
    has_verified_dataset: partial.has_verified_dataset,
  };
}

assert(scrubCatalogNameRaw("-BM STRETCH") === "BM STRETCH", "strip leading hyphen");
assert(
  formatCatalogTitle("-BM STRETCH GUAZE BANDAGE 10 CM") === "BM Stretch Guaze Bandage 10 CM",
  "title case all-caps with CM kept",
);
assert(formatCatalogTitle("Panadol Extra") === "Panadol Extra", "leave mixed case");

const a = item({
  $id: "a",
  canonical_id: 10,
  name_en: "-BM STRETCH GUAZE BANDAGE 10 CM",
  current_price_egp: 8,
  scientific_name: "Active Ingredient",
});
const b = item({
  $id: "b",
  canonical_id: 11,
  name_en: "-BM STRETCH GUAZE BANDAGE 10 CM",
  current_price_egp: 7,
});
assert(catalogIdentityKey(a) === catalogIdentityKey(b), "same identity key");

const grouped = groupCatalogNearDuplicates([a, b]);
assert(grouped.length === 1, "collapsed to one card");
assert(grouped[0].variant_count === 2, "variant_count 2");
assert(formatCatalogPriceRange(grouped[0].price_min_egp, grouped[0].price_max_egp, null) === "7.00 – 8.00 EGP", "price range");

const c = item({ $id: "c", name_en: "-CONTROL NON STOP 6 CONDOMOS", current_price_egp: 1 });
assert(groupCatalogNearDuplicates([a, c]).length === 2, "different names stay separate");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
