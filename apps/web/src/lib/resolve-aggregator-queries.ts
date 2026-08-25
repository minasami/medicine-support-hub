export function resolveAggregatorQueries(input: {
  query?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
  nameAr?: string | null;
  scientific_name?: string | null;
  scientificName?: string | null;
  locale?: string;
}): string[] & { primary: string; arabic: string | null; scientific: string | null } {
  const out: string[] = [];
  for (const k of [
    input.scientific_name || input.scientificName,
    input.name_en || input.query,
    input.name_ar || input.nameAr,
    input.query,
  ]) {
    const t = (k || "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  const result = out as string[] & {
    primary: string;
    arabic: string | null;
    scientific: string | null;
  };
  result.primary = out[0] || (input.query || "").trim();
  result.arabic =
    [input.name_ar, input.nameAr, ...out].find((v) => v && /[\u0600-\u06FF]/.test(String(v))) || null;
  result.scientific = (input.scientific_name || input.scientificName || "").trim() || null;
  return result;
}
