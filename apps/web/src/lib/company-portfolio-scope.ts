/**
 * Scope company portfolio products to a single verified company slug.
 * Company name variants (Med-Care / Medcare / Med care) resolve via company-identity.
 * Dual labels like "SMARTEC > SOULPHARMA" belong to BOTH companies.
 */

import {
  companiesEquivalent,
  manufacturerIncludesCompany,
  resolveCompanyIdentity,
  resolveManufacturerParties,
} from "@/lib/company-identity";
import { normalizeCompanyName } from "@/lib/search-engine";

export type PortfolioProduct = {
  canonical_id: number;
  name_en: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  drug_class?: string;
  route?: string;
  category?: string;
  image_url?: string;
  barcode?: string;
  code?: string;
  current_price_egp?: number;
  line?: string;
  company_slug?: string;
  is_medcare_toll?: boolean;
  toll_manufacturer?: string | null;
};

/** Normalize slug for comparison (delegates to canonical when known). */
export function normalizeCompanySlug(slug: string | null | undefined): string {
  const resolved = resolveCompanyIdentity(String(slug || "").replace(/-/g, " "));
  if (resolved.known) return resolved.slug;
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** True when company is Med-Care (any spelling variant). */
export function isMedCareCompany(
  companySlug?: string | null,
  companyName?: string | null,
): boolean {
  const a = resolveCompanyIdentity(companySlug);
  const b = resolveCompanyIdentity(companyName);
  return a.id === "med-care" || b.id === "med-care";
}

/** Split manufacturer strings that encode multiple parties. */
export function splitManufacturerParties(raw: string | null | undefined): string[] {
  return resolveManufacturerParties(raw).map((p) => p.raw || p.displayName);
}

/**
 * True when manufacturer / trademark / toll clearly belongs to this company.
 * All orthography variants of the same company count as one.
 */
export function productBelongsToCompany(
  product: {
    manufacturer?: string | null;
    raw_manufacturer?: string | null;
    trademark_owner?: string | null;
    toll_manufacturer?: string | null;
    company_slug?: string | null;
    company_name?: string | null;
    is_medcare_toll?: boolean | null;
  },
  companySlug: string,
  companyName?: string | null,
): boolean {
  const target = resolveCompanyIdentity(companyName || companySlug);
  const targetAlt = resolveCompanyIdentity(companySlug);
  const targetId = target.known ? target.id : targetAlt.known ? targetAlt.id : "";
  const targetSlug = target.known ? target.slug : normalizeCompanySlug(companySlug);

  if (!targetSlug || targetSlug === "pharma" || targetSlug === "company") return false;

  // Med-Care portfolio: toll site flag or any Med-Care spelling on fields
  if (targetId === "med-care" || isMedCareCompany(companySlug, companyName)) {
    if (product.is_medcare_toll === true) return true;
    if (manufacturerIncludesCompany(product.toll_manufacturer, "Med-Care")) return true;
    if (manufacturerIncludesCompany(product.manufacturer, "Med-Care")) return true;
    if (manufacturerIncludesCompany(product.raw_manufacturer, "Med-Care")) return true;
  }

  const productSlug = normalizeCompanySlug(product.company_slug);
  if (productSlug && (productSlug === targetSlug || productSlug === target.id)) {
    return true;
  }

  const rawFields = [
    product.manufacturer,
    product.raw_manufacturer,
    product.trademark_owner,
    product.toll_manufacturer,
    product.company_name,
  ].filter(Boolean) as string[];

  for (const raw of rawFields) {
    // Dual-party manufacturer
    const parties = resolveManufacturerParties(raw);
    for (const party of parties) {
      if (targetId && party.id === targetId) return true;
      if (companiesEquivalent(party.displayName, companyName || companySlug)) return true;
      if (companiesEquivalent(party.raw, companySlug)) return true;
    }
    // Whole string equivalent
    if (companiesEquivalent(raw, companyName || companySlug)) return true;
    if (manufacturerIncludesCompany(raw, companyName || companySlug)) return true;
  }

  // Legacy normalized key fallback for unknown companies
  if (!target.known && !targetAlt.known) {
    const key = normalizeCompanyName(companyName || companySlug);
    if (key.length >= 4) {
      for (const raw of rawFields) {
        const field = normalizeCompanyName(raw);
        if (field === key || field.includes(key) || key.includes(field)) return true;
      }
    }
  }

  return false;
}

/** Keep only localStorage portfolio rows for this company slug. */
export function filterPortfolioUpdatesForCompany(
  items: PortfolioProduct[],
  companySlug: string,
  companyName?: string | null,
): PortfolioProduct[] {
  const slug = normalizeCompanySlug(companySlug);
  return (items || []).filter((item) => {
    if (item.company_slug && normalizeCompanySlug(item.company_slug) === slug) {
      return true;
    }
    return productBelongsToCompany(item, companySlug, companyName);
  });
}

/** Read company-scoped portfolio updates from localStorage. */
export function readScopedPortfolioFromLocalStorage(
  companySlug: string,
  companyName?: string | null,
): PortfolioProduct[] {
  if (typeof window === "undefined") return [];
  const slug = normalizeCompanySlug(companySlug);
  const out: PortfolioProduct[] = [];
  const seen = new Set<number>();

  try {
    const scopedKey = `company_portfolio_updates_${slug}`;
    const scopedAlt = `company_portfolio_updates_${companySlug}`;
    // Also read alias slug keys (medcare vs med-care)
    const identity = resolveCompanyIdentity(companyName || companySlug);
    const extraKeys = identity.known
      ? [
          `company_portfolio_updates_${identity.slug}`,
          `company_portfolio_updates_${identity.id}`,
          `company_portfolio_updates_medcare`,
        ]
      : [];

    for (const key of [scopedKey, scopedAlt, ...extraKeys]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (!item?.canonical_id) continue;
        const cid = Number(item.canonical_id);
        if (seen.has(cid)) continue;
        seen.add(cid);
        out.push({ ...item, company_slug: item.company_slug || slug });
      }
    }

    const globalRaw = localStorage.getItem("all_custom_medicine_updates");
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      const list = Array.isArray(parsed) ? parsed : [];
      for (const item of filterPortfolioUpdatesForCompany(
        list,
        companySlug,
        companyName,
      )) {
        const cid = Number(item.canonical_id);
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);
        out.push(item);
      }
    }
  } catch {
    /* ignore */
  }

  return out;
}
