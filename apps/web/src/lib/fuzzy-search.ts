/**
 * Lightweight fuzzy match helpers for medicine catalog ranking.
 * No external deps — safe for mobile bundle size.
 * Uses unified EN+AR search-normalize for keys.
 */

import { compactSearchKey, normalizeSearchKey } from "./search-normalize";

export function normalizeFuzzy(s: string): string {
  return normalizeSearchKey(s);
}

/** Classic Levenshtein edit distance on already-normalized strings. */
export function levenshteinRaw(s: string, t: string): number {
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const m = s.length;
  const n = t.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Classic Levenshtein edit distance (normalizes inputs). */
export function levenshtein(a: string, b: string): number {
  return levenshteinRaw(normalizeFuzzy(a), normalizeFuzzy(b));
}

/** Similarity 0..1 from edit distance (length-normalized). */
export function editSimilarity(a: string, b: string): number {
  const s = normalizeFuzzy(a);
  const t = normalizeFuzzy(b);
  if (!s && !t) return 1;
  if (!s || !t) return 0;
  const d = levenshteinRaw(s, t);
  const maxLen = Math.max(s.length, t.length);
  return maxLen === 0 ? 1 : 1 - d / maxLen;
}

/**
 * Token-level best similarity: max editSimilarity of any query token
 * against any candidate token (handles multi-word trade names).
 */
export function tokenFuzzyScore(query: string, candidate: string): number {
  const qTokens = normalizeFuzzy(query).split(" ").filter(Boolean);
  const cTokens = normalizeFuzzy(candidate).split(" ").filter(Boolean);
  if (!qTokens.length || !cTokens.length) return 0;

  let best = 0;
  for (const qt of qTokens) {
    for (const ct of cTokens) {
      if (qt.length < 3 && ct.length < 3) continue;
      const sim = editSimilarity(qt, ct);
      if (sim > best) best = sim;
      if (ct.startsWith(qt) || qt.startsWith(ct)) {
        best = Math.max(best, 0.92);
      }
    }
  }
  return best;
}

/**
 * Pharma-oriented character confusions (keyboard / handwriting / EN-AR transliteration).
 * Applied as optional pre-normalization before distance.
 */
const PHARMA_CHAR_MAP: Array<[RegExp, string]> = [
  [/ph/g, "f"],
  [/y/g, "i"],
  [/ou/g, "u"],
  [/ee/g, "i"],
  [/kk/g, "k"],
  [/ll/g, "l"],
  [/tt/g, "t"],
  [/ss/g, "s"],
  [/z/g, "s"],
  [/c(?=[eiy])/g, "s"],
];

export function pharmaNormalize(s: string): string {
  let x = compactSearchKey(s);
  for (const [re, to] of PHARMA_CHAR_MAP) {
    x = x.replace(re, to);
  }
  return x;
}

export function pharmaFuzzyScore(query: string, candidate: string): number {
  const a = pharmaNormalize(query);
  const b = pharmaNormalize(candidate);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = levenshteinRaw(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - d / maxLen;
}

/**
 * Combined fuzzy score 0..1 for ranking (higher = better match).
 */
export function fuzzyMatchScore(query: string, candidate: string): number {
  const exact = normalizeFuzzy(query) === normalizeFuzzy(candidate);
  if (exact) return 1;

  const token = tokenFuzzyScore(query, candidate);
  const whole = editSimilarity(query, candidate);
  const pharma = pharmaFuzzyScore(query, candidate);

  return Math.max(token * 0.55 + whole * 0.25 + pharma * 0.2, token, whole * 0.9);
}

/** True when fuzzy match is strong enough to surface in results. */
export function isStrongFuzzyMatch(query: string, candidate: string): boolean {
  const q = normalizeFuzzy(query);
  if (q.length < 3) return false;
  const score = fuzzyMatchScore(query, candidate);
  const threshold = q.length <= 4 ? 0.88 : q.length <= 6 ? 0.78 : 0.7;
  return score >= threshold;
}
