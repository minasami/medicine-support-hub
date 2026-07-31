/**
 * Safe public links into the encyclopedia.
 *
 * IMPORTANT:
 * 1. Static dataset canonical_id ≠ live Appwrite canonical_id.
 * 2. Hosting currently redirects /medicines?q=… → /medicines/ and **drops the query string**.
 *    Portfolio links therefore use a **hash** (`#q=…`) which is not sent to the server
 *    and survives trailing-slash redirects.
 *
 * After deploy: hard-refresh. See docs/canonical-id-unification.md.
 */

export type CatalogLinkSource = "live_db" | "static_dataset" | "unknown";

/** Build a public product URL that will not cross ID spaces or lose q on redirect. */
export function encyclopediaProductUrl(options: {
  nameEn?: string | null;
  canonicalId?: number | string | null;
  /** Only pass "live_db" when the id was loaded from Appwrite/Supabase medicines. */
  idSource?: CatalogLinkSource;
}): string {
  const name = String(options.nameEn || "").trim();
  const id = options.canonicalId;
  const source = options.idSource || "unknown";

  if (source === "live_db" && id != null && String(id).trim() !== "") {
    return `/catalog/${encodeURIComponent(String(id))}`;
  }

  if (name) {
    // Hash form survives /medicines → /medicines/ redirects that strip ?q=
    return `/medicines#q=${encodeURIComponent(name)}`;
  }

  if (id != null && String(id).trim() !== "") {
    return `/medicines#q=${encodeURIComponent(String(id))}`;
  }

  return "/medicines";
}

/** Normalize trade name for equality checks when resolving live rows. */
export function normalizeTradeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Read encyclopedia search text from ?q= / ?query= or #q= / #query=. */
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
  // Support #q=NAME and #NAME
  if (hash.includes("=")) {
    const fromHash = new URLSearchParams(hash);
    return (fromHash.get("q") || fromHash.get("query") || "").trim();
  }
  return decodeURIComponent(hash).trim();
}
