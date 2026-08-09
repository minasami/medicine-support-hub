/**
 * Generate alternate spellings for catalog search.
 * Appwrite fulltext does not fuzzy-match; common TCA / INN typos
 * (e.g. Nortryptalin → Nortriptyline) need explicit variants.
 */

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = x.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Known pharma misspelling → preferred form (lowercase). */
const INN_FIXUPS: Array<{ re: RegExp; to: string }> = [
  { re: /nortryptalin\w*/i, to: "nortriptyline" },
  { re: /nortriptylin(?!e)/i, to: "nortriptyline" },
  { re: /amitryptilin\w*/i, to: "amitriptyline" },
  { re: /amitriptylin(?!e)/i, to: "amitriptyline" },
  { re: /imipramin(?!e)/i, to: "imipramine" },
  { re: /clomipramin(?!e)/i, to: "clomipramine" },
  { re: /paracetamole?/i, to: "paracetamol" },
  { re: /acetaminophin/i, to: "acetaminophen" },
  { re: /amoxycillin/i, to: "amoxicillin" },
  { re: /amoxcillin/i, to: "amoxicillin" },
  { re: /omeprezole/i, to: "omeprazole" },
  { re: /omeprazol(?!e)/i, to: "omeprazole" },
  { re: /metformine/i, to: "metformin" },
  { re: /atorvastatine/i, to: "atorvastatin" },
  { re: /bisoprolol\s*fumarate/i, to: "bisoprolol" },
];

/**
 * Returns original term first, then corrected / truncated variants
 * for waterfall search (fulltext + startsWith).
 */
export function expandSearchQuery(raw: string): string[] {
  const term = (raw || "").trim();
  if (!term) return [];

  const variants: string[] = [term];

  for (const { re, to } of INN_FIXUPS) {
    if (re.test(term)) {
      variants.push(to);
      // Preserve capitalization style of first letter
      variants.push(to.charAt(0).toUpperCase() + to.slice(1));
    }
  }

  const lower = term.toLowerCase();

  // -tyline / -tryptalin family
  if (/tryptalin/i.test(lower)) {
    variants.push(lower.replace(/tryptalin\w*/i, "triptyline"));
  }
  if (/triptylin$/i.test(lower)) {
    variants.push(`${lower}e`);
  }

  // Prefix probes (helps partial type-in and mild typos)
  if (term.length >= 6) {
    variants.push(term.slice(0, 8));
    variants.push(term.slice(0, 6));
  }
  if (term.length >= 10) {
    variants.push(term.slice(0, 10));
  }

  // Collapse internal spaces / hyphens for barcode-like tokens
  const compact = term.replace(/[\s-]+/g, "");
  if (compact !== term) variants.push(compact);

  return uniq(variants).slice(0, 8);
}
