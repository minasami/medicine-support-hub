/**
 * Run: node functions/detectCatalogQuality/src/detect.test.js
 */
import { detectIssues, skuVariantSkipReason } from "./main.js";

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
  } else {
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

// --- skuVariantSkipReason unit cases (from 2026-09-16 dismiss triage) ---
assert(
  skuVariantSkipReason("ACTI-COLLA ADVANCE 10 SACHETS", "ACTI-COLLA ADVANCE 30 SACHETS") ===
    "pack_count",
  "pack count sachets 10 vs 30",
);
assert(
  skuVariantSkipReason("AIG ESOMEPRAZOLE 40 MG 21 CAPS.", "AIG ESOMEPRAZOLE 40 MG 28 CAPS.") ===
    "pack_count",
  "pack count caps 21 vs 28",
);
assert(
  skuVariantSkipReason(
    "ASTRANTIA JOINT SUPPORT 120 TABLETS",
    "ASTRANTIA JOINT SUPPORT 60 TABLETS",
  ) === "pack_count",
  "pack count tablets 60 vs 120",
);

assert(
  skuVariantSkipReason(
    "BIO BALANCE ORGANIC ALOE VERA SHAMPOO 180 ML",
    "BIO BALANCE ORGANIC ALOE VERA SHAMPOO 330 ML",
  ) === "volume",
  "volume shampoo 180 vs 330",
);
assert(
  skuVariantSkipReason(
    "BIO BALANCE SUN PROTECTION CREAM SPF 50+ 40 ML",
    "BIO BALANCE SUN PROTECTION CREAM SPF 50+ 75 ML",
  ) === "volume",
  "volume cream 40 vs 75",
);
assert(
  skuVariantSkipReason(
    "BRAVODINE 10% ANTISEPTIC SPRAY 120 ML",
    "BRAVODINE 10% ANTISEPTIC SPRAY 60 ML",
  ) === "volume",
  "volume spray 60 vs 120",
);

assert(
  skuVariantSkipReason(
    "CEFTRIAXONE-SANDOZ 500 MG I.M. VIAL",
    "CEFTRIAXONE-SANDOZ 500 MG I.V. VIAL",
  ) === "route_IM_IV",
  "route IM vs IV Sandoz",
);
assert(
  skuVariantSkipReason(
    "CEFTRIAXONE-EVA 250 MG I.M. VIAL",
    "CEFTRIAXONE-EVA 250 MG I.V. VIAL",
  ) === "route_IM_IV",
  "route IM vs IV Eva",
);

assert(
  skuVariantSkipReason("A.DELON LYRA 2 EDT F/W 50 ML", "A.DELON LYRA EDT F/W 50 ML") ===
    "numbered_EDT",
  "numbered EDT Lyra 2 vs base",
);
assert(
  skuVariantSkipReason("A.DELON LYRA 3 EDT F/W 50 ML", "A.DELON LYRA EDT F/W 50 ML") ===
    "numbered_EDT",
  "numbered EDT Lyra 3 vs base",
);

// --- strength_dose (EN + AR) ---
assert(
  skuVariantSkipReason("مينوبور 1200 وحدة دولية فيال", "مينوبور 600 وحدة دولية فيال") ===
    "strength_dose",
  "Arabic IU 1200 vs 600 Menopur",
);
assert(
  skuVariantSkipReason(
    "سوليكا 100 وحدة+33 مكجم/مل 3 اقلام معبأة 3 مل",
    "سوليكا 100 وحدة 50مكجم/مل 3 اقلام معبأة 3 مل",
  ) === "strength_dose",
  "Arabic Soliqua mcg/ml 33 vs 50",
);
assert(
  skuVariantSkipReason("اكسارونت 2.5مجم 30 قرص", "اكسارونت 5مجم 30 قرص") === "strength_dose",
  "Arabic Xarelto-like 2.5mg vs 5mg",
);
assert(
  skuVariantSkipReason(
    "ACILOC 300MG 20 F.C. TABS. (CANCELLED)",
    "ACILOC 75 MG 20 F.C. TABS. (CANCELLED)",
  ) === "strength_dose",
  "ACILOC 300 vs 75 mg",
);
assert(
  skuVariantSkipReason(
    "ACTEMRA 200 MG/10ML VIAL FOR I.V. INF.",
    "ACTEMRA 400 MG/20ML VIAL FOR I.V. INF.",
  ) === "strength_dose",
  "ACTEMRA 200/10 vs 400/20",
);
assert(
  skuVariantSkipReason(
    "ACTEMRA 200 MG/10ML VIAL FOR I.V. INF.",
    "ACTEMRA 80 MG/4ML VIAL FOR I.V. INF.",
  ) === "strength_dose",
  "ACTEMRA 200/10 vs 80/4",
);
assert(
  skuVariantSkipReason("ABRAMMUNE 100MG/ML SYRUP(N/A YET)", "ABRAMMUNE 50MG/ML SYRUP(N/A YET)") ===
    "strength_dose",
  "ABRAMMUNE 100mg/ml vs 50mg/ml",
);
assert(
  skuVariantSkipReason("ABRAMMUNE 25 MG 10 CAPS.(N/A YET)", "ABRAMMUNE 50 MG 10 CAPS.(N/A YET)") ===
    "strength_dose",
  "ABRAMMUNE 25 vs 50 mg caps",
);

// --- label_descriptor (allowlist only; conservative) ---
assert(
  skuVariantSkipReason(
    "1 2 3 (ONE TWO THREE) 20 F.C.TABS.",
    "1 2 3 (ONE TWO THREE) EXTRA 20 F.C.TABS.",
  ) === "label_descriptor",
  "EXTRA line extension",
);
assert(
  skuVariantSkipReason("MOVE SANDAL GYPSUM (M)", "MOVE SANDAL GYPSUM (XL)") ===
    "label_descriptor",
  "size M vs XL",
);
assert(
  skuVariantSkipReason("AFTAMED ORAL GEL 15ML", "AFTAMED ORAL GEL JUNIOR 15ML") ===
    "label_descriptor",
  "JUNIOR descriptor",
);
assert(
  skuVariantSkipReason(
    "ALLMED D3 ADULTS ORAL SPARY 21 ML",
    "ALLMED D3 INFANTS ORAL SPARY 21 ML",
  ) === "label_descriptor",
  "ADULTS vs INFANTS",
);
assert(
  skuVariantSkipReason(
    "ALLMED D3 ADULTS ORAL SPARY 21 ML",
    "ALLMED D3 KIDS ORAL SPARY 21 ML",
  ) === "label_descriptor",
  "ADULTS vs KIDS",
);
assert(
  skuVariantSkipReason(
    "BARIESUN SPF 50+ KIDS MILK 100 ML",
    "BARIESUN SPF 50+ MILK 100 ML",
  ) === "label_descriptor",
  "KIDS line vs base",
);
assert(
  skuVariantSkipReason("ALVITAL IRON SYRUP 120 ML", "ALVITAL SYRUP 120 ML") ===
    "label_descriptor",
  "IRON line-extension when clearly labeled",
);
// Conservative: hyphenated single-letter suffix is NOT an allowlisted descriptor
assert(
  skuVariantSkipReason("ALVEOLIN SYRUP 100 ML", "ALVEOLIN-P SYRUP 100 ML") == null,
  "ALVEOLIN vs ALVEOLIN-P not skipped",
);

// --- dosage_form ---
assert(
  skuVariantSkipReason(
    "ALEJON SUN SCREEN 50+ SPF CREAM 75 ML",
    "ALEJON SUN SCREEN 50+ SPF GEL 75 ML",
  ) === "dosage_form",
  "cream vs gel",
);
assert(
  skuVariantSkipReason("AMPICILLIN-MISR 250 MG 12 CAPS.", "AMPICILLIN-MISR 250 MG VIAL") ===
    "dosage_form",
  "caps vs vial 250",
);
assert(
  skuVariantSkipReason("AMPICILLIN-MISR 500MG 12 CAPS.", "AMPICILLIN-MISR 500MG VIAL") ===
    "dosage_form",
  "caps vs vial 500",
);
assert(
  skuVariantSkipReason(
    "ANTHELIOS DERMO-PEDIATRICS SPF 50+ LOTION 200 ML",
    "ANTHELIOS DERMO-PEDIATRICS SPF 50+ SPRAY 200 ML",
  ) === "dosage_form",
  "lotion vs spray",
);
assert(
  skuVariantSkipReason(
    "BEESLINE WHITENING DAY CREAM SPF 30 - 50 ML",
    "BEESLINE WHITENING DAY GEL SPF 30 - 50 ML",
  ) === "dosage_form",
  "Beesline cream vs gel",
);
assert(
  skuVariantSkipReason("CARBAMIDE NUTRINOURISH CREAM", "CARBAMIDE NUTRINOURISH LOTION") ===
    "dosage_form",
  "cream vs lotion",
);
assert(
  skuVariantSkipReason(
    "AVENE TRIXERA+ SELECTIOSE EMOLLIENT CLEANSING GEL 400ML",
    "AVENE TRIXERA+ SELECTIOSE EMOLLIENT CREAM 200ML",
  ) === "dosage_form",
  "Avene gel vs cream different pack volume",
);

// Must still be flaggable — typo / label duplicate, not a SKU dimension skip
assert(
  skuVariantSkipReason("AVASTIN 400MG/16ML I.V. VIAL", "AVASTING 400MG/16ML I.V. VIAL") == null,
  "AVASTIN vs AVASTING not skipped",
);
assert(
  skuVariantSkipReason("AVASTIN 100MG/4ML I.V. VIAL", "AVASTING 100MG/4ML I.V. VIAL") == null,
  "AVASTIN 100 vs AVASTING 100 not skipped",
);

// One-sided pack/volume should not skip (unclear peer)
assert(
  skuVariantSkipReason(
    "COLISTIN SULPHATE 750.000 IU/15ML SUSP. 120ML",
    "COLISTIN SULPHATE 750.000 IU/15ML SUSP.",
  ) == null,
  "one-sided pack volume not skipped",
);

// Integration: detectIssues must not emit near_duplicate for distinct SKU variants,
// but must still emit for AVASTIN typo pairs.
const variantDocs = [
  {
    $id: "p10",
    name_en: "ACTI-COLLA ADVANCE 10 SACHETS",
    manufacturer: "Acti",
    strength: "",
  },
  {
    $id: "p30",
    name_en: "ACTI-COLLA ADVANCE 30 SACHETS",
    manufacturer: "Acti",
    strength: "",
  },
  {
    $id: "im",
    name_en: "CEFTRIAXONE-EVA 500 MG I.M. VIAL",
    manufacturer: "Eva",
    strength: "500mg",
  },
  {
    $id: "iv",
    name_en: "CEFTRIAXONE-EVA 500 MG I.V. VIAL",
    manufacturer: "Eva",
    strength: "500mg",
  },
  {
    $id: "av1",
    name_en: "AVASTIN 400MG/16ML I.V. VIAL",
    manufacturer: "Roche",
    strength: "400mg",
  },
  {
    $id: "av2",
    name_en: "AVASTING 400MG/16ML I.V. VIAL",
    manufacturer: "Roche",
    strength: "400mg",
  },
  {
    $id: "v180",
    name_en: "BIO BALANCE ORGANIC ALOE VERA SHAMPOO 180 ML",
    manufacturer: "Bio Balance",
    strength: "",
  },
  {
    $id: "v330",
    name_en: "BIO BALANCE ORGANIC ALOE VERA SHAMPOO 330 ML",
    manufacturer: "Bio Balance",
    strength: "",
  },
  {
    $id: "edt2",
    name_en: "A.DELON LYRA 2 EDT F/W 50 ML",
    manufacturer: "A.Delon",
    strength: "",
  },
  {
    $id: "edt0",
    name_en: "A.DELON LYRA EDT F/W 50 ML",
    manufacturer: "A.Delon",
    strength: "",
  },
  {
    $id: "sd25",
    name_en: "ABRAMMUNE 25 MG 10 CAPS.(N/A YET)",
    manufacturer: "Abra",
    strength: "25mg",
  },
  {
    $id: "sd50",
    name_en: "ABRAMMUNE 50 MG 10 CAPS.(N/A YET)",
    manufacturer: "Abra",
    strength: "50mg",
  },
  {
    $id: "ldA",
    name_en: "ALLMED D3 ADULTS ORAL SPARY 21 ML",
    manufacturer: "Allmed",
    strength: "",
  },
  {
    $id: "ldK",
    name_en: "ALLMED D3 KIDS ORAL SPARY 21 ML",
    manufacturer: "Allmed",
    strength: "",
  },
  {
    $id: "dfC",
    name_en: "ALEJON SUN SCREEN 50+ SPF CREAM 75 ML",
    manufacturer: "Alejon",
    strength: "",
  },
  {
    $id: "dfG",
    name_en: "ALEJON SUN SCREEN 50+ SPF GEL 75 ML",
    manufacturer: "Alejon",
    strength: "",
  },
];

const vFlags = detectIssues(variantDocs).filter((f) => f.flag_type === "near_duplicate");
const pairKey = (f) => [f.medicine_id, f.peer_medicine_id].sort().join(":");
const pairs = new Set(vFlags.map(pairKey));

assert(!pairs.has("p10:p30"), "detectIssues skips pack-count pair");
assert(!pairs.has("im:iv"), "detectIssues skips IM/IV pair");
assert(!pairs.has("v180:v330"), "detectIssues skips volume pair");
assert(!pairs.has("edt0:edt2"), "detectIssues skips numbered EDT pair");
assert(!pairs.has("sd25:sd50"), "detectIssues skips strength_dose pair");
assert(!pairs.has("ldA:ldK"), "detectIssues skips label_descriptor pair");
assert(!pairs.has("dfC:dfG"), "detectIssues skips dosage_form pair");
assert(pairs.has("av1:av2"), "detectIssues still flags AVASTIN/AVASTING");

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
