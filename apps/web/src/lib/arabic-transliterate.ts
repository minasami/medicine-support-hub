/**
 * Arabic \u2194 Latin transliteration for drug-name matching (Egypt / MENA).
 * Uses Unicode NFKC via unicode-normalize before dictionary / letter map.
 */

import { normalizeUnicodeForMatch } from "./unicode-normalize";

function normalizeKey(input: string): string {
  return normalizeUnicodeForMatch(input || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u0624\u0626\u0621]/g, "")
    .replace(/[\u0660-\u0669]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)))
    .replace(/[.,;:!?()\[\]{}/\\|+*=~`'"]/g, " ")
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ARABIC_DRUG_DICT: Record<string, string[]> = {
  "\u0627\u0633\u0628\u0631\u064A\u0646": ["aspirin", "acetylsalicylic acid", "asa"],
  "\u0628\u0627\u0631\u0627\u0633\u064A\u062A\u0627\u0645\u0648\u0644": ["paracetamol", "acetaminophen"],
  "\u0627\u064A\u0628\u0648\u0628\u0631\u0648\u0641\u064A\u0646": ["ibuprofen"],
  "\u062F\u064A\u0643\u0644\u0648\u0641\u064A\u0646\u0627\u0643": ["diclofenac"],
  "\u0627\u0645\u0648\u0643\u0633\u064A\u0633\u064A\u0644\u064A\u0646": ["amoxicillin", "amoxycillin"],
  "\u0627\u0645\u0648\u0643\u0633\u064A\u0643\u0644\u0627\u0641": ["co-amoxiclav", "amoxicillin + clavulanic acid"],
  "\u0627\u0645\u0628\u064A\u0633\u064A\u0644\u064A\u0646": ["ampicillin"],
  "\u0627\u0632\u064A\u062B\u0631\u0648\u0645\u0627\u064A\u0633\u064A\u0646": ["azithromycin"],
  "\u0633\u064A\u0628\u0631\u0648\u0641\u0644\u0648\u0643\u0633\u0627\u0633\u064A\u0646": ["ciprofloxacin"],
  "\u062F\u0648\u0643\u0633\u064A\u0633\u064A\u0643\u0644\u064A\u0646": ["doxycycline"],
  "\u0645\u064A\u062A\u0631\u0648\u0646\u064A\u062F\u0627\u0632\u0648\u0644": ["metronidazole"],
  "\u0633\u064A\u0641\u062A\u0631\u064A\u0627\u0643\u0633\u0648\u0646": ["ceftriaxone"],
  "\u0633\u064A\u0641\u0627\u0644\u0643\u0633\u064A\u0646": ["cefalexin", "cephalexin"],
  "\u0645\u064A\u062A\u0641\u0648\u0631\u0645\u064A\u0646": ["metformin"],
  "\u0627\u0646\u0633\u0648\u0644\u064A\u0646": ["insulin"],
  "\u062C\u0644\u064A\u0643\u0644\u0627\u0632\u064A\u062F": ["gliclazide"],
  "\u0633\u064A\u062A\u0627\u062C\u0644\u064A\u0628\u062A\u064A\u0646": ["sitagliptin"],
  "\u0627\u0645\u0644\u0648\u062F\u064A\u0628\u064A\u0646": ["amlodipine"],
  "\u0627\u062A\u0648\u0631\u0641\u0627\u0633\u062A\u0627\u062A\u064A\u0646": ["atorvastatin"],
  "\u0633\u064A\u0645\u0641\u0627\u0633\u062A\u0627\u062A\u064A\u0646": ["simvastatin"],
  "\u0644\u0648\u0632\u0627\u0631\u062A\u0627\u0646": ["losartan"],
  "\u0641\u0627\u0644\u0633\u0627\u0631\u062A\u0627\u0646": ["valsartan"],
  "\u0628\u064A\u0633\u0648\u0628\u0631\u0648\u0644\u0648\u0644": ["bisoprolol"],
  "\u0627\u0646\u0627\u0644\u0627\u0628\u0631\u064A\u0644": ["enalapril"],
  "\u0641\u064A\u0631\u0648\u0633\u064A\u0645\u064A\u062F": ["furosemide"],
  "\u0643\u0644\u0648\u0628\u064A\u062F\u0648\u062C\u0631\u064A\u0644": ["clopidogrel"],
  "\u0648\u0627\u0631\u0641\u0627\u0631\u064A\u0646": ["warfarin"],
  "\u0627\u0648\u0645\u064A\u0628\u0631\u0627\u0632\u0648\u0644": ["omeprazole"],
  "\u0628\u0627\u0646\u062A\u0648\u0628\u0631\u0627\u0632\u0648\u0644": ["pantoprazole"],
  "\u0633\u0627\u0644\u0628\u0648\u062A\u0627\u0645\u0648\u0644": ["salbutamol", "albuterol"],
  "\u0644\u0648\u0631\u0627\u062A\u0627\u062F\u064A\u0646": ["loratadine"],
  "\u0633\u064A\u062A\u064A\u0631\u064A\u0632\u064A\u0646": ["cetirizine"],
  "\u0644\u064A\u0641\u0648\u062B\u064A\u0631\u0648\u0643\u0633\u064A\u0646": ["levothyroxine"],
  "\u0628\u0631\u064A\u062F\u0646\u064A\u0632\u0648\u0644\u0648\u0646": ["prednisolone"],
  "\u062F\u064A\u0643\u0633\u0627\u0645\u064A\u062B\u0627\u0632\u0648\u0646": ["dexamethasone"],
  "\u062F\u064A\u0627\u0632\u064A\u0628\u0627\u0645": ["diazepam"],
  "\u062C\u0627\u0628\u0627\u0628\u0646\u062A\u064A\u0646": ["gabapentin"],
  "\u0628\u0631\u064A\u062C\u0627\u0628\u0627\u0644\u064A\u0646": ["pregabalin"],
  "\u0641\u0644\u0648\u0643\u0648\u0646\u0627\u0632\u0648\u0644": ["fluconazole"],
  "\u0627\u064A\u0641\u0631\u0645\u0643\u062A\u064A\u0646": ["ivermectin"],
  "\u0643\u0644\u0648\u0631\u0648\u0643\u064A\u0646": ["chloroquine"],
  "\u0647\u064A\u062F\u0631\u0648\u0643\u0633\u064A\u0643\u0644\u0648\u0631\u0648\u0643\u064A\u0646": ["hydroxychloroquine"],
  "\u0631\u064A\u0641\u0627\u0645\u0628\u064A\u0633\u064A\u0646": ["rifampicin", "rifampin"],
};

const NORM_DICT: Record<string, string[]> = {};
for (const [ar, latin] of Object.entries(ARABIC_DRUG_DICT)) {
  const k = normalizeKey(ar);
  if (!NORM_DICT[k]) NORM_DICT[k] = [];
  for (const L of latin) {
    if (!NORM_DICT[k].includes(L)) NORM_DICT[k].push(L);
  }
}

const LETTER_MAP: Record<string, string> = {
  "\u0627": "a", "\u0623": "a", "\u0625": "i", "\u0622": "a",
  "\u0628": "b", "\u062A": "t", "\u062B": "th", "\u062C": "j",
  "\u062D": "h", "\u062E": "kh", "\u062F": "d", "\u0630": "dh",
  "\u0631": "r", "\u0632": "z", "\u0633": "s", "\u0634": "sh",
  "\u0635": "s", "\u0636": "d", "\u0637": "t", "\u0638": "z",
  "\u0639": "a", "\u063A": "gh", "\u0641": "f", "\u0642": "q",
  "\u0643": "k", "\u0644": "l", "\u0645": "m", "\u0646": "n",
  "\u0647": "h", "\u0629": "h", "\u0648": "w", "\u064A": "y",
  "\u0649": "y", "\u0624": "u", "\u0626": "i", "\u0621": "",
};

export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

export function transliterateArabicLetters(input: string): string {
  const s = normalizeKey(input || "");
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    if (LETTER_MAP[ch] !== undefined) out += LETTER_MAP[ch];
    else if (/[a-z0-9\s]/.test(ch)) out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function arabicDrugDictLookup(query: string): string[] {
  const k = normalizeKey(query || "");
  if (!k) return [];
  if (NORM_DICT[k]) return [...NORM_DICT[k]];
  const noDigits = k.replace(/\d+([.,]\d+)?/g, " ").replace(/\s+/g, " ").trim();
  if (noDigits && NORM_DICT[noDigits]) return [...NORM_DICT[noDigits]];
  const first = noDigits.split(" ")[0] || "";
  if (first.length >= 4 && NORM_DICT[first]) return [...NORM_DICT[first]];
  return [];
}

export function expandQueryVariants(query: string): string[] {
  const q = (query || "").trim();
  if (!q) return [];
  const out: string[] = [];
  const add = (s: string) => {
    const t = (s || "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(q);
  add(normalizeKey(q));
  if (hasArabicScript(q)) {
    for (const lat of arabicDrugDictLookup(q)) add(lat);
    const letters = transliterateArabicLetters(q);
    if (letters.length >= 3) add(letters);
  }
  return out;
}

export function toLatinDrugKey(query: string): string {
  const q = (query || "").trim();
  if (!q) return "";
  if (!hasArabicScript(q)) return normalizeKey(q);
  const dict = arabicDrugDictLookup(q);
  if (dict.length) return dict[0];
  const letters = transliterateArabicLetters(q);
  return letters || normalizeKey(q);
}

export function registerArabicDrugAlias(arabic: string, latinNames: string[]): void {
  const k = normalizeKey(arabic);
  if (!k || !latinNames.length) return;
  if (!NORM_DICT[k]) NORM_DICT[k] = [];
  for (const L of latinNames) {
    const t = (L || "").trim();
    if (t && !NORM_DICT[k].includes(t)) NORM_DICT[k].push(t);
  }
}

export function arabicDrugDictSize(): number {
  return Object.keys(NORM_DICT).length;
}
