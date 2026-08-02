/**
 * Safe public links into the encyclopedia monograph.
 *
 * Problem: static dataset canonical_id ≠ Appwrite live canonical_id.
 * Using /catalog/11539 for a card labeled ARMOWAKE opened Dabur shampoo.
 *
 * Solution for “open the real monograph”:
 *   /catalog/n~{URL-encoded trade name}
 * MedicineDetail loads by exact / fuzzy name against the live API, then
 * rewrites the URL to /catalog/{live_canonical_id} when unique.
 *
 * Directory search remains: /medicines#q=…
 */

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

/** Build monograph URL. Prefer trade name → name-keyed catalog path. */
export function encyclopediaProductUrl(options: {
  nameEn?: string | null;
  nameAr?: string | null;
  canonicalId?: number | string | null;
  idSource?: CatalogLinkSource;
  /** Deep-link a verified live row only (rare). */
  forceCatalogId?: boolean;
}): string {
  const name = String(options.nameEn || options.nameAr || "").trim();
  const id = options.canonicalId;

  if (
    options.forceCatalogId &&
    options.idSource === "live_db" &&
    id != null &&
    String(id).trim() !== ""
  ) {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  // Primary: name-keyed monograph (resolves against live DB on the detail page)
  if (name) {
    return `/catalog/${NAME_PREFIX}${encodeURIComponent(name)}`;
  }

  if (id != null && String(id).trim() !== "") {
    return `/medicines#q=${encodeURIComponent(String(id))}`;
  }

  return "/medicines";
}

/** List / filter search only (not a single monograph). */
export function encyclopediaSearchUrl(query: string): string {
  const q = String(query || "").trim();
  if (!q) return "/medicines";
  return `/medicines#q=${encodeURIComponent(q)}`;
}

export function normalizeTradeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
