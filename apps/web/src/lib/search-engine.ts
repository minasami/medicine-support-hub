import { normalizeArabicDrugName } from "./arabic-fuzzy-match";

export interface SearchableMedicine {
  canonical_id?: number | null;
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  drug_class?: string | null;
  route?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  product_type?: string | null;
  barcode?: string | null;
  code?: string | null;
  current_price_egp?: number | null;
  image_url?: string | null;
  has_verified_dataset?: boolean;
}

export function normalizeSearchTerm(term: string): string {
  return normalizeArabicDrugName(term);
}

export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, "")
    .replace(/co$|company$|pharmaceuticals$|pharma$|industries$|laboratories$|labs$|egypt$/g, "");
}

export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= lenB; i++) matrix[i] = [i];
  for (let j = 0; j <= lenA; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const distance = matrix[lenB][lenA];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

export type SearchResult<T> = {
  item: T;
  score: number;
  matchReason: string;
};

export function applyLocalProductUpdates<T extends SearchableMedicine>(
  items: T[],
): T[] {
  if (typeof window === "undefined") return items;

  try {
    const raw = localStorage.getItem("msh_local_product_updates_v1");
    if (!raw) return items;

    const updatesMap = JSON.parse(raw);
    if (!updatesMap || typeof updatesMap !== "object") return items;

    const result = items.map((item) => {
      const canonicalId = item.canonical_id;
      if (!canonicalId) return item;

      const update = updatesMap[String(canonicalId)];
      if (!update) return item;

      return {
        ...item,
        ...update,
      };
    });

    const addedProducts = updatesMap["_new_products"];
    if (Array.isArray(addedProducts)) {
      for (const newProd of addedProducts) {
        if (!newProd || !newProd.canonical_id) continue;
        const exists = result.some(
          (p) => String(p.canonical_id) === String(newProd.canonical_id),
        );
        if (!exists) {
          result.push({
            ...newProd,
          } as unknown as T);
        }
      }
    }

    const seenNames = new Set<string>();
    const deduplicatedResult: T[] = [];
    for (const item of result) {
      const rawName = String((item as any).name_en || "").trim();
      const normKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!normKey || !seenNames.has(normKey)) {
        if (normKey) seenNames.add(normKey);
        deduplicatedResult.push(item);
      }
    }

    return deduplicatedResult;
  } catch {
    return items;
  }
}

export function searchCollection<T extends SearchableMedicine>(
  items: T[],
  query: string,
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

    if (barcodeNorm && barcodeNorm.includes(normalizedQuery)) {
      score += 180;
      matchReason = "barcode_match";
    }

    let tokenMatches = 0;
    let sciTokenHits = 0;
    let mfrTokenHits = 0;
    let nameTokenHits = 0;
    for (const token of queryTokens) {
      let tokenMatched = false;
      if (nameEnNorm.includes(token) || nameArNorm.includes(token)) {
        score += 40;
        tokenMatched = true;
        nameTokenHits++;
      }
      if (sciNorm.includes(token)) {
        score += 35;
        tokenMatched = true;
        sciTokenHits++;
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
        mfrTokenHits++;
        if (!matchReason) matchReason = "manufacturer";
      }
      if (formNorm.includes(token)) {
        score += 15;
        tokenMatched = true;
      }
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

    if (tokenMatches === queryTokens.length) {
      score += 30;
    }

    // Compound: active ingredient + company (any order) — strong boost
    if (queryTokens.length >= 2 && sciTokenHits >= 1 && mfrTokenHits >= 1) {
      score += 90;
      matchReason = "ingredient_company";
    } else if (queryTokens.length >= 2 && nameTokenHits >= 1 && mfrTokenHits >= 1) {
      score += 70;
      matchReason = "name_company";
    } else if (queryTokens.length >= 2 && sciTokenHits >= 1 && nameTokenHits >= 1) {
      score += 55;
      matchReason = "ingredient_name";
    }

    if (score > 0) {
      results.push({ item, score, matchReason: matchReason || "token_match" });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
