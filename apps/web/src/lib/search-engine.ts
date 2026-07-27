/**
 * Universal Intelligent Search Engine for Medicine Support Hub
 * Provides Arabic & English normalization, fuzzy typo tolerance, multi-field matching, and weighted relevance scoring.
 */

export function normalizeSearchTerm(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    // Normalize Arabic letters
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/[\u064B-\u0652]/g, "") // Remove Arabic diacritics
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ") // Clean special punctuation except letters/numbers
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates a Levenshtein distance-based similarity ratio (0 to 1) for typo tolerance
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return 0.0;
  if (lenB === 0) return 0.0;

  const matrix: number[][] = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) matrix[i][0] = i;
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(lenA, lenB);
  return 1 - matrix[lenA][lenB] / maxLen;
}

export interface SearchableMedicine {
  canonical_id?: number | string;
  name_en?: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  category?: string;
  drug_class?: string;
  dosage_form?: string;
  barcode?: string;
  code?: string;
  [key: string]: any;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matchReason: string;
}

export function searchCollection<T extends SearchableMedicine>(
  items: T[],
  query: string
): SearchResult<T>[] {
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery) {
    return items.map((item) => ({ item, score: 100, matchReason: "default" }));
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const nameEnNorm = normalizeSearchTerm(item.name_en || "");
    const nameArNorm = normalizeSearchTerm(item.name_ar || "");
    const sciNorm = normalizeSearchTerm(item.scientific_name || "");
    const mfgNorm = normalizeSearchTerm(item.manufacturer || "");
    const catNorm = normalizeSearchTerm(item.category || item.drug_class || "");
    const formNorm = normalizeSearchTerm(item.dosage_form || "");
    const barcodeNorm = (item.barcode || item.code || "").toString().toLowerCase().trim();

    let score = 0;
    let matchReason = "";

    // 1. Exact or Prefix Matches on English or Arabic Name (Highest Priority)
    if (nameEnNorm === normalizedQuery || nameArNorm === normalizedQuery) {
      score += 200;
      matchReason = "exact_name";
    } else if (nameEnNorm.startsWith(normalizedQuery) || nameArNorm.startsWith(normalizedQuery)) {
      score += 150;
      matchReason = "prefix_name";
    } else if (nameEnNorm.includes(normalizedQuery) || nameArNorm.includes(normalizedQuery)) {
      score += 110;
      matchReason = "substring_name";
    }

    // 2. Barcode or Code Exact Match
    if (barcodeNorm && barcodeNorm.includes(normalizedQuery)) {
      score += 180;
      matchReason = "barcode_match";
    }

    // 3. Multi-token Matching across all fields
    let tokenMatches = 0;
    for (const token of queryTokens) {
      let tokenMatched = false;

      if (nameEnNorm.includes(token) || nameArNorm.includes(token)) {
        score += 40;
        tokenMatched = true;
      }
      if (sciNorm.includes(token)) {
        score += 35;
        tokenMatched = true;
        if (!matchReason) matchReason = "scientific_name";
      }
      if (catNorm.includes(token)) {
        score += 25;
        tokenMatched = true;
        if (!matchReason) matchReason = "category";
      }
      if (mfgNorm.includes(token)) {
        score += 20;
        tokenMatched = true;
        if (!matchReason) matchReason = "manufacturer";
      }
      if (formNorm.includes(token)) {
        score += 15;
        tokenMatched = true;
      }

      // Fuzzy Typo Tolerance fallback if token didn't match directly
      if (!tokenMatched && token.length >= 4) {
        const words = `${nameEnNorm} ${nameArNorm} ${sciNorm} ${mfgNorm}`.split(" ");
        for (const word of words) {
          if (word.length >= 4 && stringSimilarity(token, word) >= 0.75) {
            score += 30;
            tokenMatched = true;
            matchReason = "fuzzy_typo_match";
            break;
          }
        }
      }

      if (tokenMatched) tokenMatches++;
    }

    // Bonus for matching all tokens in query
    if (tokenMatches === queryTokens.length) {
      score += 50;
    }

    if (score > 0) {
      results.push({ item, score, matchReason: matchReason || "token_match" });
    }
  }

  // Sort descending by relevance score
  return results.sort((a, b) => b.score - a.score);
}
