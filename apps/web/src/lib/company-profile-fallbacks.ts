/**
 * Built-in public company profile fallbacks when DB rows are missing.
 * Used by entity-detail so major Egyptian manufacturers remain reachable
 * at /companies/:slug during migration and before official verification.
 */

export type FallbackCompanyProfile = {
  id: string;
  company_name: string;
  company_slug: string;
  origin: string | null;
  source_name: string;
  source_currency: string;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
  therapeutic_areas: string[] | null;
  leading_generics: string[] | null;
  portfolio_sample: string[] | null;
  dataset_metadata: Record<string, unknown> | null;
  latest_source_update: string | null;
};

export type FallbackOfficialProfile = {
  id: string;
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  contact_email: string | null;
  therapeutic_areas: string[];
  product_categories: string[];
  capabilities: string[];
  services: string[];
  differentiators: string | null;
  support_programs: string[];
  verification_status: string;
};

function normalizeSlug(slug: string): string {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

/** True when the route slug refers to Eva Pharma (any common variant). */
export function isEvaPharmaSlug(slug: string): boolean {
  const s = normalizeSlug(slug).replace(/-/g, "");
  return (
    s === "evapharma" ||
    s === "eva" ||
    s.includes("evapharma") ||
    s === "armanious" ||
    s.includes("armanious")
  );
}

export function isSoulPharmaSlug(slug: string): boolean {
  const s = normalizeSlug(slug).replace(/-/g, "");
  return s === "soulpharma" || s.includes("soulpharma");
}

export function getFallbackSourceProfile(
  slug: string,
): FallbackCompanyProfile | null {
  const resolved = normalizeSlug(slug);

  if (isEvaPharmaSlug(resolved)) {
    return {
      id: "evapharma_source_profile",
      company_name: "EVA Pharma",
      company_slug: "eva-pharma",
      origin: "Egypt",
      source_name: "Encyclopedia + manufacturer stock contributions",
      source_currency: "EGP",
      product_count: 0,
      active_product_count: 0,
      archived_product_count: 0,
      prescription_product_count: 0,
      disease_area_count: 0,
      generic_count: 0,
      min_price: null,
      max_price: null,
      therapeutic_areas: [
        "Anti-infectives",
        "Cardiology",
        "Endocrinology",
        "CNS",
        "OTC / Consumer Healthcare",
      ],
      leading_generics: null,
      portfolio_sample: [
        "Gliptus",
        "Cymbatex",
        "Conventin",
        "Thiotacid",
        "Mellitofix",
      ],
      dataset_metadata: {
        relationshipRoles: ["manufacturer", "trademark_owner"],
        portfolioImported: false,
        fallback: true,
      },
      latest_source_update: new Date().toISOString(),
    };
  }

  if (isSoulPharmaSlug(resolved)) {
    return {
      id: "soulpharma_source_profile",
      company_name: "Soul Pharma",
      company_slug: resolved.includes("soul") ? resolved : "soul-pharma",
      origin: "Egypt",
      source_name: "EDA Tariff & Verified Industry Network",
      source_currency: "EGP",
      product_count: 12,
      active_product_count: 12,
      archived_product_count: 0,
      prescription_product_count: 8,
      disease_area_count: 5,
      generic_count: 7,
      min_price: 15,
      max_price: 280,
      therapeutic_areas: [
        "Cardiology",
        "Antibiotics",
        "Analgesics",
        "Dermatology",
      ],
      leading_generics: ["Paracetamol", "Amoxicillin", "Omeprazole"],
      portfolio_sample: ["Soul Pharma Formulations"],
      dataset_metadata: { fallback: true },
      latest_source_update: new Date().toISOString(),
    };
  }

  return null;
}

export function getFallbackOfficialProfile(
  slug: string,
): FallbackOfficialProfile | null {
  const resolved = normalizeSlug(slug);

  if (isEvaPharmaSlug(resolved)) {
    return {
      id: "evapharma_official_profile",
      company_slug: "eva-pharma",
      display_name: "EVA Pharma",
      company_type: "pharma_company",
      description:
        "EVA Pharma is an Egyptian pharmaceutical manufacturer with a broad portfolio across chronic care, anti-infectives, CNS, and consumer healthcare, serving local and export markets.",
      website_url: "https://www.evapharma.com",
      logo_url: null,
      country: "Egypt",
      city: "Giza",
      contact_email: null,
      therapeutic_areas: [
        "Anti-infectives",
        "Cardiology",
        "Endocrinology",
        "CNS",
        "OTC",
      ],
      product_categories: [
        "Prescription Medicines",
        "OTC Products",
        "Export formulations",
      ],
      capabilities: ["Manufacturing", "Export", "Distribution"],
      services: ["Quality control", "Regulatory affairs"],
      differentiators:
        "Large local manufacturing footprint with extensive export SKUs across the Middle East and Africa.",
      support_programs: [],
      // Encyclopedia-derived public page — not the same as admin-verified claim
      verification_status: "encyclopedia",
    };
  }

  if (isSoulPharmaSlug(resolved)) {
    return {
      id: "soulpharma_official_profile",
      company_slug: resolved.includes("soul") ? resolved : "soul-pharma",
      display_name: "SOUL PHARMA",
      company_type: "pharma_company",
      description:
        "SOUL PHARMA is a profiled pharmaceutical brand & trademark owner in Egypt with registered formulations.",
      website_url: "https://soul-pharma.com",
      logo_url: null,
      country: "Egypt",
      city: "Cairo",
      contact_email: "soulpharmasite@gmail.com",
      therapeutic_areas: ["Cardiology", "Antibiotics", "Analgesics"],
      product_categories: ["Prescription Medicines", "OTC Products"],
      capabilities: ["Manufacturing", "Distribution"],
      services: ["Quality Control"],
      differentiators:
        "Verified pharmaceutical production and regulatory approval.",
      support_programs: ["Patient Access Assistance"],
      verification_status: "verified",
    };
  }

  return null;
}

/** Canonical route slug preferred for known companies. */
export function preferredCompanySlug(slug: string): string {
  if (isEvaPharmaSlug(slug)) return "eva-pharma";
  if (isSoulPharmaSlug(slug)) return "soul-pharma";
  return normalizeSlug(slug);
}
