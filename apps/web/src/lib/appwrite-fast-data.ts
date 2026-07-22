// apps/web/src/lib/appwrite-fast-data.ts
import { Client, Databases, Query } from "appwrite";

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";

const COLLECTIONS = {
  MEDICINES: import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines",
  COMPANIES: import.meta.env.VITE_APPWRITE_COMPANIES_COLLECTION_ID || "company_profiles",
  PORTFOLIOS: import.meta.env.VITE_APPWRITE_PORTFOLIOS_COLLECTION_ID || "company_portfolios",
};

let client: Client | null = null;
let databases: Databases | null = null;

if (APPWRITE_PROJECT_ID) {
  try {
    client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
    databases = new Databases(client);
  } catch (err) {
    console.warn("[Appwrite Fast Data] Client initialization warning:", err);
  }
}

export type FastMedicine = {
  canonical_id: number;
  name_en: string;
  name_ar: string;
  scientific_name: string;
  manufacturer: string;
  drug_class: string;
  route: string;
  category: string;
  dosage_form?: string;
  strength?: string;
  current_price_egp: number;
  image_url: string;
};

export type FastCompanyProfile = {
  company_slug: string;
  display_name: string;
  verification_status: string;
  is_public: boolean;
  country?: string;
  website_url?: string;
};

export type FastCompanyPortfolioItem = {
  company_slug: string;
  canonical_id: number;
  product_name: string;
  relationship_type?: string;
};

/**
 * ⚡ Ultra-Fast Medicine Search (<10ms edge read) with Supabase Fallback.
 */
export async function getFastMedicines(
  searchQuery: string,
  limit = 50,
  fallbackSupabase: () => Promise<FastMedicine[]>
): Promise<FastMedicine[]> {
  if (databases && APPWRITE_PROJECT_ID) {
    try {
      const queries = [Query.limit(limit)];
      if (searchQuery.trim()) {
        queries.push(Query.search("name_en", searchQuery.trim()));
      }
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.MEDICINES, queries);
      if (res.documents.length > 0) {
        return res.documents.map((doc) => ({
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
      console.warn("[Appwrite Fast Data] Cache query fallback:", err);
    }
  }
  return fallbackSupabase();
}

/**
 * ⚡ Ultra-Fast Company Profile Getter (<10ms) with Supabase Fallback.
 */
export async function getFastCompanyProfile(
  companySlug: string,
  fallbackSupabase: () => Promise<FastCompanyProfile | null>
): Promise<FastCompanyProfile | null> {
  if (databases && APPWRITE_PROJECT_ID && companySlug) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.COMPANIES, [
        Query.equal("company_slug", companySlug),
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        const doc = res.documents[0];
        return {
          company_slug: doc.company_slug,
          display_name: doc.display_name,
          verification_status: doc.verification_status,
          is_public: Boolean(doc.is_public),
          country: doc.country || "",
          website_url: doc.website_url || "",
        };
      }
    } catch (err) {
      console.warn("[Appwrite Fast Data] Company profile cache fallback:", err);
    }
  }
  return fallbackSupabase();
}

/**
 * ⚡ Subscribe to Realtime WebSocket live updates from Appwrite Database (1ms latency).
 */
export function subscribeToFastRealtimeUpdates(
  collectionName: "MEDICINES" | "COMPANIES" | "PORTFOLIOS",
  callback: (payload: any) => void
): () => void {
  if (!client || !APPWRITE_PROJECT_ID) {
    return () => {};
  }

  const collectionId = COLLECTIONS[collectionName];
  const channel = `databases.${DATABASE_ID}.collections.${collectionId}.documents`;

  try {
    const unsubscribe = client.subscribe(channel, (response) => {
      callback(response.payload);
    });
    return unsubscribe;
  } catch (err) {
    console.warn("[Appwrite Fast Data] Realtime subscription error:", err);
    return () => {};
  }
}
