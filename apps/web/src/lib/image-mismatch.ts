/**
 * Detect likely product-image mismatches in the encyclopedia.
 * Heuristic only — not computer vision. Flags candidates for human review
 * or automatic clear of low-trust stock photos.
 */

export type ImageMismatchSeverity = "high" | "medium" | "low" | "ok";

export type ImageMismatchReason =
  | "missing_image"
  | "generic_stock_host"
  | "placeholder_pattern"
  | "shared_stock_url"
  | "name_tokens_absent_from_url"
  | "form_vs_image_keyword_conflict"
  | "low_authenticity_score"
  | "low_match_score"
  | "unverified_bulk_image";

export type ProductImageFields = {
  canonical_id?: number | string | null;
  name_en?: string | null;
  name_ar?: string | null;
  dosage_form?: string | null;
  route?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  image_url?: string | null;
  image_source_url?: string | null;
  image_source_domain?: string | null;
  image_source_kind?: string | null;
  image_authenticity_score?: number | null;
  image_match_score?: number | null;
  image_is_verified?: boolean | null;
  has_company_verified_source?: boolean | null;
};

export type ImageMismatchResult = {
  severity: ImageMismatchSeverity;
  reasons: ImageMismatchReason[];
  details: string[];
  /** Safe to auto-clear image_url in cleanup jobs when true */
  suggest_clear_image: boolean;
};

const GENERIC_HOSTS = [
  "unsplash.com",
  "images.unsplash.com",
  "pexels.com",
  "images.pexels.com",
  "pixabay.com",
  "placeholder.com",
  "via.placeholder.com",
  "placehold.co",
  "placekitten.com",
  "loremflickr.com",
  "picsum.photos",
  "dummyimage.com",
  "cdn.shopify.com/s/files/1/0533/2089", // common theme dummy
];

const PLACEHOLDER_RE =
  /placeholder|no[_-]?image|default[_-]?med|stock[_-]?photo|generic[_-]?pill|sample[_-]?pack/i;

const FORM_KEYWORDS: Record<string, RegExp> = {
  sachet: /\b(sachet|powder|granule)\b/i,
  syrup: /\b(syrup|suspension|oral\s*sol)/i,
  cream: /\b(cream|ointment|gel|lotion|topical)\b/i,
  spray: /\b(spray|aerosol|inhal)\b/i,
  drop: /\b(drop|eye\s*drop|ear\s*drop)\b/i,
  injection: /\b(inject|ampoule|ampule|vial|syringe)\b/i,
};

const PILL_IMAGE_RE =
  /\b(pill|tablet|capsule|blister|pharma[_-]?stock|medicine[_-]?bottle)\b/i;

function tokensFromName(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        !["advance", "plus", "forte", "extra", "egypt", "pharma", "medical"].includes(
          t,
        ),
    );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Score one product. Pass `sharedUrlCounts` from a pre-pass over the catalog
 * (url → number of products using it) to detect shared stock photos.
 */
export function detectImageMismatch(
  product: ProductImageFields,
  sharedUrlCounts?: Map<string, number>,
  options?: { sharedUrlThreshold?: number },
): ImageMismatchResult {
  const reasons: ImageMismatchReason[] = [];
  const details: string[] = [];
  const threshold = options?.sharedUrlThreshold ?? 8;

  const url = String(product.image_url || "").trim();
  if (!url) {
    return {
      severity: "low",
      reasons: ["missing_image"],
      details: ["No image_url"],
      suggest_clear_image: false,
    };
  }

  if (product.image_is_verified || product.has_company_verified_source) {
    // Still flag extreme conflicts, but default trust verified sources
    if (
      product.image_match_score != null &&
      product.image_match_score < 30
    ) {
      reasons.push("low_match_score");
      details.push(`verified but image_match_score=${product.image_match_score}`);
    }
  }

  const host = hostOf(url);
  const blob = `${url} ${product.image_source_url || ""} ${product.image_source_domain || ""} ${product.image_source_kind || ""}`;

  if (GENERIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    reasons.push("generic_stock_host");
    details.push(`host=${host}`);
  }

  if (PLACEHOLDER_RE.test(blob)) {
    reasons.push("placeholder_pattern");
    details.push("URL/source matches placeholder pattern");
  }

  const shared = sharedUrlCounts?.get(url) ?? 0;
  if (shared >= threshold) {
    reasons.push("shared_stock_url");
    details.push(`same image_url used by ${shared} products`);
  }

  const nameTokens = tokensFromName(product.name_en || "");
  const urlLower = url.toLowerCase();
  if (nameTokens.length >= 1) {
    const hit = nameTokens.some((t) => urlLower.includes(t));
    if (!hit && nameTokens.length >= 2) {
      reasons.push("name_tokens_absent_from_url");
      details.push(
        `none of [${nameTokens.slice(0, 5).join(", ")}] appear in image URL`,
      );
    }
  }

  const formBlob = `${product.dosage_form || ""} ${product.route || ""} ${product.name_en || ""} ${product.category || ""}`;
  for (const [form, re] of Object.entries(FORM_KEYWORDS)) {
    if (re.test(formBlob) && PILL_IMAGE_RE.test(blob) && form !== "injection") {
      // sachet/cream/syrup product but image URL suggests pills/blister
      if (form === "sachet" || form === "cream" || form === "syrup" || form === "spray") {
        reasons.push("form_vs_image_keyword_conflict");
        details.push(`product looks like ${form} but image keywords suggest pills/blister`);
        break;
      }
    }
  }
  // ACTI-COLLA style: name contains SACHET but stock pill photo
  if (/\bsachet/i.test(product.name_en || "") && PILL_IMAGE_RE.test(blob)) {
    if (!reasons.includes("form_vs_image_keyword_conflict")) {
      reasons.push("form_vs_image_keyword_conflict");
      details.push("name contains SACHET but image suggests pills");
    }
  }

  if (
    product.image_authenticity_score != null &&
    product.image_authenticity_score < 40
  ) {
    reasons.push("low_authenticity_score");
    details.push(`image_authenticity_score=${product.image_authenticity_score}`);
  }
  if (product.image_match_score != null && product.image_match_score < 40) {
    reasons.push("low_match_score");
    details.push(`image_match_score=${product.image_match_score}`);
  }

  const kind = String(product.image_source_kind || "").toLowerCase();
  if (
    kind &&
    /bulk|scrape|unknown|stock|import/.test(kind) &&
    !product.image_is_verified
  ) {
    reasons.push("unverified_bulk_image");
    details.push(`image_source_kind=${product.image_source_kind}`);
  }

  const severity = severityFromReasons(reasons);
  const suggest_clear_image =
    severity === "high" ||
    reasons.includes("generic_stock_host") ||
    reasons.includes("placeholder_pattern") ||
    (reasons.includes("shared_stock_url") && shared >= threshold * 2);

  if (reasons.length === 0) {
    return {
      severity: "ok",
      reasons: [],
      details: [],
      suggest_clear_image: false,
    };
  }

  return { severity, reasons, details, suggest_clear_image };
}

function severityFromReasons(reasons: ImageMismatchReason[]): ImageMismatchSeverity {
  if (
    reasons.includes("generic_stock_host") ||
    reasons.includes("placeholder_pattern") ||
    reasons.includes("form_vs_image_keyword_conflict") ||
    reasons.includes("shared_stock_url")
  ) {
    return "high";
  }
  if (
    reasons.includes("name_tokens_absent_from_url") ||
    reasons.includes("low_authenticity_score") ||
    reasons.includes("low_match_score")
  ) {
    return "medium";
  }
  if (reasons.includes("missing_image") || reasons.includes("unverified_bulk_image")) {
    return "low";
  }
  return "medium";
}

/** First pass: count how many products share each image_url. */
export function buildSharedImageUrlCounts(
  products: ProductImageFields[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const url = String(p.image_url || "").trim();
    if (!url) continue;
    counts.set(url, (counts.get(url) || 0) + 1);
  }
  return counts;
}

export function scanCatalogForImageMismatches(
  products: ProductImageFields[],
  options?: { sharedUrlThreshold?: number; minSeverity?: ImageMismatchSeverity },
): Array<{
  product: ProductImageFields;
  result: ImageMismatchResult;
}> {
  const shared = buildSharedImageUrlCounts(products);
  const min = options?.minSeverity || "low";
  const rank: Record<ImageMismatchSeverity, number> = {
    ok: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  const out: Array<{ product: ProductImageFields; result: ImageMismatchResult }> =
    [];

  for (const product of products) {
    const result = detectImageMismatch(product, shared, options);
    if (result.severity === "ok") continue;
    if (rank[result.severity] < rank[min]) continue;
    out.push({ product, result });
  }

  out.sort(
    (a, b) => rank[b.result.severity] - rank[a.result.severity],
  );
  return out;
}
