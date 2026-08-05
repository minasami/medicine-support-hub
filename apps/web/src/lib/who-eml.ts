/**
 * WHO Essential Medicines List (EML) integration.
 *
 * Official interactive list: https://list.essentialmeds.org/
 * Compact high-value INN subset for offline matching + official link-out.
 */

import { arabicFuzzyScore, normalizeArabicDrugName } from "./arabic-fuzzy-match";

/** Compatible with AggregatorHit (avoid circular import). */
export type WhoEmlHit = {
  source: "who_eml";
  query: string;
  queried_at: string;
  name_en: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  indications_summary?: string | null;
  external_id?: string | null;
  confidence: number;
  source_url?: string | null;
  price_egp?: number | null;
};

/** High-frequency EML / core INNs (English) — not exhaustive. */
export const WHO_EML_CORE_INNS: { inn: string; section?: string }[] = [
  { inn: "paracetamol", section: "Analgesics" },
  { inn: "acetaminophen", section: "Analgesics" },
  { inn: "ibuprofen", section: "Analgesics" },
  { inn: "acetylsalicylic acid", section: "Analgesics" },
  { inn: "amoxicillin", section: "Antibiotics" },
  { inn: "amoxicillin + clavulanic acid", section: "Antibiotics" },
  { inn: "azithromycin", section: "Antibiotics" },
  { inn: "ciprofloxacin", section: "Antibiotics" },
  { inn: "metronidazole", section: "Antibiotics" },
  { inn: "doxycycline", section: "Antibiotics" },
  { inn: "ceftriaxone", section: "Antibiotics" },
  { inn: "insulin", section: "Diabetes" },
  { inn: "metformin", section: "Diabetes" },
  { inn: "glibenclamide", section: "Diabetes" },
  { inn: "amlodipine", section: "Cardiovascular" },
  { inn: "enalapril", section: "Cardiovascular" },
  { inn: "losartan", section: "Cardiovascular" },
  { inn: "atenolol", section: "Cardiovascular" },
  { inn: "bisoprolol", section: "Cardiovascular" },
  { inn: "furosemide", section: "Cardiovascular" },
  { inn: "hydrochlorothiazide", section: "Cardiovascular" },
  { inn: "simvastatin", section: "Cardiovascular" },
  { inn: "atorvastatin", section: "Cardiovascular" },
  { inn: "omeprazole", section: "GI" },
  { inn: "ondansetron", section: "GI" },
  { inn: "oral rehydration salts", section: "GI" },
  { inn: "salbutamol", section: "Respiratory" },
  { inn: "beclometasone", section: "Respiratory" },
  { inn: "prednisolone", section: "Hormones" },
  { inn: "dexamethasone", section: "Hormones" },
  { inn: "levothyroxine", section: "Hormones" },
  { inn: "diazepam", section: "Mental health" },
  { inn: "fluoxetine", section: "Mental health" },
  { inn: "carbamazepine", section: "Anticonvulsants" },
  { inn: "valproic acid", section: "Anticonvulsants" },
  { inn: "phenytoin", section: "Anticonvulsants" },
  { inn: "morphine", section: "Analgesics" },
  { inn: "tramadol", section: "Analgesics" },
  { inn: "warfarin", section: "Blood" },
  { inn: "heparin", section: "Blood" },
  { inn: "folic acid", section: "Vitamins" },
  { inn: "retinol", section: "Vitamins" },
  { inn: "ascorbic acid", section: "Vitamins" },
  { inn: "cholecalciferol", section: "Vitamins" },
  { inn: "secukinumab", section: "Immunomodulators" },
  { inn: "methotrexate", section: "Immunomodulators" },
  { inn: "artesunate", section: "Antimalarials" },
  { inn: "artemether + lumefantrine", section: "Antimalarials" },
  { inn: "rifampicin", section: "Anti-TB" },
  { inn: "isoniazid", section: "Anti-TB" },
  { inn: "pyrazinamide", section: "Anti-TB" },
  { inn: "ethambutol", section: "Anti-TB" },
];

export function whoEmlSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://list.essentialmeds.org/?query=${q}`;
}

export function whoEmlHomeUrl(): string {
  return "https://list.essentialmeds.org/";
}

/** Match query against core EML INNs (fuzzy). */
export function searchWhoEmlLocal(query: string, limit = 5): WhoEmlHit[] {
  const q = (query || "").trim();
  if (!q) return [];
  const now = new Date().toISOString();
  const scored = WHO_EML_CORE_INNS.map((row) => {
    const r = arabicFuzzyScore(q, row.inn);
    return { row, score: r.score, method: r.method };
  })
    .filter((x) => x.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ row, score }) => ({
    source: "who_eml" as const,
    query: q,
    queried_at: now,
    name_en: row.inn,
    scientific_name: row.inn,
    manufacturer: null,
    drug_class: row.section || "WHO EML",
    indications_summary: `Listed on WHO Essential Medicines List${row.section ? ` (${row.section})` : ""}. Verify section and formulation on the official list.`,
    external_id: `who-eml:${normalizeArabicDrugName(row.inn).replace(/\s+/g, "-")}`,
    confidence: Math.min(0.95, 0.55 + score / 200),
    source_url: whoEmlSearchUrl(row.inn),
  }));
}

/** Whether a merged scientific name appears on our EML core set. */
export function isLikelyWhoEssential(scientificOrName: string | null | undefined): boolean {
  if (!scientificOrName) return false;
  const hit = searchWhoEmlLocal(scientificOrName, 1);
  return hit.length > 0 && hit[0].confidence >= 0.7;
}
