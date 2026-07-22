// apps/web/src/lib/appwrite-cache-client.ts
import { Client, Databases, Query } from "appwrite";

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID = import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

let client: Client | null = null;
let databases: Databases | null = null;

if (APPWRITE_PROJECT_ID) {
  try {
    client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
    databases = new Databases(client);
  } catch (err) {
    console.warn("[Appwrite Cache] Could not initialize Appwrite client:", err);
  }
}

export type CachedMedicine = {
  canonical_id: number;
  name_en: string;
  name_ar: string;
  scientific_name: string;
  manufacturer: string;
  drug_class: string;
  route: string;
  category: string;
  dosage_form: string;
  strength: string;
  current_price_egp: number;
  image_url: string;
};

/**
 * High-performance search against Appwrite Database Edge Cache (<50ms).
 * Falls back to Supabase if Appwrite is not configured or unavailable.
 */
export async function fetchMedicinesFastCache(
  searchQuery: string,
  fallbackSupabaseFetch: () => Promise<CachedMedicine[]>
): Promise<CachedMedicine[]> {
  if (databases && APPWRITE_PROJECT_ID) {
    try {
      const queries = [Query.limit(50)];
      if (searchQuery.trim()) {
        queries.push(Query.search("name_en", searchQuery.trim()));
      }
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        MEDICINES_COLLECTION_ID,
        queries
      );

      if (response.documents.length > 0) {
        return response.documents.map((doc) => ({
          canonical_id: doc.canonical_id,
          name_en: doc.name_en || "",
          name_ar: doc.name_ar || "",
          scientific_name: doc.scientific_name || "",
          manufacturer: doc.manufacturer || "",
          drug_class: doc.drug_class || "",
          route: doc.route || "",
          category: doc.category || "",
          dosage_form: doc.dosage_form || "",
          strength: doc.strength || "",
          current_price_egp: doc.current_price_egp || 0,
          image_url: doc.image_url || "",
        }));
      }
    } catch (err) {
      console.warn("[Appwrite Cache] Read cache miss/error, executing Supabase fallback:", err);
    }
  }

  // Transparent fallback to Supabase PostgreSQL
  return fallbackSupabaseFetch();
}
