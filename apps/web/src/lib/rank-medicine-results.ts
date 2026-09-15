/**
 * Re-rank medicine list hits for a text query.
 * Exact / prefix first, then multi-token cross-field (INN + company),
 * then fuzzy (Levenshtein + pharma normalize + Arabic-aware keys).
 * Appwrite fulltext order is not relevance-sorted.
 *
 * Preference: short standalone trade names over long combination strings
 * (same idea as combobox-rank).
 */

import { arabicFuzzyScore } from "@/lib/arabic-fuzzy-match";
import {
  fuzzyMatchScore,
  isStrongFuzzyMatch,
  normalizeFuzzy,
} from "@/lib/fuzzy-search";
import { hasArabicScript } from "@/lib/search-normalize";

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
  | "compound"
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

/** Tokens too generic to drive compound matching alone. */
const STOP_TOKENS = new Set([
  "mg",
  "ml",
  "tab",
  "tabs",
  "tablet",
  "tablets",
  "cap",
  "caps",
  "capsule",
  "capsules",
  "syrup",
  "inj",
  "injection",
  "cream",
  "gel",
  "ointment",
  "and",
  "or",
  "the",
  "of",
  "for",
  "with",
  "by",
  "co",
  "company",
  "pharma",
  "pharmaceutical",
  "pharmaceuticals",
  "labs",
  "laboratories",
  "industries",
  "egypt",
  "limited",
  "ltd",
  "sae",
  "inc",
  "from",
]);

function norm(s: string): string {
  return normalizeFuzzy(s);
}

function comboPenalty(label: string): number {
  const l = String(label || "");
  const marks = (l.match(/[+\/&,;|]/g) || []).length;
  return marks * 3 + Math.max(0, Math.floor((l.length - 36) / 12));
}

export function queryTokens(query: string): string[] {
  return norm(query)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

function fieldHasToken(field: string, token: string): boolean {
  if (!field || !token) return false;
  if (field === token) return true;
  if (token.length <= 3) {
    const parts = field.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return parts.some((p) => p === token || p.startsWith(token));
  }
  if (field.startsWith(token + " ") || field.startsWith(token)) return true;
  if (field.includes(" " + token + " ") || field.includes(" " + token)) return true;
  if (field.includes(token)) return true;
  if (token.length >= 5) {
    const parts = field.split(" ").filter(Boolean);
    for (const p of parts) {
      if (p.startsWith(token) || (p.length >= 4 && token.startsWith(p))) return true;
      if (fuzzyMatchScore(token, p) >= 0.88) return true;
    }
  }
  return false;
}

/**
 * Multi-token cross-field score.
 * Prefer products where one token matches the active ingredient (scientific_name)
 * and another matches the manufacturer (or trade name).
 * Lower score = better.
 */
function multiTokenScore(item: RankableMedicine, tokens: string[]): number | null {
  if (tokens.length < 2) return null;

  const en = norm(String(item.name_en || ""));
  const ar = norm(String(item.name_ar || ""));
  const sci = norm(String(item.scientific_name || ""));
  const mfr = norm(String(item.manufacturer || ""));
  const bar = String(item.barcode || "").replace(/\s/g, "");

  type Hit = { token: string; fields: Set<"name" | "sci" | "mfr" | "bar"> };
  const hits: Hit[] = [];

  for (const token of tokens) {
    const fields = new Set<"name" | "sci" | "mfr" | "bar">();
    if (fieldHasToken(en, token) || fieldHasToken(ar, token)) fields.add("name");
    if (fieldHasToken(sci, token)) fields.add("sci");
    if (fieldHasToken(mfr, token)) fields.add("mfr");
    if (bar && (bar.includes(token) || token.includes(bar))) fields.add("bar");
    if (fields.size) hits.push({ token, fields });
  }

  if (!hits.length) return null;

  const covered = hits.length;
  const allCovered = covered === tokens.length;

  const sciTokens = new Set(hits.filter((h) => h.fields.has("sci")).map((h) => h.token));
  const mfrTokens = new Set(hits.filter((h) => h.fields.has("mfr")).map((h) => h.token));
  const nameTokens = new Set(hits.filter((h) => h.fields.has("name")).map((h) => h.token));

  let sciMfrCross = false;
  for (const st of sciTokens) {
    for (const mt of mfrTokens) {
      if (st !== mt) {
        sciMfrCross = true;
        break;
      }
    }
    if (sciMfrCross) break;
  }

  let nameMfrCross = false;
  for (const nt of nameTokens) {
    for (const mt of mfrTokens) {
      if (nt !== mt) {
        nameMfrCross = true;
        break;
      }
    }
    if (nameMfrCross) break;
  }

  let sciNameCross = false;
  for (const st of sciTokens) {
    for (const nt of nameTokens) {
      if (st !== nt) {
        sciNameCross = true;
        break;
      }
    }
    if (sciNameCross) break;
  }

  if (sciMfrCross && allCovered) return 4;
  if (sciMfrCross) return 7;
  if (nameMfrCross && allCovered) return 8;
  if (sciNameCross && allCovered) return 10;
  if (nameMfrCross || sciNameCross) return 12;
  if (allCovered) return 16;
  if (covered >= 2) return 26;
  return null;
}

function bestArabicFieldScore(query: string, item: RankableMedicine): number {
  if (!hasArabicScript(query) && !hasArabicScript(String(item.name_ar || ""))) {
    return 0;
  }
  let best = 0;
  for (const field of [item.name_ar, item.name_en, item.scientific_name]) {
    if (!field) continue;
    best = Math.max(best, arabicFuzzyScore(query, field));
  }
  return best;
}

/** Lower score = better. */
export function medicineQueryScore(
  item: RankableMedicine,
  query: string,
): number {
  const q = norm(query);
  if (!q) return 500;

  const en = norm(String(item.name_en || ""));
  const ar = norm(String(item.name_ar || ""));
  const sci = norm(String(item.scientific_name || ""));
  const mfr = norm(String(item.manufacturer || ""));
  const bar = String(item.barcode || "").replace(/\s/g, "");
  const qCompact = q.replace(/\s/g, "");
  const penalty = comboPenalty(String(item.name_en || item.name_ar || ""));

  if (en && en === q) return 0;
  if (ar && ar === q) return 1;
  if (bar && bar === qCompact) return 5;

  const tokens = queryTokens(query);
  const compound = multiTokenScore(item, tokens);
  if (compound != null && compound <= 12) return compound + Math.min(penalty, 4);

  if (en && en.startsWith(q + " ")) return 10 + Math.min(penalty, 5);
  if (en && en.startsWith(q)) return 15 + Math.min(penalty, 5);
  if (ar && ar.startsWith(q)) return 14 + Math.min(penalty, 5);
  if (sci && sci === q) return 20;
  if (sci && sci.startsWith(q)) return 25;

  if (tokens.length >= 2) {
    if (compound != null) return compound + Math.min(penalty, 4);

    let tokenHits = 0;
    for (const token of tokens) {
      if (
        fieldHasToken(en, token) ||
        fieldHasToken(sci, token) ||
        fieldHasToken(mfr, token) ||
        fieldHasToken(ar, token)
      ) {
        tokenHits++;
      }
    }
    if (tokenHits === tokens.length) return 22 + Math.min(penalty, 4);
    if (tokenHits >= 2) return 32 + Math.min(penalty, 4);
  }

  const nameTokens = en.split(" ").filter(Boolean);
  if (nameTokens.some((t) => t === q)) return 30;
  if (nameTokens.some((t) => t.startsWith(q))) return 40;
  const arTokens = ar.split(" ").filter(Boolean);
  if (arTokens.some((t) => t === q)) return 30;
  if (arTokens.some((t) => t.startsWith(q))) return 40;

  const fuzzyEn = en ? fuzzyMatchScore(q, en) : 0;
  const fuzzyAr = ar ? fuzzyMatchScore(q, ar) : 0;
  const fuzzySci = sci ? fuzzyMatchScore(q, sci) : 0;
  const fuzzyMfr = mfr ? fuzzyMatchScore(q, mfr) : 0;
  const arScore = bestArabicFieldScore(query, item); // 0..100
  const bestFuzzy = Math.max(
    fuzzyEn,
    fuzzyAr,
    fuzzySci,
    fuzzyMfr,
    arScore / 100,
  );
  if (bestFuzzy >= 0.92 || arScore >= 92) return 45 + Math.min(penalty, 6);
  if (bestFuzzy >= 0.85 || arScore >= 85) return 52 + Math.min(penalty, 6);
  if (bestFuzzy >= 0.78 || arScore >= 78) return 58 + Math.min(penalty, 6);
  if (bestFuzzy >= 0.7 || arScore >= 70) return 65 + Math.min(penalty, 6);

  if (en.includes(q)) return 70 + Math.min(penalty, 8);
  if (ar.includes(q)) return 71 + Math.min(penalty, 8);
  if (sci.includes(q)) return 75;
  if (mfr.includes(q)) return 80;

  if (tokens.length === 1) {
    const t = tokens[0];
    if (fieldHasToken(sci, t)) return 76;
    if (fieldHasToken(mfr, t)) return 82;
  }

  if (bestFuzzy >= 0.6 || arScore >= 55) return 88;
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
  if (score <= 12)
    return {
      score,
      tier: "compound",
      labelEn: "Active ingredient + company match",
      labelAr: "تطابق المادة الفعالة والشركة",
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
      labelEn: "Word match in name / ingredient / company",
      labelAr: "كلمة مطابقة في الاسم أو المادة أو الشركة",
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
    const na = String(a.name_en || a.name_ar || "");
    const nb = String(b.name_en || b.name_ar || "");
    // Prefer short standalone over long combos for strong matches
    if (sa <= 65) {
      const pa = comboPenalty(na);
      const pb = comboPenalty(nb);
      if (pa !== pb) return pa - pb;
      if (na.length !== nb.length) return na.length - nb.length;
    }
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

  const tokens = queryTokens(q);
  const multi = tokens.length >= 2;

  const strong = items.filter((item) => {
    const score = medicineQueryScore(item, q);
    if (score <= 40) return true;
    if (multi && score <= 82) return true;
    const en = String(item.name_en || "");
    const ar = String(item.name_ar || "");
    const sci = String(item.scientific_name || "");
    const mfr = String(item.manufacturer || "");
    return (
      isStrongFuzzyMatch(q, en) ||
      isStrongFuzzyMatch(q, ar) ||
      isStrongFuzzyMatch(q, sci) ||
      isStrongFuzzyMatch(q, mfr) ||
      score <= 75
    );
  });

  return strong.length ? strong : items;
}
