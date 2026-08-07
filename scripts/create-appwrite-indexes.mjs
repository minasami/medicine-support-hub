// scripts/create-appwrite-indexes.mjs
// Optimize Appwrite fulltext + filter indexes for medicines catalog search.
// Usage: APPWRITE_API_KEY=... node scripts/create-appwrite-indexes.mjs
import { Client, Databases } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

if (!APPWRITE_API_KEY) {
  console.error("❌ APPWRITE_API_KEY is required.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

const indexesToCreate = [
  { key: "idx_ft_name_en", type: "fulltext", attributes: ["name_en"] },
  { key: "idx_ft_name_ar", type: "fulltext", attributes: ["name_ar"] },
  { key: "idx_ft_scientific_name", type: "fulltext", attributes: ["scientific_name"] },
  { key: "idx_ft_manufacturer", type: "fulltext", attributes: ["manufacturer"] },
  { key: "idx_ft_barcode", type: "fulltext", attributes: ["barcode"] },
  { key: "idx_key_manufacturer", type: "key", attributes: ["manufacturer"], orders: ["ASC"] },
  { key: "idx_key_category", type: "key", attributes: ["category"], orders: ["ASC"] },
  { key: "idx_key_drug_class", type: "key", attributes: ["drug_class"], orders: ["ASC"] },
  { key: "idx_key_route", type: "key", attributes: ["route"], orders: ["ASC"] },
  { key: "idx_key_scientific_name", type: "key", attributes: ["scientific_name"], orders: ["ASC"] },
  { key: "idx_key_name_en", type: "key", attributes: ["name_en"], orders: ["ASC"] },
  { key: "idx_key_canonical_id", type: "key", attributes: ["canonical_id"], orders: ["ASC"] },
  { key: "idx_key_has_verified", type: "key", attributes: ["has_verified_dataset"], orders: ["ASC"] },
  { key: "idx_key_company_slug", type: "key", attributes: ["company_slug"], orders: ["ASC"] },
];

async function createIndexes() {
  console.log("🚀 Appwrite medicines index optimization");
  console.log(`📍 ${APPWRITE_ENDPOINT}`);
  console.log(`📦 ${DATABASE_ID}/${MEDICINES_COLLECTION_ID}\n`);

  let created = 0;
  let existed = 0;
  let failed = 0;

  for (const index of indexesToCreate) {
    try {
      console.log(`➕ ${index.key} (${index.type}) → [${index.attributes.join(", ")}]`);
      await databases.createIndex(
        DATABASE_ID,
        MEDICINES_COLLECTION_ID,
        index.key,
        index.type,
        index.attributes,
        index.orders || index.attributes.map(() => "ASC"),
      );
      console.log(`  ✓ created\n`);
      created += 1;
    } catch (err) {
      const msg = String(err?.message || err);
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`  ✓ already exists\n`);
        existed += 1;
      } else if (/attribute|not found|unknown/i.test(msg)) {
        console.warn(`  ⚠ skipped (attribute missing?): ${msg}\n`);
        failed += 1;
      } else {
        console.error(`  ❌ ${msg}\n`);
        failed += 1;
      }
    }
  }

  console.log("———");
  console.log(`created=${created} existed=${existed} failed/skipped=${failed}`);
  console.log("🎉 Done. Fulltext indexes may take a few minutes to build on large collections.");
}

createIndexes();
