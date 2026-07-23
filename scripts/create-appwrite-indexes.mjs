// scripts/create-appwrite-indexes.mjs
import { Client, Databases } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

if (!APPWRITE_API_KEY) {
  console.error("❌ Error: APPWRITE_API_KEY is not defined in your environment or .env file.");
  console.log("Please add your Appwrite API Key to your .env file to create database indexes.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

const indexesToCreate = [
  { key: "idx_name_en", type: "fulltext", attributes: ["name_en"], orders: ["ASC"] },
  { key: "idx_manufacturer", type: "key", attributes: ["manufacturer"], orders: ["ASC"] },
  { key: "idx_category", type: "key", attributes: ["category"], orders: ["ASC"] },
  { key: "idx_drug_class", type: "key", attributes: ["drug_class"], orders: ["ASC"] },
  { key: "idx_route", type: "key", attributes: ["route"], orders: ["ASC"] },
  { key: "idx_scientific_name", type: "key", attributes: ["scientific_name"], orders: ["ASC"] },
];

async function createIndexes() {
  console.log("🚀 Initializing Appwrite Database Index Creation...");
  console.log(`📍 Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`📦 Collection: ${MEDICINES_COLLECTION_ID}\n`);

  for (const index of indexesToCreate) {
    try {
      console.log(`➕ Creating index '${index.key}' (${index.type}) on attributes [${index.attributes.join(", ")}]...`);
      await databases.createIndex(
        DATABASE_ID,
        MEDICINES_COLLECTION_ID,
        index.key,
        index.type,
        index.attributes,
        index.orders
      );
      console.log(`  ✓ Index '${index.key}' created successfully.\n`);
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log(`  ✓ Index '${index.key}' already exists.\n`);
      } else {
        console.error(`  ❌ Failed to create index '${index.key}':`, err.message, "\n");
      }
    }
  }
  console.log("🎉 Index configuration completed!");
}

createIndexes();
