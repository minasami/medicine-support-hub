/**
 * Re-rank medicine list hits for a text query.
 * Appwrite fulltext order is not relevance-sorted; exact/prefix matches
 * should appear first on mobile and desktop.
 */

export type RankableMedicine = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lower score = better. */
export function medicineQueryScore(
  item: RankableMedicine,
  query: string,
): number {
  const q = norm(query);
  if (!q) return 500;

  const en = norm(String(item.name_en || ""));
  const ar = String(item.name_ar || "").trim();
  const sci = norm(String(item.scientific_name || ""));
  const mfr = norm(String(item.manufacturer || ""));
  const bar = String(item.barcode || "").replace(/\s/g, "");

  if (en && en === q) return 0;
  if (ar && ar === query.trim()) return 1;
  if (en && en.startsWith(q + " ")) return 10;
  if (en && en.startsWith(q)) return 15;
  if (sci && sci === q) return 20;
  if (sci && sci.startsWith(q)) return 25;
  if (bar && bar === q.replace(/\s/g, "")) return 5;

  // whole-word token match on trade name
  const tokens = en.split(" ").filter(Boolean);
  if (tokens.some((t) => t === q)) return 30;
  if (tokens.some((t) => t.startsWith(q))) return 40;

  if (en.includes(q)) return 50;
  if (sci.includes(q)) return 60;
  if (mfr.includes(q)) return 70;
  if (ar.includes(query.trim())) return 55;

  return 100;
}

export function rankMedicineResults<T extends RankableMedicine>(
  items: T[],
  query: string,
): T[] {
  const q = (query || "").trim();
  if (!q || !items?.length) return items || [];

  return [...items].sort((a, b) => {
    const sa = medicineQueryScore(a, q);
    const sb = medicineQueryScore(b, q);
    if (sa !== sb) return sa - sb;
    const na = String(a.name_en || "");
    const nb = String(b.name_en || "");
    // shorter trade name first among equal score (CONCOR before CONCOR COR)
    if (sa <= 15 && na.length !== nb.length) return na.length - nb.length;
    return na.localeCompare(nb);
  });
}
