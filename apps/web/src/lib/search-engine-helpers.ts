import { searchCollection, normalizeCompanyName, applyLocalProductUpdates } from "@/lib/search-engine";
export type SearchableMedicine = {
  canonical_id?: number;
  name_en?: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  category?: string;
  drug_class?: string;
  dosage_form?: string;
  barcode?: string;
  code?: string;
  current_price_egp?: number;
  image_url?: string;
  route?: string;
};

export function searchMedicines<T extends SearchableMedicine>(
  items: T[],
  query: string
) {
  return searchCollection(items, query);
}

export function filterMedicinesByCompany<T extends SearchableMedicine>(
  items: T[],
  companyQuery: string
): T[] {
  const updatedItems = applyLocalProductUpdates(items);
  const key = normalizeCompanyName(companyQuery);
  if (!key) return updatedItems;
  return updatedItems.filter((item) =>
    normalizeCompanyName(item.manufacturer || "").includes(key)
  );
}
