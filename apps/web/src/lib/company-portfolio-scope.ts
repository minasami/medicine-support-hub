/**
 * Scope company portfolio products to a single verified company slug.
 * Prevents Med-Care (or any) reps from seeing/editing unrelated catalogs.
 *
 * Med-Care special case: toll site → is_medcare_toll / toll_manufacturer.
 * Dual labels like "SMARTEC > SOULPHARMA" belong to BOTH companies.
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

/** Split manufacturer strings that encode multiple parties. */
export function splitManufacturerParties(raw: string | null | undefined): string[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  // "SMARTEC > SOULPHARMA", "A / B", "A (B)", "A | B"
  return s
    .split(/\s*[>\/|•·]+\s*|\s*[()]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

function companyTargetKeys(
  companySlug: string,
  companyName?: string | null,
): Set<string> {
  const slug = normalizeCompanySlug(companySlug);
  const targetKeys = new Set<string>();
  targetKeys.add(normalizeCompanyName(slug.replace(/-/g, " ")));
  if (companyName) targetKeys.add(normalizeCompanyName(companyName));
  targetKeys.add(normalizeCompanyName(slug));
  // soul-pharma / soulpharma variants
  if (slug.includes("soul")) {
    targetKeys.add("soulpharma");
    targetKeys.add("soul");
    targetKeys.add(normalizeCompanyName("Soul Pharma"));
    targetKeys.add(normalizeCompanyName("SOULPHARMA"));
  }
  if (slug.includes("smartec")) {
    targetKeys.add("smartec");
    targetKeys.add(normalizeCompanyName("Smartec"));
  }
  for (const k of [...targetKeys]) {
    if (k.endsWith("pharma")) targetKeys.add(k.replace(/pharma$/, ""));
    if (k.length >= 6) targetKeys.add(k);
  }
  targetKeys.delete("");
  targetKeys.delete("pharma");
  targetKeys.delete("company");
  return targetKeys;
}

function fieldMatchesKey(fieldNorm: string, key: string): boolean {
  if (!fieldNorm || !key || key.length < 3) return false;
  if (fieldNorm === key) return true;
  // whole-party containment (after party split, fields are short)
  if (fieldNorm.includes(key) && key.length >= 4) return true;
  if (key.includes(fieldNorm) && fieldNorm.length >= 4) return true;
  if (fieldNorm.startsWith(key) || fieldNorm.endsWith(key)) {
    if (fieldNorm.length <= key.length + 10) return true;
  }
  return false;
}

/**
 * True when manufacturer / trademark / toll clearly belongs to this company.
 * Dual labels ("SMARTEC > SOULPHARMA") match BOTH Smartec and Soul Pharma.
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

  const targetKeys = companyTargetKeys(slug, companyName);

  const rawFields = [
    product.manufacturer,
    product.raw_manufacturer,
    product.trademark_owner,
    product.toll_manufacturer,
    product.company_name,
  ].filter(Boolean) as string[];

  // Expand dual/multi party manufacturer strings into separate parties
  const parties: string[] = [];
  for (const raw of rawFields) {
    const parts = splitManufacturerParties(raw);
    if (parts.length > 1) {
      parties.push(...parts);
    }
    parties.push(raw);
  }

  for (const party of parties) {
    const field = normalizeCompanyName(party);
    if (!field) continue;
    for (const key of targetKeys) {
      if (fieldMatchesKey(field, key)) return true;
    }
  }

  // Combined blob fallback (e.g. smartecsoulpharma still contains soul)
  const blob = normalizeCompanyName(rawFields.join(" "));
  for (const key of targetKeys) {
    if (key.length >= 4 && blob.includes(key)) return true;
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
