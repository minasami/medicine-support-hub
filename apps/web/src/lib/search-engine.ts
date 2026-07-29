/**
 * Medicine Search Engine Core Utilities & Dataset Matcher
 */

export interface SearchableMedicine {
  canonical_id?: number;
  name_en?: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  category?: string;
  drug_class?: string;
  dosage_form?: string;
  barcode?: string;
  code?: string;
  current_price_egp?: number;
  image_url?: string;
}

export function normalizeSearchTerm(term: string): string {
  if (!term) return "";
  return term
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // remove arabic diacritics
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, "")
    .replace(/co$|company$|pharmaceuticals$|pharma$|industries$|laboratories$|labs$|egypt$/g, "");
}

/**
 * Calculates string similarity using Levenshtein distance for fuzzy typo matching.
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenA; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[lenB][lenA];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matchReason: string;
}

/**
 * Merges custom product updates and new products saved in browser localStorage
 * so that edits made by representatives/CEOs reflect immediately in search results.
 */
export function applyLocalProductUpdates<T extends Record<string, any>>(items: T[]): T[] {
  if (typeof window === "undefined") return items;

  try {
    const customMap = new Map<number, any>();

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("company_portfolio_updates") || k === "all_custom_medicine_updates" || k.startsWith("medicine_update_"))) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item && item.canonical_id) {
                  customMap.set(Number(item.canonical_id), item);
                }
              }
            } else if (parsed && parsed.canonical_id) {
              customMap.set(Number(parsed.canonical_id), parsed);
            }
          }
        } catch {}
      }
    }

    if (customMap.size === 0) return items;

    const result = items.map((item) => {
      const cid = Number(item.canonical_id || (item as any).id);
      if (customMap.has(cid)) {
        const update = customMap.get(cid);
        customMap.delete(cid);
        return {
          ...item,
          ...update,
          name_en: update.name_en || item.name_en,
          name_ar: update.name_ar || item.name_ar,
          current_price_egp:
            update.current_price_egp !== undefined && update.current_price_egp !== null && update.current_price_egp !== ""
              ? Number(update.current_price_egp)
              : item.current_price_egp,
          scientific_name: update.scientific_name || item.scientific_name,
          manufacturer: update.manufacturer || item.manufacturer,
          category: update.category || item.category,
          drug_class: update.drug_class || item.drug_class,
          route: update.route || item.route,
          image_url: update.image_url || item.image_url,
          barcode: update.barcode || item.barcode,
          code: update.code || item.code,
        };
      }
      return item;
    });

    for (const [, newProd] of customMap) {
      result.unshift({
        canonical_id: Number(newProd.canonical_id),
        name_en: newProd.name_en || "",
        name_ar: newProd.name_ar || "",
        scientific_name: newProd.scientific_name || "",
        manufacturer: newProd.manufacturer || "",
        drug_class: newProd.drug_class || "",
        route: newProd.route || "",
        category: newProd.category || "",
        image_url: newProd.image_url || "",
        barcode: newProd.barcode || "",
        code: newProd.code || "",
        current_price_egp: Number(newProd.current_price_egp || 0),
        ...newProd,
      } as unknown as T);
    }

    return result;
  } catch {
    return items;
  }
}

export function searchCollection<T extends SearchableMedicine>(
  items: T[],
  query: string
): SearchResult<T>[] {
  const updatedItems = applyLocalProductUpdates(items);
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery) {
    return updatedItems.map((item) => ({ item, score: 100, matchReason: "default" }));
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  const results: SearchResult<T>[] = [];

  for (const item of updatedItems) {
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
            score += 20;
            tokenMatched = true;
            if (!matchReason) matchReason = "fuzzy_typo";
            break;
          }
        }
      }

      if (tokenMatched) tokenMatches++;
    }

    // Boost items that matched all query tokens
    if (queryTokens.length > 1 && tokenMatches === queryTokens.length) {
      score += 50;
    }

    if (score > 0) {
      results.push({
        item,
        score,
        matchReason: matchReason || "partial_match",
      });
    }
  }

  // Sort by highest match score first
  return results.sort((a, b) => b.score - a.score);
}
