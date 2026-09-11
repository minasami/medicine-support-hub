/**
 * Parse / join scientific active ingredients for combo products.
 * Storage remains a single string (e.g. "Paracetamol + Caffeine").
 */

const SPLIT_RE = /\s*(?:\+|\/|&|;|\||\band\b)\s*/i;

export function parseScientificIngredients(raw: string): string[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s
    .split(SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);
  // De-dupe case-insensitively while preserving first spelling
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function joinScientificIngredients(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const trimmed = String(p || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.join(" + ");
}
