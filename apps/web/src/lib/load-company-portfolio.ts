/**
 * Company portfolio loader for the representative account UI.
 * Med-Care: is_medcare_toll. Others: Appwrite manufacturer search + static fallback.
 * Dual labels (SMARTEC > SOULPHARMA) match both companies via productBelongsToCompany.
 */

import {
  isMedCareCompany,
  normalizeCompanySlug,
  productBelongsToCompany,
  readScopedPortfolioFromLocalStorage,
} from "@/lib/company-portfolio-scope";
import { fetchMedicinesPage } from "@/lib/medicines-appwrite-page";

export type PortfolioMedicine = {
  canonical_id: number;
  name_en: string;
  name_ar: string;
  scientific_name: string;
  manufacturer: string;
  drug_class: string;
  route: string;
  category: string;
  image_url: string;
  barcode: string;
  code: string;
  current_price_egp: number;
  line?: string;
  company_slug?: string;
  is_medcare_toll?: boolean;
  toll_manufacturer?: string | null;
};

export type LoadPortfolioArgs = {
  companySlug?: string | null;
  companyName?: string | null;
  userEmail?: string | null;
};

function mapAppwriteItem(item: {
  canonical_id?: number;
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  route?: string | null;
  category?: string | null;
  image_url?: string | null;
  barcode?: string | null;
  code?: string | null;
  current_price_egp?: number | null;
  is_medcare_toll?: boolean;
  toll_manufacturer?: string | null;
}): PortfolioMedicine {
  return {
    canonical_id: Number(item.canonical_id) || 0,
    name_en: item.name_en || "",
    name_ar: item.name_ar || "",
    scientific_name: item.scientific_name || "",
    manufacturer: item.manufacturer || "",
    drug_class: item.drug_class || "",
    route: item.route || "",
    category: item.category || "",
    image_url: item.image_url || "",
    barcode: item.barcode || "",
    code: item.code || "",
    current_price_egp: Number(item.current_price_egp) || 0,
    is_medcare_toll: Boolean(item.is_medcare_toll),
    toll_manufacturer: item.toll_manufacturer || null,
  };
}

/** Search terms used to pull candidate rows from Appwrite for a company. */
export function manufacturerSearchTerms(
  slug: string,
  name: string,
): string[] {
  const terms: string[] = [];
  const push = (t: string) => {
    const v = t.trim();
    if (v && !terms.some((x) => x.toLowerCase() === v.toLowerCase())) terms.push(v);
  };
  if (name) push(name);
  if (slug) push(slug.replace(/-/g, " "));

  const s = `${slug} ${name}`.toLowerCase();
  if (s.includes("soul")) {
    push("SOULPHARMA");
    push("Soul Pharma");
    push("SoulPharma");
    push("SOUL PHARMA");
  }
  if (s.includes("smartec")) {
    push("SMARTEC");
    push("Smartec");
  }
  if (s.includes("pharco")) {
    push("Pharco");
    push("PHARCO");
  }
  if (s.includes("eva")) {
    push("EVA");
    push("Eva Pharma");
  }
  return terms.slice(0, 8);
}

/** Page Appwrite via text search on manufacturer-related terms, then scope-filter. */
export async function fetchCompanyPortfolioFromAppwrite(
  companySlug: string,
  companyName: string,
  max = 500,
): Promise<PortfolioMedicine[]> {
  const collected: PortfolioMedicine[] = [];
  const seen = new Set<number>();
  const terms = manufacturerSearchTerms(companySlug, companyName);

  for (const term of terms) {
    if (collected.length >= max) break;
    try {
      let cursor: string | null = null;
      for (let page = 0; page < 10 && collected.length < max; page++) {
        const result = await fetchMedicinesPage({
          limit: 100,
          cursorAfter: cursor,
          filters: { query: term },
        });
        for (const item of result.items || []) {
          const row = mapAppwriteItem(item);
          if (!row.canonical_id || seen.has(row.canonical_id)) continue;
          if (!productBelongsToCompany(row, companySlug, companyName)) continue;
          seen.add(row.canonical_id);
          collected.push(row);
        }
        if (!result.hasMore || !result.nextCursor) break;
        cursor = result.nextCursor;
      }
    } catch {
      /* next term */
    }
  }

  return collected;
}

/** Page through Appwrite medCareOnly until exhausted or max reached. */
export async function fetchMedCarePortfolioFromAppwrite(
  max = 800,
): Promise<PortfolioMedicine[]> {
  const collected: PortfolioMedicine[] = [];
  const seen = new Set<number>();
  let cursor: string | null = null;

  for (let page = 0; page < 30 && collected.length < max; page++) {
    const result = await fetchMedicinesPage({
      limit: 100,
      cursorAfter: cursor,
      filters: { medCareOnly: true },
    });
    for (const item of result.items || []) {
      const row = mapAppwriteItem(item);
      if (!row.canonical_id || seen.has(row.canonical_id)) continue;
      seen.add(row.canonical_id);
      collected.push(row);
    }
    if (!result.hasMore || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  if (collected.length < 50) {
    for (const term of ["Med-Care", "Med Care", "Medcare"]) {
      try {
        const result = await fetchMedicinesPage({
          limit: 100,
          filters: { query: term },
        });
        for (const item of result.items || []) {
          const row = mapAppwriteItem(item);
          if (!row.canonical_id || seen.has(row.canonical_id)) continue;
          const blob = `${row.manufacturer} ${row.toll_manufacturer || ""}`.toLowerCase();
          if (!blob.includes("med") || !blob.includes("care")) continue;
          seen.add(row.canonical_id);
          collected.push(row);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return collected;
}

/** Static JSON fallback for any company (limited slice). */
async function fetchFromStaticDataset(
  companySlug: string,
  companyName: string,
): Promise<PortfolioMedicine[]> {
  try {
    const res = await fetch("/data/egyptian-medicines-dataset.json");
    if (!res.ok) return [];
    const dataset = await res.json();
    const list = Array.isArray(dataset?.medicines) ? dataset.medicines : [];
    return list
      .filter((m: Record<string, unknown>) => {
        const product = {
          manufacturer: String(m.raw_manufacturer || m.manufacturer || ""),
          raw_manufacturer: String(m.raw_manufacturer || ""),
          trademark_owner: String(m.trademark_owner || ""),
          toll_manufacturer: String(m.toll_manufacturer || ""),
          company_slug: String(m.company_slug || ""),
          is_medcare_toll: Boolean(m.is_medcare_toll),
        };
        return productBelongsToCompany(product, companySlug, companyName);
      })
      .map((m: Record<string, unknown>) =>
        mapAppwriteItem({
          canonical_id: Number(m.canonical_id) || 0,
          name_en: String(m.name_en || ""),
          name_ar: String(m.name_ar || ""),
          scientific_name: String(m.scientific_name || ""),
          manufacturer: String(m.raw_manufacturer || m.manufacturer || companyName),
          drug_class: String(m.drug_class || ""),
          route: String(m.route || ""),
          category: String(m.category || ""),
          image_url: String(m.image_url || ""),
          barcode: String(m.barcode || ""),
          code: String(m.code || ""),
          current_price_egp: Number(m.current_price_egp) || 0,
          is_medcare_toll: Boolean(m.is_medcare_toll),
          toll_manufacturer: String(m.toll_manufacturer || "") || null,
        }),
      )
      .filter((p: PortfolioMedicine) => p.canonical_id > 0);
  } catch {
    return [];
  }
}

function resolveCompanyFromEmail(email: string): { name: string; slug: string } | null {
  const e = email.toLowerCase();
  if (e.includes("soulpharma") || e.includes("soul-pharma") || e.includes("soulpharma")) {
    return { name: "Soul Pharma", slug: "soul-pharma" };
  }
  if (e.includes("smartec")) return { name: "Smartec", slug: "smartec" };
  if (e.includes("medcare") || (e.includes("med") && e.includes("care"))) {
    return { name: "Med-Care", slug: "med-care" };
  }
  if (e.includes("pharco")) return { name: "Pharco", slug: "pharco" };
  if (e.includes("eva")) return { name: "Eva Pharma", slug: "eva-pharma" };
  return null;
}

/**
 * Load editable portfolio for a company representative.
 */
export async function loadCompanyPortfolio(
  args: LoadPortfolioArgs,
): Promise<{
  products: PortfolioMedicine[];
  resolvedSlug: string;
  resolvedName: string;
  source: "appwrite_medcare" | "appwrite_company" | "static" | "local" | "empty";
}> {
  const email = String(args.userEmail || "")
    .toLowerCase()
    .trim();
  let name = String(args.companyName || "").trim();
  let slug = normalizeCompanySlug(args.companySlug || name);

  const fromEmail = resolveCompanyFromEmail(email);
  if (fromEmail) {
    if (!name) name = fromEmail.name;
    if (!slug || slug === "company" || slug === "pharma") slug = fromEmail.slug;
  }

  if (!slug && name) slug = normalizeCompanySlug(name);
  if (!name && slug) name = slug.replace(/-/g, " ");

  // soulpharmasite@gmail.com → Soul Pharma even if profile slug missing
  if (email.includes("soul") && (!slug || slug === "company")) {
    name = "Soul Pharma";
    slug = "soul-pharma";
  }

  const medCare = isMedCareCompany(slug, name);

  let products: PortfolioMedicine[] = [];
  let source: "appwrite_medcare" | "appwrite_company" | "static" | "local" | "empty" =
    "empty";

  if (medCare) {
    products = await fetchMedCarePortfolioFromAppwrite(800);
    if (products.length) source = "appwrite_medcare";
  } else if (slug) {
    products = await fetchCompanyPortfolioFromAppwrite(slug, name, 500);
    if (products.length) source = "appwrite_company";
  }

  if (!products.length && slug) {
    products = await fetchFromStaticDataset(slug, name);
    if (products.length) source = "static";
  }

  if (slug) {
    const custom = readScopedPortfolioFromLocalStorage(slug, name);
    const seen = new Set(products.map((p) => p.canonical_id));
    for (const item of custom) {
      const cid = Number(item.canonical_id);
      if (!cid) continue;
      const mapped = mapAppwriteItem(item as PortfolioMedicine);
      const idx = products.findIndex((p) => p.canonical_id === cid);
      if (idx >= 0) products[idx] = { ...products[idx], ...mapped };
      else if (!seen.has(cid)) {
        seen.add(cid);
        products.unshift(mapped);
      }
    }
    products = products.filter(
      (p) =>
        productBelongsToCompany(p, slug, name) ||
        normalizeCompanySlug(p.company_slug) === slug ||
        (medCare &&
          (p.is_medcare_toll ||
            productBelongsToCompany(p, "med-care", "Med-Care"))),
    );
    if (products.length && source === "empty") source = "local";
  }

  return {
    products,
    resolvedSlug: slug || "company",
    resolvedName: name || slug || "Company",
    source,
  };
}
