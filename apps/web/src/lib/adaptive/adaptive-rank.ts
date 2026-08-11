/**
 * Adaptive ranking: blends fixed tier logic with evolved genome weights
 * and learned query aliases from user reformulations.
 */

import { getActiveGenome } from "@/lib/adaptive/evolution-engine";
import { expandSearchQuery } from "@/lib/expand-search-query";
import {
  medicineQueryScore,
  rankMedicineResults,
  type RankableMedicine,
} from "@/lib/rank-medicine-results";
import { fuzzyMatchScore } from "@/lib/fuzzy-search";

/** Resolve query through learned aliases + static expansion. */
export function resolveAdaptiveQuery(raw: string): {
  primary: string;
  variants: string[];
  learnedAlias?: string;
} {
  const term = (raw || "").trim();
  if (!term) return { primary: "", variants: [] };

  const genome = getActiveGenome();
  const key = term.toLowerCase();
  const learned = genome.queryAliases[key];

  const variants = expandSearchQuery(learned || term);
  if (learned && !variants.some((v) => v.toLowerCase() === learned.toLowerCase())) {
    variants.unshift(learned);
  }
  if (!variants.includes(term)) variants.unshift(term);

  return {
    primary: learned || term,
    variants: [...new Set(variants)].slice(0, 10),
    learnedAlias: learned,
  };
}

/**
 * Score with genome multipliers (lower still better, but scaled by importance).
 */
export function adaptiveMedicineScore(
  item: RankableMedicine,
  query: string,
): number {
  const genome = getActiveGenome();
  const base = medicineQueryScore(item, query); // 0 best … 100 worst

  // Map base bands to genome weights → adjusted score
  const w = genome.rank;
  let importance = w.contains;
  if (base <= 1) importance = w.exact;
  else if (base <= 5) importance = w.barcode;
  else if (base <= 15) importance = w.prefix;
  else if (base <= 40) importance = w.token;
  else if (base <= 65) importance = w.fuzzy;
  else if (base <= 80) importance = w.contains;
  else importance = w.manufacturer * 0.5;

  // Higher importance → pull toward better ranks
  const adjusted = base / Math.max(0.25, importance);

  // Shorter name bonus for strong matches
  const nameLen = String(item.name_en || "").length;
  const shortBonus =
    base <= 15 ? nameLen * (1 - w.shorterNameBonus) * 0.01 : 0;

  // Extra fuzzy refinement
  const fuzzy = fuzzyMatchScore(query, String(item.name_en || ""));
  const fuzzyNudge = base >= 45 && base <= 70 ? (1 - fuzzy) * 8 : 0;

  return adjusted + shortBonus + fuzzyNudge;
}

export function adaptiveRankMedicineResults<T extends RankableMedicine>(
  items: T[],
  query: string,
): T[] {
  const q = (query || "").trim();
  if (!q || !items?.length) return items || [];

  const resolved = resolveAdaptiveQuery(q);
  const effective = resolved.primary;

  // Start from classic rank, then stable-sort by adaptive score
  const baseRanked = rankMedicineResults(items, effective);
  return [...baseRanked].sort((a, b) => {
    const sa = adaptiveMedicineScore(a, effective);
    const sb = adaptiveMedicineScore(b, effective);
    if (sa !== sb) return sa - sb;
    return String(a.name_en || "").localeCompare(String(b.name_en || ""));
  });
}
