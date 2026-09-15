/**
 * Optional "Did you mean…?" suggestion when the top ranked hit
 * clearly differs from the typed query (typo / AR spelling variant).
 */

import { preferredCorrection } from "./expand-search-query";
import { fuzzyMatchScore, normalizeFuzzy } from "./fuzzy-search";
import type { RankableMedicine } from "./rank-medicine-results";
import { medicineQueryScore } from "./rank-medicine-results";
import { normalizeSearchKey } from "./search-normalize";

export type DidYouMeanSuggestion = {
  suggestion: string;
  reason: "alias" | "fuzzy_top";
};

function displayName(item: RankableMedicine, preferAr: boolean): string {
  const ar = String(item.name_ar || "").trim();
  const en = String(item.name_en || "").trim();
  if (preferAr && ar) return ar;
  return en || ar;
}

/**
 * When query is a near-miss for the top result (or a known alias),
 * return a suggestion string; otherwise null (keep empty/honest states).
 */
export function suggestDidYouMean(
  query: string,
  rankedItems: RankableMedicine[],
): DidYouMeanSuggestion | null {
  const q = (query || "").trim();
  if (!q || q.length < 3) return null;

  const alias = preferredCorrection(q);
  if (alias) {
    return { suggestion: alias, reason: "alias" };
  }

  const top = rankedItems?.[0];
  if (!top) return null;

  const score = medicineQueryScore(top, q);
  // Exact / prefix / strong token — no suggestion noise
  if (score <= 25) return null;

  const preferAr = /[\u0600-\u06FF]/.test(q);
  const label = displayName(top, preferAr);
  if (!label) return null;

  const qn = normalizeSearchKey(q);
  const ln = normalizeSearchKey(label);
  if (!qn || !ln || qn === ln) return null;
  if (ln.startsWith(qn) || qn.startsWith(ln)) return null;

  // First trade token of label (avoid long combo strings as suggestions)
  const firstToken = ln.split(" ").filter(Boolean)[0] || ln;
  const fuzzy = Math.max(
    fuzzyMatchScore(q, label),
    fuzzyMatchScore(q, firstToken),
    fuzzyMatchScore(normalizeFuzzy(q), firstToken),
  );

  if (fuzzy < 0.72 || fuzzy >= 0.98) return null;
  if (score > 88 && fuzzy < 0.82) return null;

  // Prefer short standalone suggestion
  const suggestion =
    String(top.name_en || "").trim().split(/\s+/)[0] ||
    label.split(/\s+/)[0] ||
    label;

  if (normalizeSearchKey(suggestion) === qn) return null;
  return { suggestion, reason: "fuzzy_top" };
}
