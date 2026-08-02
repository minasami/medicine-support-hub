/**
 * Safe public links into the encyclopedia monograph.
 *
 * ID spaces:
 *   Static dataset canonical_id ≠ Appwrite live canonical_id.
 *
 * Resolution order for product URLs:
 * 1. forceCatalogId + live_db → /catalog/{id}
 * 2. Optional mapped live id (from /data/static-to-live-id-map.json) → /catalog/{live}
 * 3. Trade name → /catalog/n~{name} (detail page resolves by name)
 * 4. Fallback search → /medicines#q=
 *
 * Generate the map:
 *   node scripts/export-appwrite-medicines.mjs
 *   node scripts/map-static-to-live-ids.mjs --write
 */

import { resolveLiveCanonicalIdSync } from "./canonical-id-map";

export type CatalogLinkSource = "live_db" | "static_dataset" | "unknown";

const NAME_PREFIX = "n~";

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

/**
 * Build monograph URL.
 * When the canonical map is already loaded, mapped static IDs become /catalog/{liveId}.
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

  if (
    options.forceCatalogId &&
    source === "live_db" &&
    id != null &&
    String(id).trim() !== ""
  ) {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  // Already tagged as live — safe numeric catalog link
  if (source === "live_db" && id != null && String(id).trim() !== "") {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  // Mapped static → live (sync; map must be prefetched)
  const mapped = resolveLiveCanonicalIdSync({
    staticId: id,
    nameEn: options.nameEn,
    nameAr: options.nameAr,
  });
  if (mapped != null) {
    return `/catalog/${mapped}`;
  }

  // Name-keyed monograph (detail resolves against live API)
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
