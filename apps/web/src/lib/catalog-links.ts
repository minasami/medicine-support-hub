/**
 * Safe public links into the encyclopedia.
 *
 * IMPORTANT: static dataset canonical_id values are NOT the same ID space as
 * the live Appwrite/Supabase `medicines.canonical_id`. Linking `/catalog/{staticId}`
 * causes wrong-product pages (e.g. ACTI-COLLA → Clearasil).
 *
 * Prefer name-based search links unless the id is known to come from the live DB.
 *
 * After deploying link fixes: hard-refresh the browser (Ctrl+Shift+R) and purge
 * CDN/asset cache if old bundles still navigate to /catalog/{staticId}.
 * See docs/canonical-id-unification.md.
 *
 * Unify IDs with:
 *   node scripts/export-appwrite-medicines.mjs
 *   node scripts/map-static-to-live-ids.mjs --dry-run
 *   node scripts/map-static-to-live-ids.mjs --write
 */

export type CatalogLinkSource = "live_db" | "static_dataset" | "unknown";

/** Build a public product URL that will not cross ID spaces. */
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
    return `/medicines?q=${encodeURIComponent(name)}`;
  }

  if (id != null && String(id).trim() !== "") {
    // Last resort — may still collide; prefer avoiding this path
    return `/medicines?q=${encodeURIComponent(String(id))}`;
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
