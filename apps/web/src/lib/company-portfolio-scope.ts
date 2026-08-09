/**
 * Scope company portfolio products to a single verified company slug.
 * Prevents Med-Care (or any) reps from seeing/editing Eva / Soul catalogs.
 *
 * Med-Care special case: most products are toll-manufactured for other brands,
 * so membership is is_medcare_toll / toll_manufacturer — not manufacturer alone.
 */

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

/** Normalize slug for comparison. */
export function normalizeCompanySlug(slug: string | null | undefined): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** True when company is Med-Care (toll manufacturing site). */
export function isMedCareCompany(
  companySlug?: string | null,
  companyName?: string | null,
): boolean {
  const slug = normalizeCompanySlug(companySlug);
  const name = normalizeCompanyName(String(companyName || ""));
  if (slug === "med-care" || slug === "medcare" || slug === "med-care-factory") {
    return true;
  }
  return /med\s*care/.test(name) || name.includes("medcare");
}

/**
 * True only when manufacturer / trademark / toll clearly belongs to this company.
 * Uses exact normalized equality or whole-token containment of the company key
 * (min length 4) — never broad substring matches like "a" or "pharma".
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
  const slug = normalizeCompanySlug(companySlug);
  if (!slug || slug === "pharma" || slug === "company") return false;

  // Med-Care portfolio: toll site — flag or toll_manufacturer field
  if (isMedCareCompany(companySlug, companyName)) {
    if (product.is_medcare_toll === true) return true;
    const toll = normalizeCompanyName(String(product.toll_manufacturer || ""));
    if (toll.includes("medcare") || /med\s*care/.test(toll)) return true;
    const mfg = normalizeCompanyName(
      String(product.manufacturer || product.raw_manufacturer || ""),
    );
    if (mfg.includes("medcare") || /med\s*care/.test(mfg)) return true;
  }

  const productSlug = normalizeCompanySlug(product.company_slug);
  if (productSlug && productSlug === slug) return true;

  const targetKeys = new Set<string>();
  targetKeys.add(normalizeCompanyName(slug.replace(/-/g, " ")));
  if (companyName) targetKeys.add(normalizeCompanyName(companyName));
  // common variants
  targetKeys.add(normalizeCompanyName(slug));
  for (const k of [...targetKeys]) {
    if (k.endsWith("pharma")) targetKeys.add(k.replace(/pharma$/, ""));
  }
  targetKeys.delete("");
  targetKeys.delete("pharma");

  const fields = [
    product.manufacturer,
    product.raw_manufacturer,
    product.trademark_owner,
    product.toll_manufacturer,
    product.company_name,
  ]
    .map((x) => normalizeCompanyName(String(x || "")))
    .filter(Boolean);

  for (const field of fields) {
    for (const key of targetKeys) {
      if (key.length < 4) continue;
      if (field === key) return true;
      // token boundary style: field is "evapharmaegypt" or key is contained as whole company id
      if (field.startsWith(key) || field.endsWith(key)) {
        if (field.length <= key.length + 6) return true;
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
    for (const key of [scopedKey, scopedAlt]) {
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

    // Global bag — only keep rows that clearly belong to this company
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
