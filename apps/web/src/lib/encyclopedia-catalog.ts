/**
 * Client-side encyclopedia catalog helpers:
 * title cleanup, identity keys, and near-duplicate grouping (price variants).
 * Prefer UI collapse over destructive DB merges.
 */

import { normalizeUnicodeForMatch } from "./unicode-normalize";
import type { MedicineListItem } from "./medicines-appwrite-page";
import { cleanAttribute } from "./product-type";

/** Strip leading junk (-, –, —, bullets) and collapse whitespace for display. */
export function scrubCatalogNameRaw(name: string | null | undefined): string {
  let s = String(name ?? "").trim();
  if (!s) return "";
  // Leading punctuation / bullets / hyphens often present in legacy imports
  s = s.replace(/^[\s\-–—•·*_./\\|:;,'"`~]+/u, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Title-case Latin ALL-CAPS product names; leave mixed-case and Arabic alone.
 * Keeps short tokens (CM, MG, ML, IU, PH) uppercase when they look like units/abbrev.
 */
export function formatCatalogTitle(name: string | null | undefined): string {
  const cleaned = scrubCatalogNameRaw(name);
  if (!cleaned) return "";

  const letters = cleaned.replace(/[^A-Za-z]/g, "");
  const upper = (letters.match(/[A-Z]/g) || []).length;
  const lower = (letters.match(/[a-z]/g) || []).length;
  const mostlyCaps = letters.length >= 4 && upper >= letters.length * 0.85 && lower <= letters.length * 0.15;

  if (!mostlyCaps) return cleaned;

  const KEEP_UPPER = new Set([
    "cm", "mm", "mg", "mcg", "ml", "iu", "ph", "uv", "spf", "xl", "xs", "xxl",
    "eda", "who", "fda", "otc", "rx", "bm", "iv", "im", "sc", "po",
  ]);

  return cleaned
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      const bare = token.replace(/[^A-Za-z0-9%./-]/g, "");
      const lowerBare = bare.toLowerCase();
      if (KEEP_UPPER.has(lowerBare)) {
        return token.replace(bare, bare.toUpperCase());
      }
      if (/^\d/.test(bare) || !/[A-Za-z]/.test(bare)) return token;
      const titled = bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase();
      return token.replace(bare, titled);
    })
    .join("");
}

/** Stable identity for near-duplicate collapse (names that only differ by noise). */
export function catalogIdentityKey(item: Pick<MedicineListItem, "name_en" | "name_ar" | "canonical_id">): string {
  const primary = scrubCatalogNameRaw(item.name_en) || scrubCatalogNameRaw(item.name_ar);
  if (!primary) return `id:${item.canonical_id || 0}`;
  return normalizeUnicodeForMatch(primary)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type CatalogCardModel = MedicineListItem & {
  /** Min price across grouped variants (EGP). */
  price_min_egp?: number | null;
  /** Max price across grouped variants (EGP). */
  price_max_egp?: number | null;
  /** Number of near-duplicate / price variants collapsed into this card. */
  variant_count?: number;
  /** Other variant document ids (excluding primary). */
  variant_ids?: string[];
};

function scoreItem(item: MedicineListItem): number {
  let score = 0;
  if (item.image_url && !/unsplash|placeholder|no_image/i.test(item.image_url)) score += 8;
  if (cleanAttribute(item.scientific_name)) score += 5;
  if (cleanAttribute(item.drug_class)) score += 2;
  if (cleanAttribute(item.manufacturer)) score += 2;
  if (item.has_verified_dataset) score += 3;
  if (item.current_price_egp != null && Number.isFinite(Number(item.current_price_egp))) score += 1;
  if (item.public_url) score += 1;
  // Prefer lower canonical ids as a stable tie-break when otherwise equal
  score -= Math.min(Number(item.canonical_id) || 0, 1_000_000) / 1e9;
  return score;
}

function collectPrices(items: MedicineListItem[]): number[] {
  return items
    .map((i) => (i.current_price_egp != null ? Number(i.current_price_egp) : NaN))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/**
 * Collapse near-identical catalog rows (same cleaned name) into one card.
 * Price variants become a single card with min–max range + variant_count.
 * Order of first occurrence is preserved (search ranking stays intact).
 */
export function groupCatalogNearDuplicates(items: MedicineListItem[]): CatalogCardModel[] {
  const groups = new Map<string, MedicineListItem[]>();
  const order: string[] = [];

  for (const item of items) {
    const key = catalogIdentityKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  return order.map((key) => {
    const members = groups.get(key)!;
    if (members.length === 1) {
      const only = members[0];
      return {
        ...only,
        price_min_egp: only.current_price_egp,
        price_max_egp: only.current_price_egp,
        variant_count: 1,
        variant_ids: [],
      };
    }

    const primary = [...members].sort((a, b) => scoreItem(b) - scoreItem(a))[0];
    const prices = collectPrices(members);
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;
    const ids = members
      .map((m) => m.$id)
      .filter((id): id is string => Boolean(id) && id !== primary.$id);

    return {
      ...primary,
      // Prefer a representative price in the middle of the range for sorting consumers
      current_price_egp: min != null && max != null ? (min === max ? min : primary.current_price_egp ?? min) : primary.current_price_egp,
      price_min_egp: min,
      price_max_egp: max,
      variant_count: members.length,
      variant_ids: ids,
      // Prefer any real attribute from the group
      scientific_name:
        cleanAttribute(primary.scientific_name) ||
        members.map((m) => cleanAttribute(m.scientific_name)).find(Boolean) ||
        null,
      drug_class:
        cleanAttribute(primary.drug_class) ||
        members.map((m) => cleanAttribute(m.drug_class)).find(Boolean) ||
        null,
      manufacturer:
        cleanAttribute(primary.manufacturer) ||
        members.map((m) => cleanAttribute(m.manufacturer)).find(Boolean) ||
        null,
      image_url: primary.image_url || members.map((m) => m.image_url).find(Boolean) || null,
    };
  });
}

export function formatCatalogPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  fallback: number | null | undefined,
): string | null {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : null;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : null;
  const f = fallback != null && Number.isFinite(Number(fallback)) ? Number(fallback) : null;
  if (a != null && b != null) {
    if (a === b) return `${a.toFixed(2)} EGP`;
    return `${a.toFixed(2)} – ${b.toFixed(2)} EGP`;
  }
  if (f != null) return `${f.toFixed(2)} EGP`;
  return null;
}
