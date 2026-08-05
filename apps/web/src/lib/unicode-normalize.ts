/**
 * Unicode normalization helpers for drug-name matching.
 *
 * ## ICU / Unicode forms (UAX #15)
 *
 * | Form | Meaning                                      | Drug search use                          |
 * |------|----------------------------------------------|------------------------------------------|
 * | NFC  | Canonical decompose + compose                | Storage / display of general text        |
 * | NFD  | Canonical decompose only                     | Accent stripping pipelines               |
 * | NFKC | Compatibility decompose + canonical compose  | **Search keys** (ligatures, fullwidth)   |
 * | NFKD | Compatibility decompose only                 | Aggressive fold before custom compose    |
 *
 * ICU also exposes NFKC_Casefold (NFKC + case fold + default ignorables)
 * and FCD/FCC for collation. Browser JS only has the four standard forms
 * via String.prototype.normalize; we approximate NFKC_Casefold with:
 *   NFKC \u2192 strip ZWJ/ZWNJ/BOM/bidi \u2192 lowercase (in callers).
 *
 * **Why NFKC for pharmacy search:** pasted PDF/Word text often contains
 * fi/fl ligatures, fullwidth digits, NBSP, and Arabic presentation forms.
 * NFKC collapses those without destroying Arabic letters.
 *
 * Pipeline:
 *  1. NFKC
 *  2. Strip format / default-ignorable (ZWJ, ZWNJ, BOM, bidi marks)
 *  3. Collapse Unicode spaces (Zscode) to U+0020
 *  4. Strip variation selectors
 */

export type UnicodeNormForm = "NFC" | "NFD" | "NFKC" | "NFKD";

const DEFAULT_FORM: UnicodeNormForm = "NFKC";

export function unicodeNormalize(
  input: string,
  form: UnicodeNormForm = DEFAULT_FORM,
): string {
  const s = input ?? "";
  if (!s) return "";
  try {
    if (typeof s.normalize === "function") return s.normalize(form);
  } catch {
    /* invalid form or engine quirk */
  }
  return s;
}

const FORMAT_AND_IGNORABLE =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

export function normalizeUnicodeForMatch(input: string): string {
  let s = unicodeNormalize(input || "", "NFKC");
  s = s.replace(FORMAT_AND_IGNORABLE, "");
  s = s.replace(UNICODE_SPACES, " ");
  s = s.replace(/[\uFE00-\uFE0F]/g, "");
  return s;
}

export function unicodeIdentityKey(input: string): string {
  return normalizeUnicodeForMatch(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function unicodeEquals(a: string, b: string): boolean {
  return normalizeUnicodeForMatch(a) === normalizeUnicodeForMatch(b);
}

export function supportsUnicodeNormalize(): boolean {
  try {
    return typeof "".normalize === "function" && "\u00e9".normalize("NFD").length === 2;
  } catch {
    return false;
  }
}
