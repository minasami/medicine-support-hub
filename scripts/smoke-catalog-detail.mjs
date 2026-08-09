#!/usr/bin/env node
import { Client, Databases, Query } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";
const API_KEY = process.env.APPWRITE_API_KEY || "";

const args = process.argv.slice(2);
function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const nameQ = argVal("--name") || "SCARO GEL";
const idQ = Number(argVal("--id") || "29945");

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
if (API_KEY) client.setKey(API_KEY);
const db = new Databases(client);

async function byCanonicalId(id) {
  const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
    Query.equal("canonical_id", [id]),
    Query.limit(1),
  ]);
  return res.documents?.[0] || null;
}

async function byName(term) {
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.search("name_en", term),
      Query.limit(5),
    ]);
    return res.documents || [];
  } catch {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.startsWith("name_en", term),
      Query.limit(5),
    ]);
    return res.documents || [];
  }
}

async function main() {
  console.log(`smoke  endpoint=${ENDPOINT}  project=${PROJECT_ID}`);
  let fail = 0;
  try {
    const doc = await byCanonicalId(idQ);
    if (doc) console.log(`✓ canonical_id=${idQ} → ${doc.name_en || doc.$id}`);
    else { console.error(`✗ canonical_id=${idQ} not found`); fail++; }
  } catch (e) {
    console.error(`✗ canonical_id query error:`, e?.message || e); fail++;
  }
  try {
    const docs = await byName(nameQ);
    if (docs.length)
      console.log(`✓ name search "${nameQ}" → ${docs.length} hit(s); first=${docs[0].name_en} id=${docs[0].canonical_id}`);
    else { console.error(`✗ name search "${nameQ}" empty`); fail++; }
  } catch (e) {
    console.error(`✗ name search error:`, e?.message || e); fail++;
  }
  if (fail) { console.error(`FAILED (${fail})`); process.exit(1); }
  console.log("OK");
}
main();
