/**
 * Unicode normalization helpers for drug-name matching.
 *
 * Pipeline:
 *  1. NFKC — compatibility decomposition + canonical composition
 *  2. Strip default-ignorable / format chars (ZWJ, ZWNJ, BOM, bidi marks)
 *  3. Unify compatibility / presentation forms via NFKC
 *  4. Collapse Unicode spaces (Zscode) to U+0020
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
