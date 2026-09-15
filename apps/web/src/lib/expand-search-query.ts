/**
 * Generate alternate spellings for catalog search.
 * Appwrite fulltext does not fuzzy-match; common TCA / INN / brand typos
 * and Arabic alef/hamza variants need explicit query probes.
 *
 * Limits (document for callers):
 * - At most EXPAND_MAX variants returned (default 10)
 * - Prefix probes only for len >= 6
 * - Brand/INN alias map is small & intentional (hot Egypt brands)
 */

import { expandQueryVariants, hasArabicScript } from "./arabic-transliterate";
import { normalizeArabicDrugName } from "./arabic-fuzzy-match";
import { normalizeSearchKey } from "./search-normalize";

export const EXPAND_MAX = 10;

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = x.trim();
    if (!t) continue;
    const k = normalizeSearchKey(t) || t.toLowerCase();
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
 * Frequent Egypt trade-name typos / near-misses → preferred catalog form.
 * Keys are lowercase normalized Latin; values are preferred search probes.
 */
const BRAND_ALIASES: Record<string, string[]> = {
  congesta: ["congestal"],
  congestol: ["congestal"],
  congestall: ["congestal"],
  kongestal: ["congestal"],
  concor: ["concor"],
  concoer: ["concor"],
  concour: ["concor"],
  konkor: ["concor"],
  panadol: ["panadol", "paracetamol"],
  panadole: ["panadol"],
  brufen: ["brufen", "ibuprofen"],
  brufin: ["brufen"],
  voltaren: ["voltaren", "diclofenac"],
  voltarin: ["voltaren"],
  cataflam: ["cataflam", "diclofenac"],
  augmentin: ["augmentin"],
  agumentin: ["augmentin"],
  zithro: ["zithromax", "azithromycin"],
  zithromax: ["zithromax"],
  flagyl: ["flagyl", "metronidazole"],
  flagil: ["flagyl"],
  glucophage: ["glucophage", "metformin"],
  glucofage: ["glucophage"],
  congestral: ["congestal"],
  antinal: ["antinal"],
  antenal: ["antinal"],
  buscopan: ["buscopan"],
  buscoban: ["buscopan"],
  neurontin: ["neurontin", "gabapentin"],
  lyrica: ["lyrica", "pregabalin"],
  lipitor: ["lipitor", "atorvastatin"],
  crestor: ["crestor", "rosuvastatin"],
  plavix: ["plavix", "clopidogrel"],
  xanax: ["xanax", "alprazolam"],
  cipralex: ["cipralex", "escitalopram"],
  cipralx: ["cipralex"],
};

function brandAliasHits(term: string): string[] {
  const key = normalizeSearchKey(term).replace(/\s+/g, "");
  if (!key) return [];
  const out: string[] = [];
  if (BRAND_ALIASES[key]) out.push(...BRAND_ALIASES[key]);
  // Prefix alias: "congesta…" → congestal when key starts with known typo stem
  for (const [typo, targets] of Object.entries(BRAND_ALIASES)) {
    if (typo.length >= 5 && (key.startsWith(typo) || typo.startsWith(key))) {
      out.push(...targets);
    }
  }
  return out;
}

/**
 * Returns original term first, then corrected / truncated / AR-normalized
 * variants for waterfall search (fulltext + startsWith).
 */
export function expandSearchQuery(raw: string, max = EXPAND_MAX): string[] {
  const term = (raw || "").trim();
  if (!term) return [];

  const variants: string[] = [term];

  for (const { re, to } of INN_FIXUPS) {
    if (re.test(term)) {
      variants.push(to);
      variants.push(to.charAt(0).toUpperCase() + to.slice(1));
    }
  }

  for (const alias of brandAliasHits(term)) {
    variants.push(alias);
    variants.push(alias.charAt(0).toUpperCase() + alias.slice(1));
  }

  const lower = term.toLowerCase();

  if (/tryptalin/i.test(lower)) {
    variants.push(lower.replace(/tryptalin\w*/i, "triptyline"));
  }
  if (/triptylin$/i.test(lower)) {
    variants.push(`${lower}e`);
  }

  // Arabic-aware: normalized form + Latin dict expansions
  const arNorm = normalizeArabicDrugName(term);
  if (arNorm && arNorm !== term.toLowerCase()) {
    variants.push(arNorm);
  }
  if (hasArabicScript(term)) {
    for (const v of expandQueryVariants(term).slice(0, 4)) {
      variants.push(v);
    }
  }

  // Prefix probes (helps partial type-in and mild typos)
  if (term.length >= 6) {
    variants.push(term.slice(0, 8));
    variants.push(term.slice(0, 6));
  }
  if (term.length >= 10) {
    variants.push(term.slice(0, 10));
  }

  const compact = term.replace(/[\s-]+/g, "");
  if (compact !== term) variants.push(compact);

  return uniq(variants).slice(0, max);
}

/** Preferred corrected display form when an alias/INN fixup fires. */
export function preferredCorrection(raw: string): string | null {
  const term = (raw || "").trim();
  if (!term) return null;
  for (const { re, to } of INN_FIXUPS) {
    if (re.test(term) && normalizeSearchKey(to) !== normalizeSearchKey(term)) {
      return to.charAt(0).toUpperCase() + to.slice(1);
    }
  }
  const aliases = brandAliasHits(term);
  if (
    aliases.length &&
    normalizeSearchKey(aliases[0]) !== normalizeSearchKey(term)
  ) {
    const a = aliases[0];
    return a.charAt(0).toUpperCase() + a.slice(1);
  }
  return null;
}
