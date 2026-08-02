/**
 * Safe public links into the encyclopedia.
 *
 * IMPORTANT — ID spaces collide:
 *   Static dataset canonical_id ≠ Appwrite live canonical_id.
 *   Linking /catalog/:id from list cards caused wrong monographs
 *   (e.g. ARMOWAKE card → Dabur shampoo at catalog/11539).
 *
 * Policy: prefer **name search** (`/medicines#q=…`) for all product links.
 * Hash form survives hosting redirects that strip `?q=`.
 *
 * `/catalog/:id` remains valid only when the caller *already* loaded that
 * exact live row and wants a deep link (rare). Pass `forceCatalogId: true`.
 */

export type CatalogLinkSource = "live_db" | "static_dataset" | "unknown";

export function encyclopediaProductUrl(options: {
  nameEn?: string | null;
  nameAr?: string | null;
  canonicalId?: number | string | null;
  idSource?: CatalogLinkSource;
  /** Only use when the id was verified against the live Appwrite row just now. */
  forceCatalogId?: boolean;
}): string {
  const name = String(options.nameEn || options.nameAr || "").trim();
  const id = options.canonicalId;

  // Default: name search — avoids static/live ID collisions
  if (name) {
    return `/medicines#q=${encodeURIComponent(name)}`;
  }

  if (
    options.forceCatalogId &&
    options.idSource === "live_db" &&
    id != null &&
    String(id).trim() !== ""
  ) {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  if (id != null && String(id).trim() !== "") {
    // Last resort: search by the numeric token as text (not /catalog/:id)
    return `/medicines#q=${encodeURIComponent(String(id))}`;
  }

  return "/medicines";
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
