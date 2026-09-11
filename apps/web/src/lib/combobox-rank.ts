/**
 * Rank searchable-combobox options: exact > prefix > word-prefix > contains.
 * Prefer short/standalone labels over long combination strings.
 */

export type ComboboxOption = { label: string; value: string; meta?: string };

function normalize(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Higher is better. Negative means no match when query is non-empty. */
export function scoreComboboxOption(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q) {
    // Prefer shorter standalone APIs when browsing unfiltered
    const comboPenalty =
      (l.match(/[+\/&,;|]/g) || []).length * 8 + Math.max(0, l.length - 48);
    return Math.max(0, 200 - comboPenalty);
  }
  if (l === q) return 10_000;
  if (l.startsWith(q + " ") || l.startsWith(q)) {
    return 8_000 - Math.min(l.length, 500);
  }
  const words = l.split(/[\s,+/&;|()\-]+/).filter(Boolean);
  if (words.some((w) => w === q)) return 7_000 - Math.min(l.length, 500);
  if (words.some((w) => w.startsWith(q))) return 6_000 - Math.min(l.length, 500);
  const idx = l.indexOf(q);
  if (idx >= 0) {
    const comboPenalty =
      (l.match(/[+\/&,;|]/g) || []).length * 40 + Math.max(0, l.length - 36);
    return 4_000 - idx - comboPenalty;
  }
  return -1;
}

export function filterAndRankComboboxOptions<T extends ComboboxOption>(
  options: T[],
  query: string,
  limit = 80,
): T[] {
  const scored = options
    .map((opt) => ({ opt, score: scoreComboboxOption(query, opt.label || opt.value) }))
    .filter((row) => row.score >= 0);
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.opt.label || "").localeCompare(b.opt.label || "");
  });
  return scored.slice(0, limit).map((row) => row.opt);
}
