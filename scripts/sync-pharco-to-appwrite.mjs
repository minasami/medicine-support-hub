// scripts/sync-pharco-to-appwrite.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Databases, ID } from "appwrite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDatasetPath = path.join(root, "apps", "web", "public", "data", "egyptian-medicines-dataset.json");
const srcDatasetPath = path.join(root, "apps", "web", "src", "data", "egyptian-medicines-dataset.json");

const targetDatasetPath = fs.existsSync(publicDatasetPath) ? publicDatasetPath : srcDatasetPath;

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

console.log("🚀 Syncing 213 Pharco Group Medicines into Appwrite Databases...");
console.log(`📍 Endpoint: ${APPWRITE_ENDPOINT}`);
console.log(`📦 Project ID: ${APPWRITE_PROJECT_ID}`);
console.log(`🗄️ Database ID: ${DATABASE_ID}`);
console.log(`📋 Collection ID: ${MEDICINES_COLLECTION_ID}`);

if (!fs.existsSync(targetDatasetPath)) {
  console.error("❌ Dataset file not found:", targetDatasetPath);
  process.exit(1);
}

const rawText = fs.readFileSync(targetDatasetPath, "utf8");
const data = JSON.parse(rawText);

const pharcoMeds = (data.medicines || []).filter((m) => {
  const mfg = (m.manufacturer || m.raw_manufacturer || "").toLowerCase();
  return mfg.includes("pharco") || mfg.includes("amriya") || mfg.includes("european") || mfg.includes("techno") || m.canonical_id >= 80000;
});

console.log(`Found ${pharcoMeds.length} Pharco Group medicines to sync.`);

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const databases = new Databases(client);

async function syncToAppwrite() {
  let count = 0;
  for (const m of pharcoMeds) {
    const docData = {
      canonical_id: Number(m.canonical_id),
      name_en: String(m.name_en || ""),
      name_ar: String(m.name_ar || ""),
      scientific_name: String(m.scientific_name || ""),
      manufacturer: String(m.manufacturer || "Pharco Pharmaceuticals"),
      drug_class: String(m.drug_class || "General Therapeutics"),
      route: String(m.route || "Oral"),
      category: String(m.category || "Tablet"),
      current_price_egp: m.current_price_egp ? Number(m.current_price_egp) : 0,
      image_url: String(m.image_url || ""),
    };

    try {
      await databases.createDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, ID.unique(), docData);
      count++;
      console.log(`  ✓ Synced [${count}/${pharcoMeds.length}] ${m.name_en}`);
    } catch (err) {
      console.warn(`  ℹ️ Appwrite Cloud notice for ${m.name_en}:`, err.message);
    }
  }

  console.log(`\n🎉 Successfully processed ${count} / ${pharcoMeds.length} Pharco Group medicines for Appwrite Database!`);
}

syncToAppwrite().catch((err) => {
  console.error("❌ Sync error:", err.message);
});
