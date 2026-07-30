export interface SearchableMedicine {
  canonical_id?: number;
  name_en?: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  category?: string;
  drug_class?: string;
  route?: string;
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
    .replace(/[\u064B-\u0652]/g, "")
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

export interface SearchResult<T> {
  item: T;
  score: number;
  matchReason: string;
}

function normalizeCodeKey(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

/**
 * Merges custom product updates and manufacturer stock imports so representative
 * uploads reflect in search by canonical_id and by product code.
 */
export function applyLocalProductUpdates<T extends Record<string, any>>(items: T[]): T[] {
  if (typeof window === "undefined") return items;

  try {
    const byId = new Map<number, any>();
    const byCode = new Map<string, any>();

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        !k ||
        !(k.startsWith("company_portfolio_updates") ||
          k === "all_custom_medicine_updates" ||
          k.startsWith("medicine_update_") ||
          k.startsWith("company_stock_import_"))
      ) {
        continue;
      }
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.rows)
            ? parsed.rows
            : parsed && typeof parsed === "object"
              ? [parsed]
              : [];
        for (const item of list) {
          if (!item) continue;
          if (item.canonical_id) byId.set(Number(item.canonical_id), item);
          const code = normalizeCodeKey(item.code || item.item_code || "");
          if (code) byCode.set(code, item);
        }
      } catch {}
    }

    // Also merge durable stock lots mirror if present
    try {
      const lotsRaw = localStorage.getItem("msh_manufacturer_stock_lots_v1");
      if (lotsRaw) {
        const lots = JSON.parse(lotsRaw);
        if (Array.isArray(lots)) {
          for (const lot of lots) {
            if (lot?.canonical_id) {
              byId.set(Number(lot.canonical_id), {
                canonical_id: Number(lot.canonical_id),
                name_en: lot.item_desc,
                code: lot.item_code,
                current_price_egp: lot.list_price_egp,
                source: "manufacturer_stock_csv",
              });
            }
            const code = normalizeCodeKey(lot?.item_code || "");
            if (code) {
              byCode.set(code, {
                name_en: lot.item_desc,
                code: lot.item_code,
                current_price_egp: lot.list_price_egp,
                canonical_id: lot.canonical_id,
              });
            }
          }
        }
      }
    } catch {}

    if (byId.size === 0 && byCode.size === 0) return items;

    const result = items.map((item) => {
      const cid = Number(item.canonical_id || (item as any).id);
      const code = normalizeCodeKey(item.code || "");
      const update =
        (cid && byId.get(cid)) || (code && byCode.get(code)) || null;
      if (!update) return item;
      if (cid) byId.delete(cid);
      if (code) byCode.delete(code);
      return {
        ...item,
        ...update,
        name_en: update.name_en || item.name_en,
        name_ar: update.name_ar || item.name_ar,
        current_price_egp:
          update.current_price_egp !== undefined &&
          update.current_price_egp !== null &&
          update.current_price_egp !== ""
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
    });

    for (const [, newProd] of byId) {
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

  return results.sort((a, b) => b.score - a.score);
}
