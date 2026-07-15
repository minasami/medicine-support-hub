export type MedicineCompanyRole =
  | "manufacturer"
  | "toll_manufacturer"
  | "trademark_owner";

export interface MedicineCompanyParty {
  companyName: string;
  role: MedicineCompanyRole;
  position: number;
}

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Catalog sources use `A > B` to mean that A made the product under a toll or
 * contract-manufacturing arrangement and B owns the trademark/brand. Leading
 * or trailing delimiters are preserved as one-sided relationships.
 */
export function parseMedicineCompanyParties(value: string | null | undefined) {
  const source = normalize(String(value || ""));
  if (!source) return [] as MedicineCompanyParty[];
  if (!source.includes(">")) {
    return [{ companyName: source, role: "manufacturer", position: 1 }] as MedicineCompanyParty[];
  }

  // A few source rows contain chained arrows (`A > B --> C`). Keep every
  // named entity separate; the first party is the toll manufacturer and every
  // downstream party is an attributed trademark/brand owner pending review.
  return source
    .split(/\s*-*>\s*/)
    .map(normalize)
    .map((companyName, index) => ({
      companyName,
      role: index === 0 ? "toll_manufacturer" as const : "trademark_owner" as const,
      position: index + 1,
    }))
    .filter((party) => party.companyName);
}

export function medicineCompanyRoleLabel(
  role: MedicineCompanyRole,
  t: (english: string, arabic: string) => string,
) {
  if (role === "toll_manufacturer") {
    return t("Toll manufacturer", "المُصنّع لحساب الغير");
  }
  if (role === "trademark_owner") {
    return t("Trademark owner", "مالك العلامة التجارية");
  }
  return t("Manufacturer", "الشركة المصنعة");
}

export const medicineCompanyLookupKey = (value: string) =>
  normalize(value).toLocaleLowerCase();
