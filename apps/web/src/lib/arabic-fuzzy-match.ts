/**
 * Drug-name normalization + fuzzy matching (Arabic-first, Latin-safe).
 * Handles alef/taa/yeh variants, diacritics, dose tokens, token Jaccard + Levenshtein.
 * Thresholds: catalog >= 55, strict identity >= 85.
 */

export function stripArabicDiacritics(input: string): string {
  return (input || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArabicDrugName(input: string): string {
  let s = stripArabicDiacritics(input || "");
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئء]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[.,;:!?()[\]{}/\\|+*=~`'"]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s;
}

export const normalizeTradeName = normalizeArabicDrugName;

export function stripDoseTokens(normalized: string): string {
  return (normalized || "")
    .replace(/\b\d+([.,]\d+)?\s*(mg|mcg|µg|ug|g|ml|iu|i\.?u\.?|%)\b/gi, " ")
    .replace(/\d+([.,]\d+)?\s*(مجم|ملغ|ملغرام|مل|وحدة|قرص|اقراص|كبسوله|كبسولة|كبسولات)/g, " ")
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
    else {
      const tMax = Math.max(qt.length, ct.length);
      const tSim = 1 - levenshtein(qt, ct) / tMax;
      if (tSim >= 0.8) tokenBoost = 5;
    }
  }
  let score = jac * 50 + charSim * 40 + tokenBoost;
  score = Math.max(score, containment);
  const qAr = /[\u0600-\u06FF]/.test(query);
  const cAr = /[\u0600-\u06FF]/.test(candidate);
  if (qAr && cAr && score >= 40) score = Math.min(100, score + 5);
  if (q.length <= 2 && c.length > 6) score *= 0.5;
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

export function bestArabicFuzzyMatch<T>(
  query: string,
  items: T[],
  getName: (item: T) => string | null | undefined,
  minScore = 55,
): { item: T; score: number; name: string } | null {
  let best: { item: T; score: number; name: string } | null = null;
  for (const item of items) {
    const name = (getName(item) || "").trim();
    if (!name) continue;
    const score = arabicFuzzyScore(query, name);
    if (score < minScore) continue;
    if (!best || score > best.score) best = { item, score, name };
  }
  return best;
}

export function rankProductFuzzyMatches<
  T extends FuzzyNameFields & { is_synthetic?: boolean },
>(
  query: string,
  items: T[],
  opts?: { minScore?: number; limit?: number; preferLive?: boolean; syntheticMargin?: number },
): Array<{ item: T; score: number; matchedOn: string }> {
  const minScore = opts?.minScore ?? 55;
  const limit = opts?.limit ?? 20;
  const preferLive = opts?.preferLive !== false;
  const syntheticMargin = opts?.syntheticMargin ?? 8;
  const out: Array<{ item: T; score: number; matchedOn: string }> = [];
  for (const item of items) {
    const { score, matchedOn } = scoreProductFields(query, item);
    if (score >= minScore) out.push({ item, score, matchedOn });
  }
  out.sort((a, b) => {
    if (preferLive) {
      const aSyn = a.item.is_synthetic ? 1 : 0;
      const bSyn = b.item.is_synthetic ? 1 : 0;
      if (aSyn !== bSyn && Math.abs(a.score - b.score) <= syntheticMargin) return aSyn - bSyn;
    }
    return b.score - a.score;
  });
  if (preferLive && out.length > 1 && out[0].item.is_synthetic) {
    const liveIdx = out.findIndex((s) => !s.item.is_synthetic);
    if (liveIdx > 0 && out[liveIdx].score >= out[0].score - syntheticMargin) {
      const [live] = out.splice(liveIdx, 1);
      out.unshift(live);
    }
  }
  return out.slice(0, limit);
}

export function rankArabicFuzzyMatches<T>(
  query: string,
  items: T[],
  getName: (item: T) => string | null | undefined,
  minScore = 55,
  limit = 20,
): Array<{ item: T; score: number; name: string }> {
  const out: Array<{ item: T; score: number; name: string }> = [];
  for (const item of items) {
    const name = (getName(item) || "").trim();
    if (!name) continue;
    const score = arabicFuzzyScore(query, name);
    if (score >= minScore) out.push({ item, score, name });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export function resolveCatalogByName<
  T extends FuzzyNameFields & { is_synthetic?: boolean },
>(
  query: string,
  candidates: T[],
  opts?: { minScore?: number; preferLive?: boolean },
): { candidate: T; score: number; matchedOn: string } | null {
  const ranked = rankProductFuzzyMatches(query, candidates, opts);
  if (!ranked.length) return null;
  const top = ranked[0];
  return { candidate: top.item, score: top.score, matchedOn: top.matchedOn };
}
