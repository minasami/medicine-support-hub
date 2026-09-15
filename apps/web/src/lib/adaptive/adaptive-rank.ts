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
 * Also considers expanded variants so aliases like "congesta" rank Congestal well.
 */
export function adaptiveMedicineScore(
  item: RankableMedicine,
  query: string,
  variants?: string[],
): number {
  const genome = getActiveGenome();
  const probes = variants?.length ? variants : [query];
  let base = 100;
  for (const probe of probes) {
    base = Math.min(base, medicineQueryScore(item, probe));
  }

  const w = genome.rank;
  let importance = w.contains;
  if (base <= 1) importance = w.exact;
  else if (base <= 5) importance = w.barcode;
  else if (base <= 15) importance = w.prefix;
  else if (base <= 40) importance = w.token;
  else if (base <= 65) importance = w.fuzzy;
  else if (base <= 80) importance = w.contains;
  else importance = w.manufacturer * 0.5;

  const adjusted = base / Math.max(0.25, importance);

  const nameLen = String(item.name_en || "").length;
  const shortBonus =
    base <= 15 ? nameLen * (1 - w.shorterNameBonus) * 0.01 : 0;

  let fuzzy = 0;
  for (const probe of probes) {
    fuzzy = Math.max(fuzzy, fuzzyMatchScore(probe, String(item.name_en || "")));
    fuzzy = Math.max(fuzzy, fuzzyMatchScore(probe, String(item.name_ar || "")));
  }
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
  const variants = resolved.variants;

  // Rank against best of original + expanded probes
  const baseRanked = rankMedicineResults(items, effective);
  return [...baseRanked].sort((a, b) => {
    const sa = adaptiveMedicineScore(a, effective, variants);
    const sb = adaptiveMedicineScore(b, effective, variants);
    if (sa !== sb) return sa - sb;
    return String(a.name_en || "").localeCompare(String(b.name_en || ""));
  });
}
