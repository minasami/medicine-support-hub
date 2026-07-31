/**
 * Product type classification for the encyclopedia.
 * Distinguishes true medicines from cosmetics, fragrances, devices, nutrition, etc.
 */

export const PRODUCT_TYPES = [
  "medicine",
  "cosmetic",
  "cosmeceutical",
  "fragrance",
  "personal_care",
  "nutrition",
  "medical_device",
  "baby_formula",
  "unknown",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export type ProductTypeSource =
  | "explicit"
  | "name_heuristic"
  | "category_heuristic"
  | "placeholder_heuristic"
  | "default_medicine";

export type ProductTypeResult = {
  product_type: ProductType;
  confidence: number;
  source: ProductTypeSource;
  reasons: string[];
};

/** Placeholder strings that must never be shown as real clinical attributes. */
export const PLACEHOLDER_VALUES = new Set(
  [
    "active ingredient",
    "therapeutic category",
    "therapeutic product",
    "general medicine",
    "general therapeutics",
    "official medicine",
    "pharmaceutical industry",
    "egyptian pharmaceutical industry",
    "medicine product",
    "n/a",
    "na",
    "null",
    "undefined",
    "-",
    "—",
    ".",
  ].map((s) => s.toLowerCase()),
);

export function isPlaceholderValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  return PLACEHOLDER_VALUES.has(s.toLowerCase());
}

export function cleanAttribute(value: unknown): string | null {
  if (isPlaceholderValue(value)) return null;
  return String(value).trim();
}

const FRAGRANCE_NAME_RE =
  /\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|eau\s*de\s*cologne|perfume|parfum|cologne|aftershave|after\s*shave)\b/i;

const COSMETIC_NAME_RE =
  /\b(cream|lotion|shampoo|conditioner|soap|gel\s*wash|face\s*wash|body\s*wash|moisturizer|moisturiser|sunscreen|lipstick|mascara|foundation|serum\s*skin|toner|cleanser|deodorant|antiperspirant|hair\s*oil|nail\s*polish)\b/i;

const PERSONAL_CARE_RE =
  /\b(intimate\s*wash|feminine\s*wash|mouthwash|toothpaste|toothbrush|sanitary|diaper|nappy)\b/i;

const NUTRITION_RE =
  /\b(multivitamin|vitamin\s*d|omega\s*3|protein\s*powder|dietary\s*supplement|food\s*supplement|infant\s*formula|baby\s*formula|milk\s*formula)\b/i;

const DEVICE_RE =
  /\b(syringe|nebulizer|nebuliser|glucometer|test\s*strip|catheter|bandage|gauze|thermometer|inhaler\s*device)\b/i;

const COSMETIC_CATEGORY_RE =
  /\b(cosmetic|cosmeceutical|fragrance|perfume|personal\s*care|skin\s*care|skincare|hair\s*care|dermatology\s*cosmetic)\b/i;

const MEDICINE_HINT_RE =
  /\b(mg|mcg|iu|tablet|capsule|ampoule|ampule|vial|syrup|suspension|inject|antibiotic|analgesic|antihypertensive|antidiabetic)\b/i;

export type ClassifiableProduct = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  drug_class?: string | null;
  route?: string | null;
  dosage_form?: string | null;
  product_type?: string | null;
};

export function classifyProductType(
  product: ClassifiableProduct,
): ProductTypeResult {
  const reasons: string[] = [];

  // Explicit field wins when valid
  const explicit = String(product.product_type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (PRODUCT_TYPES.includes(explicit as ProductType) && explicit !== "unknown") {
    return {
      product_type: explicit as ProductType,
      confidence: 1,
      source: "explicit",
      reasons: [`explicit product_type=${explicit}`],
    };
  }

  const name = `${product.name_en || ""} ${product.name_ar || ""}`;
  const categoryBlob = `${product.category || ""} ${product.drug_class || ""}`;

  if (FRAGRANCE_NAME_RE.test(name) || /\bfragrance\b/i.test(categoryBlob)) {
    reasons.push("name/category matches fragrance pattern");
    return {
      product_type: "fragrance",
      confidence: 0.95,
      source: "name_heuristic",
      reasons,
    };
  }

  if (COSMETIC_CATEGORY_RE.test(categoryBlob) && !MEDICINE_HINT_RE.test(name)) {
    reasons.push("category indicates cosmetic");
    return {
      product_type: "cosmetic",
      confidence: 0.85,
      source: "category_heuristic",
      reasons,
    };
  }

  if (COSMETIC_NAME_RE.test(name) && !MEDICINE_HINT_RE.test(name)) {
    reasons.push("name matches cosmetic pattern");
    return {
      product_type: "cosmetic",
      confidence: 0.8,
      source: "name_heuristic",
      reasons,
    };
  }

  if (PERSONAL_CARE_RE.test(name)) {
    reasons.push("name matches personal care");
    return {
      product_type: "personal_care",
      confidence: 0.85,
      source: "name_heuristic",
      reasons,
    };
  }

  if (NUTRITION_RE.test(name) || /baby\s*formula/i.test(categoryBlob)) {
    reasons.push("name/category matches nutrition");
    return {
      product_type: "nutrition",
      confidence: 0.8,
      source: "name_heuristic",
      reasons,
    };
  }

  if (DEVICE_RE.test(name)) {
    reasons.push("name matches medical device");
    return {
      product_type: "medical_device",
      confidence: 0.75,
      source: "name_heuristic",
      reasons,
    };
  }

  // Placeholder-heavy rows with no medicine strength hints → unknown (not verified medicine)
  const sci = product.scientific_name;
  const cls = product.drug_class;
  const cat = product.category;
  if (
    isPlaceholderValue(sci) &&
    (isPlaceholderValue(cls) || isPlaceholderValue(cat)) &&
    !MEDICINE_HINT_RE.test(name)
  ) {
    reasons.push("placeholder scientific_name/category without medicine hints");
    return {
      product_type: "unknown",
      confidence: 0.6,
      source: "placeholder_heuristic",
      reasons,
    };
  }

  reasons.push("default assume medicine");
  return {
    product_type: "medicine",
    confidence: 0.5,
    source: "default_medicine",
    reasons,
  };
}

/** UI: only show EDA Verified for true medicines with a verified flag. */
export function shouldShowEdaVerifiedBadge(product: {
  product_type?: string | null;
  has_verified_dataset?: boolean | null;
  name_en?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  drug_class?: string | null;
}): boolean {
  if (!product.has_verified_dataset) return false;
  const classified = classifyProductType(product);
  if (classified.product_type !== "medicine") return false;
  if (isPlaceholderValue(product.scientific_name)) return false;
  return true;
}

export function productTypeLabel(
  type: ProductType,
  t: (en: string, ar: string) => string,
): string {
  switch (type) {
    case "medicine":
      return t("Medicine", "دواء");
    case "cosmetic":
      return t("Cosmetic", "مستحضر تجميل");
    case "cosmeceutical":
      return t("Cosmeceutical", "تجميلي علاجي");
    case "fragrance":
      return t("Fragrance", "عطر");
    case "personal_care":
      return t("Personal care", "عناية شخصية");
    case "nutrition":
      return t("Nutrition / supplement", "تغذية / مكمل");
    case "medical_device":
      return t("Medical device", "جهاز طبي");
    case "baby_formula":
      return t("Baby formula", "لبن أطفال");
    default:
      return t("Unclassified product", "منتج غير مصنف");
  }
}

/** Suggested attribute cleanup when reclassifying non-medicines. */
export function suggestCleanupPatch(
  product: ClassifiableProduct & {
    has_verified_dataset?: boolean;
    route?: string | null;
  },
): Record<string, unknown> {
  const { product_type } = classifyProductType(product);
  const patch: Record<string, unknown> = {
    product_type,
  };

  if (isPlaceholderValue(product.scientific_name)) {
    patch.scientific_name = null;
  }
  if (isPlaceholderValue(product.drug_class)) {
    patch.drug_class = null;
  }
  if (isPlaceholderValue(product.category)) {
    patch.category =
      product_type === "fragrance"
        ? "Fragrance"
        : product_type === "cosmetic"
          ? "Cosmetic"
          : product_type === "personal_care"
            ? "Personal Care"
            : null;
  }

  if (product_type === "fragrance" || product_type === "cosmetic") {
    patch.has_verified_dataset = false;
    const route = String(product.route || "").toLowerCase();
    if (!route || route.includes("oral")) {
      patch.route = "Topical / External";
    }
    if (product_type === "fragrance") {
      patch.dosage_form = patch.dosage_form ?? "Spray / Bottle";
      patch.category = "Fragrance";
      patch.drug_class = null;
    }
  }

  if (product_type !== "medicine") {
    patch.has_verified_dataset = false;
  }

  return patch;
}
