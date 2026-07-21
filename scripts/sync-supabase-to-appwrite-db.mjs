// scripts/sync-supabase-to-appwrite-db.mjs
import { Client, Databases } from "node-appwrite";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://edgbirxeafstvqdpxgxv.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZ2JpcnhlYWZzdHZxZHB4Z3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc5MjksImV4cCI6MjA4NjU2MzkyOX0.mJb-zB4f9e1Kx7B7z9d0J1K2L3M4N5O6P7Q8R9S0T1U";
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";
const COMPANIES_COLLECTION_ID = process.env.APPWRITE_COMPANIES_COLLECTION_ID || "company_profiles";
const PORTFOLIOS_COLLECTION_ID = process.env.APPWRITE_PORTFOLIOS_COLLECTION_ID || "company_portfolios";

console.log("🚀 Starting Supabase ➔ Appwrite Multi-Collection Sync...");

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.log("ℹ️ Appwrite environment variables (APPWRITE_PROJECT_ID, APPWRITE_API_KEY) missing.");
  console.log("To run full automatic sync, set APPWRITE_PROJECT_ID and APPWRITE_API_KEY.");
  process.exit(0);
}

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

async function runSync() {
  try {
    // 1. Database
    try { await databases.get(DATABASE_ID); } catch { await databases.create(DATABASE_ID, DATABASE_ID); }

    // 2. Collection: medicines
    try { await databases.getCollection(DATABASE_ID, MEDICINES_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, MEDICINES_COLLECTION_ID, MEDICINES_COLLECTION_ID);
      await databases.createIntegerAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "name_en", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "name_ar", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "scientific_name", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "manufacturer", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "drug_class", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "route", 100, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "category", 100, false);
      await databases.createFloatAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "current_price_egp", false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "image_url", 1024, false);
    }

    // 3. Collection: company_profiles
    try { await databases.getCollection(DATABASE_ID, COMPANIES_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, COMPANIES_COLLECTION_ID, COMPANIES_COLLECTION_ID);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "company_slug", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "display_name", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "verification_status", 50, false);
      await databases.createBooleanAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "is_public", false);
    }

    // 4. Collection: company_portfolios
    try { await databases.getCollection(DATABASE_ID, PORTFOLIOS_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, PORTFOLIOS_COLLECTION_ID);
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "company_slug", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "product_name", 255, false);
    }

    // Sync Medicines
    console.log("📥 Syncing medicines collection...");
    const medRes = await fetch(`${SUPABASE_URL}/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,current_price_egp,image_url&limit=1000`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (medRes.ok) {
      const products = await medRes.json();
      for (const p of products) {
        const docId = `med_${p.canonical_id}`;
        const payload = {
          canonical_id: p.canonical_id,
          name_en: (p.name_en || "").substring(0, 255),
          name_ar: (p.name_ar || "").substring(0, 255),
          scientific_name: (p.scientific_name || "").substring(0, 255),
          manufacturer: (p.manufacturer || "").substring(0, 255),
          drug_class: (p.drug_class || "").substring(0, 255),
          route: (p.route || "").substring(0, 100),
          category: (p.category || "").substring(0, 100),
          current_price_egp: p.current_price_egp ? Number(p.current_price_egp) : 0,
          image_url: (p.image_url || "").substring(0, 1024),
        };
        try { await databases.updateDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
      }
      console.log(`✅ Synced ${products.length} medicines.`);
    }

    // Sync Company Profiles
    console.log("📥 Syncing company_profiles collection...");
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/industry_company_profiles?select=company_slug,display_name,verification_status,is_public&limit=500`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (compRes.ok) {
      const companies = await compRes.json();
      for (const c of companies) {
        if (!c.company_slug) continue;
        const docId = `comp_${c.company_slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const payload = {
          company_slug: c.company_slug.substring(0, 255),
          display_name: (c.display_name || c.company_slug).substring(0, 255),
          verification_status: (c.verification_status || "unverified").substring(0, 50),
          is_public: Boolean(c.is_public),
        };
        try { await databases.updateDocument(DATABASE_ID, COMPANIES_COLLECTION_ID, docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, COMPANIES_COLLECTION_ID, docId, payload); }
      }
      console.log(`✅ Synced ${companies.length} company profiles.`);
    }

    console.log("\n🎉 Full Multi-Collection Appwrite Edge Database Sync Complete!");
  } catch (err) {
    console.error("❌ Sync Error:", err);
  }
}

runSync();
