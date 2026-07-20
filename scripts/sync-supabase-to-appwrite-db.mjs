// scripts/sync-supabase-to-appwrite-db.mjs
import { Client, Databases, ID } from "node-appwrite";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://edgbirxeafstvqdpxgxv.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZ2JpcnhlYWZzdHZxZHB4Z3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc5MjksImV4cCI6MjA4NjU2MzkyOX0.mJb-zB4f9e1Kx7B7z9d0J1K2L3M4N5O6P7Q8R9S0T1U";
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

console.log("🚀 Starting Supabase ➔ Appwrite Database Cache Sync...");

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.log("ℹ️ Appwrite Project ID / API Key environment variables not provided.");
  console.log("To run automatic synchronization, set APPWRITE_PROJECT_ID and APPWRITE_API_KEY environment variables.");
  process.exit(0);
}

const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

async function runSync() {
  try {
    // 1. Ensure Database exists
    try {
      await databases.get(DATABASE_ID);
    } catch {
      console.log(`Creating Appwrite Database: ${DATABASE_ID}...`);
      await databases.create(DATABASE_ID, DATABASE_ID);
    }

    // 2. Ensure Collection exists
    try {
      await databases.getCollection(DATABASE_ID, COLLECTION_ID);
    } catch {
      console.log(`Creating Appwrite Collection: ${COLLECTION_ID}...`);
      await databases.createCollection(DATABASE_ID, COLLECTION_ID, COLLECTION_ID);
      
      // Create attributes
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "name_en", 255, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "name_ar", 255, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "scientific_name", 255, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "manufacturer", 255, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "drug_class", 255, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "route", 100, false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "category", 100, false);
      await databases.createFloatAttribute(DATABASE_ID, COLLECTION_ID, "current_price_egp", false);
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "image_url", 1024, false);
    }

    // 3. Fetch public medicines from Supabase view
    console.log("📥 Fetching products from Supabase view (medicine_encyclopedia_products_v2)...");
    const supabaseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,current_price_egp,image_url&limit=1000`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!supabaseRes.ok) {
      throw new Error(`Supabase query failed: ${supabaseRes.statusText}`);
    }

    const products = await supabaseRes.json();
    console.log(`Syncing ${products.length} products to Appwrite Database collection...`);

    let syncedCount = 0;
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

      try {
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, docId, payload);
      } catch {
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, docId, payload);
      }
      syncedCount++;
    }

    console.log(`\n🎉 Successfully synced ${syncedCount} catalog items to Appwrite Database Edge Cache!`);
  } catch (err) {
    console.error("❌ Sync Error:", err);
  }
}

runSync();
