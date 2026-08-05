/**
 * Arabic-aware normalization and fuzzy matching for drug trade names.
 *
 * Handles:
 * - Alef variants (أ إ آ ٱ → ا)
 * - Taa marbuta / haa (ة → ه)
 * - Alef maqsura (ى → ي)
 * - Tashkeel / diacritics removal
 * - Tatweel
 * - Optional definite article "ال"
 * - Token Jaccard + edit-distance similarity
 */

export function normalizeArabicDrugName(input: string): string {
  if (!input) return "";
  let s = String(input).normalize("NFC").toLowerCase().trim();

  // Remove tashkeel (diacritics) and Quranic marks
  s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  // Tatweel
  s = s.replace(/\u0640/g, "");

  // Alef variants → bare alef
  s = s.replace(/[أإآٱ]/g, "ا");
  // Taa marbuta → haa
  s = s.replace(/ة/g, "ه");
  // Alef maqsura → yaa
  s = s.replace(/ى/g, "ي");
  // Waw with hamza
  s = s.replace(/[ؤ]/g, "و");
  // Yaa with hamza
  s = s.replace(/[ئ]/g, "ي");

  // Keep letters (Arabic + Latin), digits; collapse other to space
  s = s.replace(/[^a-z0-9\u0600-\u06ff\s]/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Strip leading definite article for Arabic tokens (ال)
  s = s
    .split(" ")
    .map((tok) => (tok.startsWith("ال") && tok.length > 3 ? tok.slice(2) : tok))
    .join(" ")
    .trim();

  return s;
}

/** Shared normalizer for EN + AR trade names (used by catalog + search). */
export function normalizeDrugNameForMatch(input: string): string {
  return normalizeArabicDrugName(input);
}

function levenshteinRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la > 48 || lb > 48) {
    const max = Math.max(la, lb);
    let same = 0;
    const min = Math.min(la, lb);
    for (let i = 0; i < min; i++) if (a[i] === b[i]) same++;
    return same / max;
  }
  const row = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) row[j] = j;
  for (let i = 1; i <= la; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  const dist = row[lb];
  return 1 - dist / Math.max(la, lb);
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length >= 2));
  const tb = new Set(b.split(" ").filter((t) => t.length >= 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

export type ArabicFuzzyResult = {
  score: number;
  method: "exact" | "prefix" | "substring" | "token" | "edit" | "none";
  normalizedQuery: string;
  normalizedCandidate: string;
};

/** Fuzzy score 0–100 for matching a wanted name against a candidate (Arabic or mixed). */
export function arabicFuzzyScore(
  wanted: string,
  candidate: string | null | undefined,
): ArabicFuzzyResult {
  const q = normalizeArabicDrugName(wanted);
  const c = normalizeArabicDrugName(candidate || "");
  if (!q || !c) {
    return { score: 0, method: "none", normalizedQuery: q, normalizedCandidate: c };
  }
  if (q === c) {
    return { score: 100, method: "exact", normalizedQuery: q, normalizedCandidate: c };
  }
  if (q.length >= 3 && c.length >= 3) {
    if (c.startsWith(q) || q.startsWith(c)) {
      return { score: 92, method: "prefix", normalizedQuery: q, normalizedCandidate: c };
    }
    if (c.includes(q) || q.includes(c)) {
      return { score: 78, method: "substring", normalizedQuery: q, normalizedCandidate: c };
    }
  }
  const jac = tokenJaccard(q, c);
  const edit = levenshteinRatio(q, c);
  const blended = 100 * (0.55 * jac + 0.45 * edit);
  if (blended >= 55) {
    return {
      score: Math.round(blended),
      method: jac >= edit ? "token" : "edit",
      normalizedQuery: q,
      normalizedCandidate: c,
    };
  }
  const q0 = q.split(" ")[0] || "";
  const c0 = c.split(" ")[0] || "";
  if (q0.length >= 3 && c0.length >= 3) {
    if (q0 === c0) {
      return { score: 62, method: "token", normalizedQuery: q, normalizedCandidate: c };
    }
    const tEdit = levenshteinRatio(q0, c0);
    if (tEdit >= 0.8) {
      return {
        score: Math.round(50 + 20 * tEdit),
        method: "edit",
        normalizedQuery: q,
        normalizedCandidate: c,
      };
    }
  }
  return { score: Math.round(blended), method: "none", normalizedQuery: q, normalizedCandidate: c };
}

export function bestArabicFuzzyMatch<
  T,
>(
  wanted: string,
  rows: T[],
  getName: (row: T) => (string | null | undefined)[],
  minScore = 55,
): { row: T; score: number; method: string } | null {
  let best: { row: T; score: number; method: string } | null = null;
  for (const row of rows) {
    let score = 0;
    let method = "none";
    for (const name of getName(row)) {
      const r = arabicFuzzyScore(wanted, name);
      if (r.score > score) {
        score = r.score;
        method = r.method;
      }
    }
    if (!best || score > best.score) {
      best = { row, score, method };
    }
  }
  if (!best || best.score < minScore) return null;
  return best;
}
