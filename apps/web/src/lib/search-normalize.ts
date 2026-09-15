/**
 * Unified EN + AR search-key normalization for catalog ranking.
 * Arabic: strip tashkeel/tatweel, collapse alef/hamza/yaa/taa marbuta, unify digits.
 * English: lower-case, strip punctuation, collapse spaces (via shared pipeline).
 */

import { normalizeUnicodeForMatch } from "./unicode-normalize";

const ARABIC_TASHKEEL = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_INDIC = /[\u0660-\u0669]/g;
const PUNCT = /[.,;:!?()[\]{}/\\|+=~`'"*_#@^<>]/g;
const DASHES = /[-\u2013\u2014_/]/g;

/** Canonical search key shared by ranker, expand, combobox, static fallback. */
export function normalizeSearchKey(input: string): string {
  let s = normalizeUnicodeForMatch(input || "");
  s = s
    .replace(ARABIC_TASHKEEL, "")
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // alef variants → ا
    .replace(/\u0649/g, "\u064A") // alef maqsura → yaa
    .replace(/\u0629/g, "\u0647") // taa marbuta → haa
    .replace(/[\u0624\u0626\u0621]/g, "") // drop hamza forms
    .replace(ARABIC_INDIC, (d) =>
      String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)),
    )
    .replace(PUNCT, " ")
    .replace(DASHES, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s;
}

export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

/** Compact key (no spaces) for pharma edit-distance compares. */
export function compactSearchKey(input: string): string {
  return normalizeSearchKey(input).replace(/\s+/g, "");
}
