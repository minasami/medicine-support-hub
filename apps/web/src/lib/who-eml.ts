/**
 * WHO Essential Medicines List (EML) \u2014 local core matcher.
 * Arabic queries resolve via expandQueryVariants / toLatinDrugKey.
 */

import { arabicFuzzyScore, normalizeArabicDrugName } from "./arabic-fuzzy-match";
import { expandQueryVariants, toLatinDrugKey } from "./arabic-transliterate";

export type WhoEmlHit = {
  source: "who_eml";
  query: string;
  queried_at: string;
  name_en: string;
  scientific_name: string;
  manufacturer: null;
  drug_class: string | null;
  indications_summary: string | null;
  external_id: string;
  confidence: number;
  source_url: string;
  price_egp: null;
  section?: string | null;
};

export type WhoEmlEntry = {
  inn: string;
  aliases?: string[];
  section?: string;
  list?: "core" | "complementary";
};

export const WHO_EML_CORE: WhoEmlEntry[] = [
  { inn: "abacavir", section: "Antiretrovirals", list: "core" },
  { inn: "acetylsalicylic acid", aliases: ["aspirin", "asa"], section: "Pain / cardiovascular", list: "core" },
  { inn: "aciclovir", aliases: ["acyclovir"], section: "Antivirals", list: "core" },
  { inn: "albendazole", section: "Anthelminthics", list: "core" },
  { inn: "allopurinol", section: "Gout", list: "core" },
  { inn: "amoxicillin", aliases: ["amoxycillin"], section: "Antibacterials", list: "core" },
  { inn: "amoxicillin + clavulanic acid", aliases: ["co-amoxiclav", "amoxicillin-clavulanate"], section: "Antibacterials", list: "core" },
  { inn: "ampicillin", section: "Antibacterials", list: "core" },
  { inn: "azithromycin", section: "Antibacterials", list: "core" },
  { inn: "bisoprolol", section: "Cardiovascular", list: "core" },
  { inn: "budesonide", section: "Antiasthmatics", list: "core" },
  { inn: "captopril", section: "Cardiovascular", list: "core" },
  { inn: "carbamazepine", section: "Anticonvulsants", list: "core" },
  { inn: "cefalexin", aliases: ["cephalexin"], section: "Antibacterials", list: "core" },
  { inn: "ceftriaxone", section: "Antibacterials", list: "core" },
  { inn: "chloroquine", section: "Antimalarials", list: "core" },
  { inn: "chlorphenamine", aliases: ["chlorpheniramine"], section: "Antiallergics", list: "core" },
  { inn: "ciprofloxacin", section: "Antibacterials", list: "core" },
  { inn: "clarithromycin", section: "Antibacterials", list: "core" },
  { inn: "clopidogrel", section: "Cardiovascular", list: "core" },
  { inn: "clotrimazole", section: "Antifungals", list: "core" },
  { inn: "codeine", section: "Pain", list: "core" },
  { inn: "dexamethasone", section: "Hormones", list: "core" },
  { inn: "diazepam", section: "Psychotherapeutics", list: "core" },
  { inn: "diclofenac", section: "Pain", list: "core" },
  { inn: "digoxin", section: "Cardiovascular", list: "core" },
  { inn: "doxycycline", section: "Antibacterials", list: "core" },
  { inn: "enalapril", section: "Cardiovascular", list: "core" },
  { inn: "enoxaparin", section: "Cardiovascular", list: "core" },
  { inn: "erythromycin", section: "Antibacterials", list: "core" },
  { inn: "fluconazole", section: "Antifungals", list: "core" },
  { inn: "fluoxetine", section: "Psychotherapeutics", list: "core" },
  { inn: "folic acid", section: "Vitamins and minerals", list: "core" },
  { inn: "furosemide", section: "Cardiovascular", list: "core" },
  { inn: "gentamicin", section: "Antibacterials", list: "core" },
  { inn: "glibenclamide", aliases: ["glyburide"], section: "Diabetes", list: "core" },
  { inn: "gliclazide", section: "Diabetes", list: "core" },
  { inn: "heparin", section: "Cardiovascular", list: "core" },
  { inn: "hydrochlorothiazide", section: "Cardiovascular", list: "core" },
  { inn: "hydrocortisone", section: "Hormones", list: "core" },
  { inn: "hydroxychloroquine", section: "Antimalarials", list: "core" },
  { inn: "ibuprofen", section: "Pain", list: "core" },
  { inn: "insulin", section: "Diabetes", list: "core" },
  { inn: "isoniazid", section: "Antituberculosis", list: "core" },
  { inn: "ivermectin", section: "Anthelminthics", list: "core" },
  { inn: "levothyroxine", section: "Hormones", list: "core" },
  { inn: "lisinopril", section: "Cardiovascular", list: "core" },
  { inn: "loperamide", section: "Gastrointestinal", list: "core" },
  { inn: "loratadine", section: "Antiallergics", list: "core" },
  { inn: "losartan", section: "Cardiovascular", list: "core" },
  { inn: "mebendazole", section: "Anthelminthics", list: "core" },
  { inn: "metformin", section: "Diabetes", list: "core" },
  { inn: "metoclopramide", section: "Gastrointestinal", list: "core" },
  { inn: "metronidazole", section: "Antibacterials", list: "core" },
  { inn: "miconazole", section: "Antifungals", list: "core" },
  { inn: "morphine", section: "Pain", list: "core" },
  { inn: "nifedipine", section: "Cardiovascular", list: "core" },
  { inn: "omeprazole", section: "Gastrointestinal", list: "core" },
  { inn: "ondansetron", section: "Gastrointestinal", list: "core" },
  { inn: "oral rehydration salts", aliases: ["ors"], section: "Gastrointestinal", list: "core" },
  { inn: "oseltamivir", section: "Antivirals", list: "core" },
  { inn: "paracetamol", aliases: ["acetaminophen"], section: "Pain", list: "core" },
  { inn: "phenytoin", section: "Anticonvulsants", list: "core" },
  { inn: "prednisolone", section: "Hormones", list: "core" },
  { inn: "ranitidine", section: "Gastrointestinal", list: "core" },
  { inn: "rifampicin", aliases: ["rifampin"], section: "Antituberculosis", list: "core" },
  { inn: "salbutamol", aliases: ["albuterol"], section: "Antiasthmatics", list: "core" },
  { inn: "sertraline", section: "Psychotherapeutics", list: "core" },
  { inn: "simvastatin", section: "Cardiovascular", list: "core" },
  { inn: "sodium valproate", aliases: ["valproic acid", "valproate"], section: "Anticonvulsants", list: "core" },
  { inn: "spironolactone", section: "Cardiovascular", list: "core" },
  { inn: "sulfamethoxazole + trimethoprim", aliases: ["co-trimoxazole", "bactrim"], section: "Antibacterials", list: "core" },
  { inn: "tenofovir", section: "Antiretrovirals", list: "core" },
  { inn: "tranexamic acid", section: "Blood products", list: "core" },
  { inn: "vancomycin", section: "Antibacterials", list: "core" },
  { inn: "warfarin", section: "Cardiovascular", list: "core" },
  { inn: "zinc sulfate", section: "Vitamins and minerals", list: "core" },
  { inn: "amlodipine", section: "Cardiovascular", list: "core" },
  { inn: "atorvastatin", section: "Cardiovascular", list: "core" },
  { inn: "cetirizine", section: "Antiallergics", list: "core" },
  { inn: "esomeprazole", section: "Gastrointestinal", list: "complementary" },
  { inn: "gabapentin", section: "Anticonvulsants", list: "complementary" },
  { inn: "montelukast", section: "Antiasthmatics", list: "complementary" },
  { inn: "pantoprazole", section: "Gastrointestinal", list: "complementary" },
  { inn: "pregabalin", section: "Anticonvulsants", list: "complementary" },
  { inn: "sitagliptin", section: "Diabetes", list: "complementary" },
  { inn: "telmisartan", section: "Cardiovascular", list: "core" },
  { inn: "valsartan", section: "Cardiovascular", list: "core" },
];

function entryMatchScore(query: string, entry: WhoEmlEntry): number {
  const q = query.trim();
  if (!q) return 0;
  const variants = expandQueryVariants(q);
  let best = 0;
  const targets = [entry.inn, ...(entry.aliases || [])];
  for (const v of variants) {
    for (const t of targets) {
      best = Math.max(best, arabicFuzzyScore(v, t));
      if (normalizeArabicDrugName(v) === normalizeArabicDrugName(t)) best = 100;
    }
  }
  const latinKey = toLatinDrugKey(q);
  if (latinKey) {
    for (const t of targets) {
      best = Math.max(best, arabicFuzzyScore(latinKey, t));
      if (normalizeArabicDrugName(latinKey) === normalizeArabicDrugName(t)) best = 100;
    }
  }
  return best;
}

export function searchWhoEmlLocal(query: string, limit = 5, minScore = 70): WhoEmlHit[] {
  const q = (query || "").trim();
  if (!q) return [];
  const now = new Date().toISOString();
  const scored: Array<{ entry: WhoEmlEntry; score: number }> = [];
  for (const entry of WHO_EML_CORE) {
    const score = entryMatchScore(q, entry);
    if (score >= minScore) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry, score }) => ({
    source: "who_eml" as const,
    query: q,
    queried_at: now,
    name_en: entry.inn,
    scientific_name: entry.inn,
    manufacturer: null,
    drug_class: entry.section || null,
    indications_summary: entry.list
      ? `WHO EML (${entry.list}${entry.section ? ` \u2014 ${entry.section}` : ""})`
      : "WHO Essential Medicines List",
    external_id: `who-eml:${normalizeArabicDrugName(entry.inn).replace(/\s+/g, "-")}`,
    confidence: Math.min(0.95, 0.55 + score / 200),
    source_url: `https://list.essentialmeds.org/?query=${encodeURIComponent(entry.inn)}`,
    price_egp: null,
    section: entry.section || null,
  }));
}

export function isLikelyWhoEssential(query: string, minScore = 85): boolean {
  return searchWhoEmlLocal(query, 1, minScore).length > 0;
}
