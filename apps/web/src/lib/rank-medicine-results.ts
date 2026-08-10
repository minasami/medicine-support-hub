/**
 * Re-rank medicine list hits for a text query.
 * Exact / prefix first, then fuzzy (Levenshtein + pharma normalize).
 * Appwrite fulltext order is not relevance-sorted.
 */

import {
  fuzzyMatchScore,
  isStrongFuzzyMatch,
  normalizeFuzzy,
} from "@/lib/fuzzy-search";

export type RankableMedicine = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
};

export type RankTier =
  | "exact"
  | "barcode"
  | "prefix"
  | "token"
  | "fuzzy"
  | "contains"
  | "weak";

export type RankExplanation = {
  score: number;
  tier: RankTier;
  labelEn: string;
  labelAr: string;
};

function norm(s: string): string {
  return normalizeFuzzy(s);
}

/** Lower score = better. */
export function medicineQueryScore(
  item: RankableMedicine,
  query: string,
): number {
  const q = norm(query);
  if (!q) return 500;

  const en = norm(String(item.name_en || ""));
  const ar = String(item.name_ar || "").trim();
  const sci = norm(String(item.scientific_name || ""));
  const mfr = norm(String(item.manufacturer || ""));
  const bar = String(item.barcode || "").replace(/\s/g, "");
  const qCompact = q.replace(/\s/g, "");

  if (en && en === q) return 0;
  if (ar && ar === query.trim()) return 1;
  if (bar && bar === qCompact) return 5;
  if (en && en.startsWith(q + " ")) return 10;
  if (en && en.startsWith(q)) return 15;
  if (sci && sci === q) return 20;
  if (sci && sci.startsWith(q)) return 25;

  const tokens = en.split(" ").filter(Boolean);
  if (tokens.some((t) => t === q)) return 30;
  if (tokens.some((t) => t.startsWith(q))) return 40;

  // Fuzzy band: 45–75 based on 1 - similarity
  const fuzzyEn = en ? fuzzyMatchScore(q, en) : 0;
  const fuzzySci = sci ? fuzzyMatchScore(q, sci) : 0;
  const bestFuzzy = Math.max(fuzzyEn, fuzzySci);
  if (bestFuzzy >= 0.92) return 45;
  if (bestFuzzy >= 0.85) return 52;
  if (bestFuzzy >= 0.78) return 58;
  if (bestFuzzy >= 0.7) return 65;

  if (en.includes(q)) return 70;
  if (sci.includes(q)) return 75;
  if (ar.includes(query.trim())) return 72;
  if (mfr.includes(q)) return 80;

  if (bestFuzzy >= 0.6) return 88;
  return 100;
}

export function explainMedicineRank(
  item: RankableMedicine,
  query: string,
): RankExplanation {
  const score = medicineQueryScore(item, query);
  if (score <= 1)
    return {
      score,
      tier: "exact",
      labelEn: "Exact name match",
      labelAr: "تطابق تام للاسم",
    };
  if (score <= 5)
    return {
      score,
      tier: "barcode",
      labelEn: "Barcode match",
      labelAr: "تطابق الباركود",
    };
  if (score <= 15)
    return {
      score,
      tier: "prefix",
      labelEn: "Starts with your search",
      labelAr: "يبدأ بنص البحث",
    };
  if (score <= 40)
    return {
      score,
      tier: "token",
      labelEn: "Word match in name",
      labelAr: "كلمة مطابقة في الاسم",
    };
  if (score <= 65)
    return {
      score,
      tier: "fuzzy",
      labelEn: "Close spelling match",
      labelAr: "تهجئة قريبة",
    };
  if (score <= 80)
    return {
      score,
      tier: "contains",
      labelEn: "Contains search text",
      labelAr: "يحتوي على نص البحث",
    };
  return {
    score,
    tier: "weak",
    labelEn: "Related hit",
    labelAr: "نتيجة ذات صلة",
  };
}

export function rankMedicineResults<T extends RankableMedicine>(
  items: T[],
  query: string,
): T[] {
  const q = (query || "").trim();
  if (!q || !items?.length) return items || [];

  return [...items].sort((a, b) => {
    const sa = medicineQueryScore(a, q);
    const sb = medicineQueryScore(b, q);
    if (sa !== sb) return sa - sb;
    const na = String(a.name_en || "");
    const nb = String(b.name_en || "");
    if (sa <= 15 && na.length !== nb.length) return na.length - nb.length;
    // Prefer stronger fuzzy when scores equal in fuzzy band
    if (sa >= 45 && sa <= 65) {
      const fa = fuzzyMatchScore(q, na);
      const fb = fuzzyMatchScore(q, nb);
      if (fa !== fb) return fb - fa;
    }
    return na.localeCompare(nb);
  });
}

/** Drop weak fuzzy noise when query is specific enough. */
export function filterWeakFuzzyHits<T extends RankableMedicine>(
  items: T[],
  query: string,
): T[] {
  const q = (query || "").trim();
  if (!q || q.length < 4 || !items?.length) return items || [];

  const strong = items.filter((item) => {
    const score = medicineQueryScore(item, q);
    if (score <= 40) return true;
    const en = String(item.name_en || "");
    const sci = String(item.scientific_name || "");
    return (
      isStrongFuzzyMatch(q, en) ||
      isStrongFuzzyMatch(q, sci) ||
      score <= 75
    );
  });

  return strong.length ? strong : items;
}
