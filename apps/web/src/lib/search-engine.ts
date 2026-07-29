import {
  type SearchableMedicine,
  type SearchResult,
  calculateMatchScore,
  normalizeSearchTerm,
} from "./search-rules";

export type { SearchableMedicine, SearchResult } from "./search-rules";

export function normalizeCompanyName(company: string): string {
  if (!company) return "";

  let cleaned = company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

  const removeSuffixes = [
    "co",
    "company",
    "inc",
    "ltd",
    "llc",
    "corp",
    "corporation",
    "pharma",
    "pharmaceutical",
    "pharmaceuticals",
    "laboratories",
    "labs",
    "industries",
    "group",
    "egypt",
    "sae",
  ];

  const words = cleaned.split(" ").filter((w) => w.length > 0);
  const filteredWords = words.filter((w) => !removeSuffixes.includes(w));

  return filteredWords.length > 0 ? filteredWords.join(" ") : cleaned;
}

export function calculateCompanyRelevance(
  targetCompany: string,
  candidateCompany: string,
): { isMatch: boolean; score: number; matchType: string } {
  if (!targetCompany || !candidateCompany) {
    return { isMatch: false, score: 0, matchType: "none" };
  }

  const targetClean = targetCompany.toLowerCase().trim();
  const candidateClean = candidateCompany.toLowerCase().trim();

  if (targetClean === candidateClean) {
    return { isMatch: true, score: 1.0, matchType: "exact" };
  }

  const targetNorm = normalizeCompanyName(targetCompany);
  const candidateNorm = normalizeCompanyName(candidateCompany);

  if (targetNorm && candidateNorm && targetNorm === candidateNorm) {
    return { isMatch: true, score: 0.95, matchType: "normalized_exact" };
  }

  if (
    targetNorm &&
    candidateNorm &&
    (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm))
  ) {
    return { isMatch: true, score: 0.85, matchType: "contains" };
  }

  const targetWords = targetNorm.split(" ").filter((w) => w.length > 2);
  const candidateWords = candidateNorm.split(" ").filter((w) => w.length > 2);

  if (targetWords.length > 0 && candidateWords.length > 0) {
    const matchingWords = targetWords.filter((w) =>
      candidateWords.includes(w),
    );
    if (matchingWords.length > 0) {
      const score = 0.5 + (matchingWords.length / targetWords.length) * 0.3;
      return { isMatch: true, score, matchType: "word_overlap" };
    }
  }

  return { isMatch: false, score: 0, matchType: "none" };
}

export function applyLocalProductUpdates<T extends SearchableMedicine>(
  items: T[],
): T[] {
  if (typeof window === "undefined") return items;

  try {
    const customMap = new Map<number, any>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("company_portfolio_updates") ||
          key === "all_custom_medicine_updates" ||
          key.startsWith("medicine_update_"))
      ) {
        try {
          const raw = localStorage.getItem(key);
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

    // Final Deduplication by normalized product name so "TUSSLES" and "Tussles" don't duplicate
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
    const { score, matchReason, matchedTerms } = calculateMatchScore(
      item,
      normalizedQuery,
      queryTokens
    );

    if (score > 0) {
      results.push({
        item,
        score,
        matchReason,
        matchedTerms,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
