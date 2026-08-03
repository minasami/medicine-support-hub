/**
 * Safe public links into the encyclopedia monograph.
 *
 * ID spaces:
 *   Static dataset canonical_id ≠ Appwrite live canonical_id.
 *   Synthetic static ranges (90000–99999, baby formulas, etc.) MUST never
 *   use bare /catalog/{id} — those numbers are occupied by unrelated live rows.
 *
 * Resolution order for product URLs:
 * 1. Synthetic static id + name → /catalog/n~{name}
 * 2. forceCatalogId + live_db (non-synthetic) → /catalog/{id}
 * 3. Mapped static → *different* live id → /catalog/{live}
 * 4. Trade name → /catalog/n~{name}
 * 5. Fallback search → /medicines#q=
 *
 * Generate the map:
 *   node scripts/export-appwrite-medicines.mjs
 *   node scripts/map-static-to-live-ids.mjs --write
 */

import { resolveLiveCanonicalIdSync } from "./canonical-id-map";

export type CatalogLinkSource = "live_db" | "static_dataset" | "unknown";

const NAME_PREFIX = "n~";

/** Static-only ID band used for formulas / seeded packs (collides with live). */
export function isSyntheticStaticCatalogId(
  id: number | string | null | undefined,
): boolean {
  const n = Number(id);
  return Number.isFinite(n) && n >= 90000 && n < 100000;
}

export function isNameKeyedCatalogId(id: string): boolean {
  return String(id || "").startsWith(NAME_PREFIX);
}

export function parseNameKeyedCatalogId(id: string): string | null {
  if (!isNameKeyedCatalogId(id)) return null;
  try {
    return decodeURIComponent(String(id).slice(NAME_PREFIX.length)).trim();
  } catch {
    return String(id).slice(NAME_PREFIX.length).trim();
  }
}

export function normalizeTradeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIdentityMap(
  staticId: number | string | null | undefined,
  liveId: number | string | null | undefined,
): boolean {
  if (staticId == null || liveId == null) return false;
  return String(staticId).trim() === String(liveId).trim();
}

/**
 * Build monograph URL.
 */
export function encyclopediaProductUrl(options: {
  nameEn?: string | null;
  nameAr?: string | null;
  canonicalId?: number | string | null;
  idSource?: CatalogLinkSource;
  forceCatalogId?: boolean;
}): string {
  const name = String(options.nameEn || options.nameAr || "").trim();
  const id = options.canonicalId;
  const source = options.idSource || "unknown";

  // Synthetic static band (Similac 90019, etc.) — always name-keyed when possible
  if (isSyntheticStaticCatalogId(id)) {
    if (name) {
      return `/catalog/${NAME_PREFIX}${encodeURIComponent(name)}`;
    }
    return `/medicines#q=${encodeURIComponent(String(id))}`;
  }

  if (
    options.forceCatalogId &&
    source === "live_db" &&
    id != null &&
    String(id).trim() !== "" &&
    !isSyntheticStaticCatalogId(id)
  ) {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  // Live DB numeric links only outside the synthetic band
  if (
    source === "live_db" &&
    id != null &&
    String(id).trim() !== "" &&
    !isSyntheticStaticCatalogId(id)
  ) {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  // Mapped static → live only when remap is real and target is not synthetic
  const mapped = resolveLiveCanonicalIdSync({
    staticId: id,
    nameEn: options.nameEn,
    nameAr: options.nameAr,
  });
  if (
    mapped != null &&
    !isIdentityMap(id, mapped) &&
    !isSyntheticStaticCatalogId(mapped)
  ) {
    return `/catalog/${encodeURIComponent(String(mapped))}`;
  }

  if (name) {
    return `/catalog/${NAME_PREFIX}${encodeURIComponent(name)}`;
  }

  if (id != null && String(id).trim() !== "") {
    return `/medicines#q=${encodeURIComponent(String(id))}`;
  }

  return "/medicines";
}

export function encyclopediaSearchUrl(query: string): string {
  const q = String(query || "").trim();
  if (!q) return "/medicines";
  return `/medicines#q=${encodeURIComponent(q)}`;
}

export function readEncyclopediaQueryFromLocation(
  loc: { search?: string; hash?: string } = typeof window !== "undefined"
    ? window.location
    : {},
): string {
  const search = String(loc.search || "");
  const hash = String(loc.hash || "").replace(/^#/, "");

  const fromSearch = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const qSearch = (fromSearch.get("q") || fromSearch.get("query") || "").trim();
  if (qSearch) return qSearch;

  if (!hash) return "";
  if (hash.includes("=")) {
    const fromHash = new URLSearchParams(hash);
    return (fromHash.get("q") || fromHash.get("query") || "").trim();
  }
  return decodeURIComponent(hash).trim();
}

/** Live rows that are empty stubs colliding with static IDs. */
export function isPlaceholderCatalogProduct(product: {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  current_price_egp?: number | null;
}): boolean {
  const en = String(product.name_en || "");
  const ar = String(product.name_ar || "");
  if (/^Medicine Catalog Product\s*#/i.test(en)) return true;
  if (/مستحضر دوائي\s*#/.test(ar)) return true;
  if (/^Active Pharmaceutical Ingredients$/i.test(String(product.scientific_name || ""))) {
    if (
      (!product.current_price_egp || Number(product.current_price_egp) === 0) &&
      /^Medicine Catalog Product/i.test(en)
    ) {
      return true;
    }
  }
  return false;
}
