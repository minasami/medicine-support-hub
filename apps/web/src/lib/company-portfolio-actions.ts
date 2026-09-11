/**
 * Client-side portfolio ownership actions for company reps.
 * Respects permissions: never deletes global catalog medicines.
 * Mutates company-scoped localStorage + optional provenance; relationship
 * table is refresh-derived / select-only for authenticated clients.
 */

import { normalizeCompanySlug } from "@/lib/company-portfolio-scope";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";

export type PortfolioOwnershipState = "claimed" | "confirmed" | "unclaimed";

export type PortfolioActionProduct = {
  canonical_id: number;
  name_en?: string;
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
  ownership_status?: PortfolioOwnershipState;
  ownership_updated_at?: string;
};

const UNCLAIMED_KEY = (slug: string) => `company_portfolio_unclaimed_${slug}`;
const CONFIRMED_KEY = (slug: string) => `company_portfolio_confirmed_${slug}`;

function readIdSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return new Set(list.map((n) => Number(n)).filter((n) => n > 0));
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

function portfolioStorageKey(slug: string) {
  return `company_portfolio_updates_${slug}`;
}

function readPortfolioList(slug: string): PortfolioActionProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(portfolioStorageKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePortfolioList(slug: string, list: PortfolioActionProduct[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(portfolioStorageKey(slug), JSON.stringify(list.slice(0, 5000)));
}

export function getPortfolioOwnershipMeta(companySlug: string): {
  unclaimed: Set<number>;
  confirmed: Set<number>;
} {
  const slug = normalizeCompanySlug(companySlug);
  return {
    unclaimed: readIdSet(UNCLAIMED_KEY(slug)),
    confirmed: readIdSet(CONFIRMED_KEY(slug)),
  };
}

export function applyOwnershipMeta<T extends PortfolioActionProduct>(
  products: T[],
  companySlug: string,
): T[] {
  const { unclaimed, confirmed } = getPortfolioOwnershipMeta(companySlug);
  return products
    .filter((p) => !unclaimed.has(Number(p.canonical_id)))
    .map((p) => {
      const cid = Number(p.canonical_id);
      const status: PortfolioOwnershipState = confirmed.has(cid)
        ? "confirmed"
        : p.ownership_status === "confirmed"
          ? "confirmed"
          : "claimed";
      return { ...p, ownership_status: status };
    });
}

export type OwnershipActor = {
  userId?: string | null;
  email?: string | null;
  companySlug: string;
  companyName?: string | null;
};

/** Confirm that a listed product belongs to this company portfolio. */
export function confirmPortfolioOwnership(
  product: PortfolioActionProduct,
  actor: OwnershipActor,
): PortfolioActionProduct {
  const slug = normalizeCompanySlug(actor.companySlug);
  const cid = Number(product.canonical_id);
  const confirmed = readIdSet(CONFIRMED_KEY(slug));
  confirmed.add(cid);
  writeIdSet(CONFIRMED_KEY(slug), confirmed);

  const unclaimed = readIdSet(UNCLAIMED_KEY(slug));
  if (unclaimed.delete(cid)) writeIdSet(UNCLAIMED_KEY(slug), unclaimed);

  const entry: PortfolioActionProduct = {
    ...product,
    company_slug: slug,
    ownership_status: "confirmed",
    ownership_updated_at: new Date().toISOString(),
  };

  const list = readPortfolioList(slug);
  const idx = list.findIndex((p) => Number(p.canonical_id) === cid);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  writePortfolioList(slug, list);

  try {
    recordCompanyProductProvenance({
      canonicalId: cid,
      isUpdate: true,
      companyName: actor.companyName || undefined,
      companySlug: slug,
      actorUserId: actor.userId || undefined,
      actorEmail: actor.email || undefined,
      productPayload: entry as Record<string, unknown>,
      notes: "CEO confirmed portfolio ownership",
    });
  } catch {
    /* best-effort */
  }

  return entry;
}

/**
 * Remove / unclaim from THIS company's portfolio only.
 * Does not delete the global catalog medicine.
 */
export function unclaimPortfolioProduct(
  product: PortfolioActionProduct,
  actor: OwnershipActor,
): void {
  const slug = normalizeCompanySlug(actor.companySlug);
  const cid = Number(product.canonical_id);

  const unclaimed = readIdSet(UNCLAIMED_KEY(slug));
  unclaimed.add(cid);
  writeIdSet(UNCLAIMED_KEY(slug), unclaimed);

  const confirmed = readIdSet(CONFIRMED_KEY(slug));
  if (confirmed.delete(cid)) writeIdSet(CONFIRMED_KEY(slug), confirmed);

  const list = readPortfolioList(slug).filter((p) => Number(p.canonical_id) !== cid);
  writePortfolioList(slug, list);

  try {
    recordCompanyProductProvenance({
      canonicalId: cid,
      isUpdate: true,
      companyName: actor.companyName || undefined,
      companySlug: slug,
      actorUserId: actor.userId || undefined,
      actorEmail: actor.email || undefined,
      productPayload: {
        canonical_id: cid,
        company_slug: slug,
        ownership_status: "unclaimed",
      },
      notes: "CEO removed/unclaimed product from company portfolio (catalog intact)",
    });
  } catch {
    /* best-effort */
  }
}

/** Claim a catalog product into this company's portfolio. */
export function claimCatalogProductIntoPortfolio(
  product: PortfolioActionProduct,
  actor: OwnershipActor,
): PortfolioActionProduct {
  const slug = normalizeCompanySlug(actor.companySlug);
  const cid = Number(product.canonical_id);

  const unclaimed = readIdSet(UNCLAIMED_KEY(slug));
  if (unclaimed.delete(cid)) writeIdSet(UNCLAIMED_KEY(slug), unclaimed);

  const entry: PortfolioActionProduct = {
    ...product,
    manufacturer: product.manufacturer || actor.companyName || "",
    company_slug: slug,
    ownership_status: "claimed",
    ownership_updated_at: new Date().toISOString(),
  };

  const list = readPortfolioList(slug);
  const idx = list.findIndex((p) => Number(p.canonical_id) === cid);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  writePortfolioList(slug, list);

  try {
    recordCompanyProductProvenance({
      canonicalId: cid,
      isUpdate: true,
      companyName: actor.companyName || undefined,
      companySlug: slug,
      actorUserId: actor.userId || undefined,
      actorEmail: actor.email || undefined,
      productPayload: entry as Record<string, unknown>,
      notes: "CEO claimed catalog product into company portfolio",
    });
  } catch {
    /* best-effort */
  }

  return entry;
}
