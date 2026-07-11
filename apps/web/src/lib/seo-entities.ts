export type SeoEntityType = "company" | "generic" | "disease";

export type SeoEntity = {
  type: SeoEntityType;
  slug: string;
  name: string;
  sourceValue?: string;
  records: number;
  origin?: string | null;
  activeRecords?: number;
  genericCount?: number;
  diseaseCount?: number;
  prescriptionRecords?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
};

export type SeoEntityDirectory = {
  generatedAt: string;
  entities: SeoEntity[];
};

function shortHash(value: string) {
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

export function cleanDiseaseEntityName(value: string) {
  return value.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

export function seoEntitySlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 82) || "entity";
  return `${base}-${shortHash(value)}`;
}

export function seoEntityPath(type: SeoEntityType, slug: string) {
  const prefix = type === "company" ? "companies" : type === "generic" ? "generics" : "diseases";
  return `/${prefix}/${encodeURIComponent(slug)}`;
}

export function cleanCompanyOrigin(value: string | null | undefined) {
  return String(value || "")
    .replace(/^\*\s*Country of Origin:\s*/i, "")
    .trim();
}

export async function fetchSeoEntityDirectory(): Promise<SeoEntityDirectory> {
  const response = await fetch("/entity-directory.json", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load the public entity directory: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.entities)) throw new Error("The public entity directory is invalid.");
  return data as SeoEntityDirectory;
}
