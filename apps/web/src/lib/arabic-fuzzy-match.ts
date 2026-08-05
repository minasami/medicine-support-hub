/**
 * Drug-name normalization + fuzzy matching (Arabic-first, Latin-safe).
 * Unicode NFKC + strip ZWJ/bidi/format marks; cross-script via transliteration.
 * Thresholds: catalog >= 55, strict identity / WHO badge >= 85.
 */

import { expandQueryVariants, hasArabicScript, toLatinDrugKey } from "./arabic-transliterate";
import { normalizeUnicodeForMatch } from "./unicode-normalize";

export function stripArabicDiacritics(input: string): string {
  return normalizeUnicodeForMatch(input || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArabicDrugName(input: string): string {
  let s = stripArabicDiacritics(input || "");
  s = s
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u0624\u0626\u0621]/g, "")
    .replace(/[\u0660-\u0669]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)))
    .replace(/[.,;:!?()\[\]{}/\\|+*=~`'"]/g, " ")
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s;
}

export const normalizeTradeName = normalizeArabicDrugName;

export function stripDoseTokens(normalized: string): string {
  return (normalized || "")
    .replace(/\b\d+([.,]\d+)?\s*(mg|mcg|ug|g|ml|iu|i\.?u\.?|%)\b/gi, " ")
    .replace(/\d+([.,]\d+)?\s*([\u0645\u062C\u0645\u0645\u0644\u063A\u0645\u0644]+)/g, " ")
    .replace(/(^|\s)\d+([.,]\d+)?(?=\s|$)/g, " ")
    .replace(/\b(xr|er|sr|cr|mr|odt|dt|fc|film coated|extended release|immediate release)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function tokenSet(s: string): Set<string> {
  const norm = normalizeArabicDrugName(s);
  if (!norm) return new Set();
  return new Set(norm.split(" ").filter(Boolean));
}

export function tokenJaccard(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function arabicFuzzyScore(query: string, candidate: string): number {
  const q = normalizeArabicDrugName(query);
  const c = normalizeArabicDrugName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;

  if (hasArabicScript(query) || hasArabicScript(candidate)) {
    let cross = 0;
    const qVars = expandQueryVariants(query);
    const cVars = expandQueryVariants(candidate);
    for (const qv of qVars) {
      for (const cv of cVars) {
        const qn = normalizeArabicDrugName(qv);
        const cn = normalizeArabicDrugName(cv);
        if (qn && cn && qn === cn) {
          cross = 100;
          break;
        }
        if (qn && cn && qn.length >= 3 && cn.length >= 3) {
          const maxL = Math.max(qn.length, cn.length);
          const sim = 1 - levenshtein(qn, cn) / maxL;
          if (sim >= 0.82) cross = Math.max(cross, Math.round(sim * 100));
          if (cn.includes(qn) || qn.includes(cn)) {
            const shorter = Math.min(qn.length, cn.length);
            const longer = Math.max(qn.length, cn.length);
            if (shorter >= 4) cross = Math.max(cross, Math.round(70 + (shorter / longer) * 25));
          }
        }
      }
      if (cross >= 100) break;
    }
    const latinKey = toLatinDrugKey(query);
    if (latinKey && c) {
      if (latinKey === c) cross = 100;
      else {
        const maxL = Math.max(latinKey.length, c.length) || 1;
        const sim = 1 - levenshtein(latinKey, c) / maxL;
        if (sim >= 0.8) cross = Math.max(cross, Math.round(sim * 100));
      }
    }
    if (cross >= 85) return Math.min(100, cross);
  }

  const qCore = stripDoseTokens(q);
  const cCore = stripDoseTokens(c);
  if (qCore && cCore && qCore === cCore) return 96;

  const shorter = q.length <= c.length ? q : c;
  const longer = q.length <= c.length ? c : q;
  let containment = 0;
  if (longer.includes(shorter) && shorter.length >= 3) {
    containment = 70 + Math.min(20, Math.floor((shorter.length / longer.length) * 20));
  }
  if (qCore && cCore && qCore.length >= 3) {
    const sc = qCore.length <= cCore.length ? qCore : cCore;
    const lc = qCore.length <= cCore.length ? cCore : qCore;
    if (lc.includes(sc)) {
      containment = Math.max(containment, 72 + Math.min(18, Math.floor((sc.length / lc.length) * 18)));
    }
  }

  const jac = tokenJaccard(query, candidate);
  const maxLen = Math.max(q.length, c.length) || 1;
  const charSim = 1 - levenshtein(q, c) / maxLen;
  const qt = qCore.split(" ")[0] || q.split(" ")[0] || "";
  const ct = cCore.split(" ")[0] || c.split(" ")[0] || "";
  let tokenBoost = 0;
  if (qt.length >= 3 && ct.length >= 3) {
    if (qt === ct) tokenBoost = 10;
    else if (qt.startsWith(ct) || ct.startsWith(qt)) tokenBoost = 6;
  }

  let score = jac * 50 + charSim * 40 + tokenBoost;
  score = Math.max(score, containment);
  if (/[\u0600-\u06FF]/.test(query) && /[\u0600-\u06FF]/.test(candidate) && score >= 40) {
    score = Math.min(100, score + 5);
  }
  if (q.length <= 2 && c.length > 6) score *= 0.5;

  if (hasArabicScript(query) || hasArabicScript(candidate)) {
    const latinQ = toLatinDrugKey(query);
    const latinC = toLatinDrugKey(candidate);
    if (latinQ && latinC) {
      if (latinQ === latinC) score = Math.max(score, 100);
      else {
        const maxL = Math.max(latinQ.length, latinC.length) || 1;
        const sim = 1 - levenshtein(latinQ, latinC) / maxL;
        if (sim >= 0.8) score = Math.max(score, sim * 100);
      }
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

export const fuzzyScore = arabicFuzzyScore;

export type FuzzyNameFields = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
};

export function scoreProductFields(
  query: string,
  product: FuzzyNameFields,
): { score: number; matchedOn: "name_en" | "name_ar" | "scientific_name" | "" } {
  let best = 0;
  let matchedOn: "name_en" | "name_ar" | "scientific_name" | "" = "";
  const fields: Array<["name_en" | "name_ar" | "scientific_name", string | null | undefined]> = [
    ["name_en", product.name_en],
    ["name_ar", product.name_ar],
    ["scientific_name", product.scientific_name],
  ];
  for (const [field, val] of fields) {
    if (!val) continue;
    const s = arabicFuzzyScore(query, val);
    if (s > best) {
      best = s;
      matchedOn = field;
    }
  }
  return { score: best, matchedOn };
}

export function resolveCatalogByName<
  T extends FuzzyNameFields & { is_synthetic?: boolean },
>(
  query: string,
  candidates: T[],
  opts?: { minScore?: number; preferLive?: boolean },
): { candidate: T; score: number; matchedOn: string } | null {
  const minScore = opts?.minScore ?? 55;
  let best: { candidate: T; score: number; matchedOn: string } | null = null;
  for (const item of candidates) {
    const { score, matchedOn } = scoreProductFields(query, item);
    if (score < minScore) continue;
    if (!best || score > best.score) {
      best = { candidate: item, score, matchedOn };
    } else if (
      best &&
      opts?.preferLive !== false &&
      Math.abs(score - best.score) <= 8 &&
      best.candidate.is_synthetic &&
      !item.is_synthetic
    ) {
      best = { candidate: item, score, matchedOn };
    }
  }
  return best;
}
