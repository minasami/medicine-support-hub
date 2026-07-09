export type MedicineLike = {
  name_en?: string | null;
  name_ar?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  active_ingredient?: string | null;
  atc_code?: string | null;
  barcode?: string | null;
};

const FORM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(F\.C\.\s*)?TABS?\b|\bTABLETS?\b/i, "Tablet"],
  [/\bCAPS?\b|\bCAPSULES?\b/i, "Capsule"],
  [/\bCREAM\b/i, "Cream"],
  [/\bOINT\b|\bOINTMENT\b/i, "Ointment"],
  [/\bGEL\b/i, "Gel"],
  [/\bDROPS?\b/i, "Drops"],
  [/\bSYRUP\b|\bSUSP\b|\bSUSPENSION\b/i, "Syrup/Suspension"],
  [/\bSACHETS?\b/i, "Sachet"],
  [/\bVIALS?\b|\bAMPS?\b|\bAMPoules?\b|\bINJ\b/i, "Injection"],
  [/\bSPRAY\b/i, "Spray"],
];

const STRENGTH_PATTERN = /\b\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*(?:\s?)(?:MG|GM|G|MCG|IU|ML|%|MG\/ML|MCG\/ML)\b/i;
const PACK_PATTERN = /\b\d+\s?(?:TABS?|TABLETS?|CAPS?|CAPSULES?|SACHETS?|VIALS?|AMPS?|GM|G|ML|SDU)\b/i;

function text(medicine: MedicineLike) {
  return [medicine.name_en, medicine.name_ar].filter(Boolean).join(" ");
}

export function deriveDosageForm(medicine: MedicineLike) {
  if (medicine.dosage_form) return { value: medicine.dosage_form, derived: false };
  const source = text(medicine);
  for (const [pattern, value] of FORM_PATTERNS) {
    if (pattern.test(source)) return { value, derived: true };
  }
  return { value: null, derived: false };
}

export function deriveStrength(medicine: MedicineLike) {
  if (medicine.strength) return { value: medicine.strength, derived: false };
  const match = text(medicine).match(STRENGTH_PATTERN);
  return match ? { value: match[0].toUpperCase().replace(/\s+/g, " "), derived: true } : { value: null, derived: false };
}

export function derivePackSize(medicine: MedicineLike) {
  const match = text(medicine).match(PACK_PATTERN);
  return match ? { value: match[0].toUpperCase().replace(/\s+/g, " "), derived: true } : { value: null, derived: false };
}

export function deriveCategory(medicine: MedicineLike) {
  if (medicine.category) return { value: medicine.category, derived: false };
  const form = deriveDosageForm(medicine).value;
  if (form) return { value: `${form} medicine`, derived: true };
  return { value: null, derived: false };
}

export function fieldValue(value: string | null | undefined, derived?: { value: string | null; derived: boolean }) {
  if (value) return { value, derived: false };
  if (derived?.value) return derived;
  return { value: null, derived: false };
}
