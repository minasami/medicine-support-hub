/**
 * WHO Essential Medicines List (EML) — local core matcher.
 *
 * Browser-safe: no network required. Core INNs from WHO Model List
 * (adult + selected complementary). Used to flag essential status and
 * enrich scientific_name / drug_class when local monograph is sparse.
 *
 * Full official list: https://list.essentialmeds.org/
 * This module is a curated high-value subset for identity matching;
 * always link out to the official WHO list for verification.
 */

import { arabicFuzzyScore, normalizeArabicDrugName } from "./arabic-fuzzy-match";

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
  /** WHO EML section / therapeutic area when known */
  section?: string | null;
};

export type WhoEmlEntry = {
  inn: string;
  /** Common synonyms / brand-adjacent tokens for matching */
  aliases?: string[];
  section?: string;
  /** Adult core list vs complementary */
  list?: "core" | "complementary";
};

/**
 * Curated core WHO EML INNs (high-coverage subset for Egypt/MENA search).
 * Keep alphabetical by INN for maintainability.
 */
export const WHO_EML_CORE: WhoEmlEntry[] = [
  { inn: "abacavir", section: "Antiretrovirals", list: "core" },
  { inn: "acetylsalicylic acid", aliases: ["aspirin", "asa"], section: "Pain / cardiovascular", list: "core" },
  { inn: "aciclovir", aliases: ["acyclovir"], section: "Antivirals", list: "core" },
  { inn: "albendazole", section: "Anthelminthics", list: "core" },
  { inn: "allopurinol", section: "Gout", list: "core" },
  { inn: "amoxicillin", aliases: ["amoxycillin"], section: "Antibacterials", list: "core" },
  { inn: "amoxicillin + clavulanic acid", aliases: ["co-amoxiclav", "amoxicillin-clavulanate"], section: "Antibacterials", list: "core" },
  { inn: "ampicillin", section: "Antibacterials", list: "core" },
  { inn: "artemether + lumefantrine", aliases: ["coartem"], section: "Antimalarials", list: "core" },
  { inn: "artesunate", section: "Antimalarials", list: "core" },
  { inn: "atropine", section: "Ophthalmologicals", list: "core" },
  { inn: "azithromycin", section: "Antibacterials", list: "core" },
  { inn: "beclometasone", aliases: ["beclomethasone"], section: "Antiasthmatics", list: "core" },
  { inn: "benzathine benzylpenicillin", section: "Antibacterials", list: "core" },
  { inn: "bisoprolol", section: "Cardiovascular", list: "core" },
  { inn: "budesonide", section: "Antiasthmatics", list: "core" },
  { inn: "bupivacaine", section: "Anaesthetics", list: "core" },
  { inn: "calcium carbonate", section: "Vitamins and minerals", list: "core" },
  { inn: "captopril", section: "Cardiovascular", list: "core" },
  { inn: "carbamazepine", section: "Anticonvulsants", list: "core" },
  { inn: "cefalexin", aliases: ["cephalexin"], section: "Antibacterials", list: "core" },
  { inn: "cefazolin", section: "Antibacterials", list: "core" },
  { inn: "ceftriaxone", section: "Antibacterials", list: "core" },
  { inn: "cefuroxime", section: "Antibacterials", list: "core" },
  { inn: "chloramphenicol", section: "Antibacterials", list: "core" },
  { inn: "chloroquine", section: "Antimalarials", list: "core" },
  { inn: "chlorphenamine", aliases: ["chlorpheniramine"], section: "Antiallergics", list: "core" },
  { inn: "ciprofloxacin", section: "Antibacterials", list: "core" },
  { inn: "clarithromycin", section: "Antibacterials", list: "core" },
  { inn: "clindamycin", section: "Antibacterials", list: "core" },
  { inn: "clopidogrel", section: "Cardiovascular", list: "core" },
  { inn: "clotrimazole", section: "Antifungals", list: "core" },
  { inn: "cloxacillin", section: "Antibacterials", list: "core" },
  { inn: "codeine", section: "Pain", list: "core" },
  { inn: "cyclophosphamide", section: "Cytotoxics", list: "core" },
  { inn: "dapsone", section: "Antibacterials", list: "core" },
  { inn: "dexamethasone", section: "Hormones", list: "core" },
  { inn: "diazepam", section: "Psychotherapeutics", list: "core" },
  { inn: "diclofenac", section: "Pain", list: "core" },
  { inn: "digoxin", section: "Cardiovascular", list: "core" },
  { inn: "diltiazem", section: "Cardiovascular", list: "core" },
  { inn: "doxycycline", section: "Antibacterials", list: "core" },
  { inn: "efavirenz", section: "Antiretrovirals", list: "core" },
  { inn: "enalapril", section: "Cardiovascular", list: "core" },
  { inn: "enoxaparin", section: "Cardiovascular", list: "core" },
  { inn: "epinephrine", aliases: ["adrenaline"], section: "Cardiovascular", list: "core" },
  { inn: "ergometrine", section: "Obstetrics", list: "core" },
  { inn: "erythromycin", section: "Antibacterials", list: "core" },
  { inn: "ethambutol", section: "Antituberculosis", list: "core" },
  { inn: "ethinylestradiol + levonorgestrel", section: "Hormonal contraceptives", list: "core" },
  { inn: "fluconazole", section: "Antifungals", list: "core" },
  { inn: "fluoxetine", section: "Psychotherapeutics", list: "core" },
  { inn: "folic acid", section: "Vitamins and minerals", list: "core" },
  { inn: "furosemide", section: "Cardiovascular", list: "core" },
  { inn: "gentamicin", section: "Antibacterials", list: "core" },
  { inn: "glibenclamide", aliases: ["glyburide"], section: "Diabetes", list: "core" },
  { inn: "gliclazide", section: "Diabetes", list: "core" },
  { inn: "haloperidol", section: "Psychotherapeutics", list: "core" },
  { inn: "heparin", section: "Cardiovascular", list: "core" },
  { inn: "hydrochlorothiazide", section: "Cardiovascular", list: "core" },
  { inn: "hydrocortisone", section: "Hormones", list: "core" },
  { inn: "hydroxychloroquine", section: "Antimalarials", list: "core" },
  { inn: "ibuprofen", section: "Pain", list: "core" },
  { inn: "insulin", section: "Diabetes", list: "core" },
  { inn: "isoniazid", section: "Antituberculosis", list: "core" },
  { inn: "isosorbide dinitrate", section: "Cardiovascular", list: "core" },
  { inn: "ivermectin", section: "Anthelminthics", list: "core" },
  { inn: "ketamine", section: "Anaesthetics", list: "core" },
  { inn: "lamivudine", section: "Antiretrovirals", list: "core" },
  { inn: "levodopa + carbidopa", section: "Antiparkinsonism", list: "core" },
  { inn: "levofloxacin", section: "Antibacterials", list: "core" },
  { inn: "levonorgestrel", section: "Hormonal contraceptives", list: "core" },
  { inn: "levothyroxine", section: "Hormones", list: "core" },
  { inn: "lidocaine", aliases: ["lignocaine"], section: "Anaesthetics", list: "core" },
  { inn: "lisinopril", section: "Cardiovascular", list: "core" },
  { inn: "lithium carbonate", section: "Psychotherapeutics", list: "core" },
  { inn: "loperamide", section: "Gastrointestinal", list: "core" },
  { inn: "loratadine", section: "Antiallergics", list: "core" },
  { inn: "losartan", section: "Cardiovascular", list: "core" },
  { inn: "mebendazole", section: "Anthelminthics", list: "core" },
  { inn: "medroxyprogesterone", section: "Hormonal contraceptives", list: "core" },
  { inn: "metformin", section: "Diabetes", list: "core" },
  { inn: "methadone", section: "Pain", list: "core" },
  { inn: "methotrexate", section: "Cytotoxics", list: "core" },
  { inn: "methyldopa", section: "Cardiovascular", list: "core" },
  { inn: "metoclopramide", section: "Gastrointestinal", list: "core" },
  { inn: "metronidazole", section: "Antibacterials", list: "core" },
  { inn: "miconazole", section: "Antifungals", list: "core" },
  { inn: "midazolam", section: "Anaesthetics", list: "core" },
  { inn: "morphine", section: "Pain", list: "core" },
  { inn: "naloxone", section: "Antidotes", list: "core" },
  { inn: "nevirapine", section: "Antiretrovirals", list: "core" },
  { inn: "nicotine", section: "Substance dependence", list: "core" },
  { inn: "nifedipine", section: "Cardiovascular", list: "core" },
  { inn: "nitrofurantoin", section: "Antibacterials", list: "core" },
  { inn: "nitroglycerin", aliases: ["glyceryl trinitrate"], section: "Cardiovascular", list: "core" },
  { inn: "norethisterone", section: "Hormonal contraceptives", list: "core" },
  { inn: "nystatin", section: "Antifungals", list: "core" },
  { inn: "omeprazole", section: "Gastrointestinal", list: "core" },
  { inn: "ondansetron", section: "Gastrointestinal", list: "core" },
  { inn: "oral rehydration salts", aliases: ["ors"], section: "Gastrointestinal", list: "core" },
  { inn: "oseltamivir", section: "Antivirals", list: "core" },
  { inn: "oxycodone", section: "Pain", list: "complementary" },
  { inn: "paracetamol", aliases: ["acetaminophen"], section: "Pain", list: "core" },
  { inn: "penicillin V", aliases: ["phenoxymethylpenicillin"], section: "Antibacterials", list: "core" },
  { inn: "phenobarbital", section: "Anticonvulsants", list: "core" },
  { inn: "phenytoin", section: "Anticonvulsants", list: "core" },
  { inn: "prednisolone", section: "Hormones", list: "core" },
  { inn: "primaquine", section: "Antimalarials", list: "core" },
  { inn: "propranolol", section: "Cardiovascular", list: "core" },
  { inn: "pyrazinamide", section: "Antituberculosis", list: "core" },
  { inn: "pyridoxine", section: "Vitamins and minerals", list: "core" },
  { inn: "quinine", section: "Antimalarials", list: "core" },
  { inn: "ranitidine", section: "Gastrointestinal", list: "core" },
  { inn: "rifampicin", aliases: ["rifampin"], section: "Antituberculosis", list: "core" },
  { inn: "risperidone", section: "Psychotherapeutics", list: "core" },
  { inn: "salbutamol", aliases: ["albuterol"], section: "Antiasthmatics", list: "core" },
  { inn: "sertraline", section: "Psychotherapeutics", list: "core" },
  { inn: "simvastatin", section: "Cardiovascular", list: "core" },
  { inn: "sodium valproate", aliases: ["valproic acid", "valproate"], section: "Anticonvulsants", list: "core" },
  { inn: "spironolactone", section: "Cardiovascular", list: "core" },
  { inn: "sulfamethoxazole + trimethoprim", aliases: ["co-trimoxazole", "bactrim"], section: "Antibacterials", list: "core" },
  { inn: "tamoxifen", section: "Hormones", list: "core" },
  { inn: "tenofovir", section: "Antiretrovirals", list: "core" },
  { inn: "tetracycline", section: "Antibacterials", list: "core" },
  { inn: "timolol", section: "Ophthalmologicals", list: "core" },
  { inn: "tranexamic acid", section: "Blood products", list: "core" },
  { inn: "vancomycin", section: "Antibacterials", list: "core" },
  { inn: "verapamil", section: "Cardiovascular", list: "core" },
  { inn: "vitamin A", section: "Vitamins and minerals", list: "core" },
  { inn: "warfarin", section: "Cardiovascular", list: "core" },
  { inn: "zidovudine", section: "Antiretrovirals", list: "core" },
  { inn: "zinc sulfate", section: "Vitamins and minerals", list: "core" },
  { inn: "amlodipine", section: "Cardiovascular", list: "core" },
  { inn: "atorvastatin", section: "Cardiovascular", list: "core" },
  { inn: "cetirizine", section: "Antiallergics", list: "core" },
  { inn: "esomeprazole", section: "Gastrointestinal", list: "complementary" },
  { inn: "gabapentin", section: "Anticonvulsants", list: "complementary" },
  { inn: "insulin glargine", section: "Diabetes", list: "complementary" },
  { inn: "montelukast", section: "Antiasthmatics", list: "complementary" },
  { inn: "pantoprazole", section: "Gastrointestinal", list: "complementary" },
  { inn: "pregabalin", section: "Anticonvulsants", list: "complementary" },
  { inn: "rosuvastatin", section: "Cardiovascular", list: "complementary" },
  { inn: "sitagliptin", section: "Diabetes", list: "complementary" },
  { inn: "spiramycin", section: "Antibacterials", list: "complementary" },
  { inn: "sulfasalazine", section: "Gastrointestinal / DMARD", list: "core" },
  { inn: "tamsulosin", section: "Urology", list: "complementary" },
  { inn: "telmisartan", section: "Cardiovascular", list: "core" },
  { inn: "valsartan", section: "Cardiovascular", list: "core" },
];

function entryMatchScore(query: string, entry: WhoEmlEntry): number {
  const q = query.trim();
  if (!q) return 0;
  let best = arabicFuzzyScore(q, entry.inn);
  if (normalizeArabicDrugName(q) === normalizeArabicDrugName(entry.inn)) {
    best = 100;
  }
  for (const a of entry.aliases || []) {
    best = Math.max(best, arabicFuzzyScore(q, a));
    if (normalizeArabicDrugName(q) === normalizeArabicDrugName(a)) {
      best = 100;
    }
  }
  return best;
}

/**
 * Search local WHO EML core list. Returns AggregatorHit-compatible objects.
 * minScore default 70 — essential-list identity should be high confidence.
 */
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
      ? `WHO EML (${entry.list}${entry.section ? ` — ${entry.section}` : ""})`
      : "WHO Essential Medicines List",
    external_id: `who-eml:${normalizeArabicDrugName(entry.inn).replace(/\s+/g, "-")}`,
    confidence: Math.min(0.95, 0.55 + score / 200),
    source_url: `https://list.essentialmeds.org/?query=${encodeURIComponent(entry.inn)}`,
    price_egp: null,
    section: entry.section || null,
  }));
}

/** True if any core EML entry matches at high confidence. */
export function isLikelyWhoEssential(query: string, minScore = 85): boolean {
  return searchWhoEmlLocal(query, 1, minScore).length > 0;
}
