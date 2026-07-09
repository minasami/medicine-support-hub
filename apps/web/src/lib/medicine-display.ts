export type MedicineDisplaySource = "provided" | "inferred" | "planned";

export type MedicineDisplayField = {
  value: string;
  source: MedicineDisplaySource;
};

const STRENGTH_PATTERN = /(?:^|\s)(\d+(?:[.,]\d+)?\s?(?:mg|mcg|g|gm|gram|grams|ml|iu|unit|units|%|mg\/ml|mcg\/ml|mg\/g|mg\/5ml|mg\/dose|iu\/ml))(?:\s|$)/i;

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function inferStrengthFromName(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const text = clean(name);
    if (!text) continue;
    const match = text.match(STRENGTH_PATTERN);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

export function displayStrength(strength: string | null | undefined, ...names: Array<string | null | undefined>): MedicineDisplayField {
  const provided = clean(strength);
  if (provided) return { value: provided, source: "provided" };
  const inferred = inferStrengthFromName(...names);
  if (inferred) return { value: inferred, source: "inferred" };
  return { value: "Pending enrichment", source: "planned" };
}

export function displayKnownOrPlanned(value: string | null | undefined): MedicineDisplayField {
  const provided = clean(value);
  if (provided) return { value: provided, source: "provided" };
  return { value: "Pending enrichment", source: "planned" };
}

export function sourceLabel(source: MedicineDisplaySource, language: "en" | "ar") {
  if (source === "provided") return "";
  if (source === "inferred") return language === "ar" ? "مستنتج من الاسم" : "inferred from name";
  return language === "ar" ? "مخطط لإثرائه" : "planned enrichment";
}
