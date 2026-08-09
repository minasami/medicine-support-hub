/**
 * Backfill is_medcare_toll + toll_manufacturer when text mentions Med-Care.
 *
 *   APPWRITE_API_KEY=... node scripts/backfill-medcare-toll.mjs [--dry-run] [--limit=500]
 */
import { Client, Databases, Query } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DB = "medicine_support_hub";
const COL = "medicines";
const KEY = process.env.APPWRITE_API_KEY;
const dry = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const pageLimit = limitArg ? Number(limitArg.split("=")[1]) : 100;

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

const MED = /med[\s-]?care/i;

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const db = new Databases(client);

let cursor = null;
let scanned = 0;
let updated = 0;
let already = 0;

console.log(dry ? "DRY RUN" : "LIVE", ENDPOINT, PROJECT);

for (let page = 0; page < 500; page++) {
  const queries = [Query.limit(pageLimit), Query.orderAsc("$id")];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const res = await db.listDocuments(DB, COL, queries);
  const docs = res.documents || [];
  if (!docs.length) break;

  for (const doc of docs) {
    scanned++;
    const mfg = String(doc.manufacturer || "");
    const toll = String(doc.toll_manufacturer || "");
    const hit = MED.test(mfg) || MED.test(toll);
    if (!hit) continue;
    if (doc.is_medcare_toll === true && toll) {
      already++;
      continue;
    }
    const patch = {
      is_medcare_toll: true,
      toll_manufacturer: toll || "Med-Care",
    };
    console.log(
      (dry ? "would update" : "update"),
      doc.canonical_id,
      doc.name_en || doc.$id,
    );
    if (!dry) {
      await db.updateDocument(DB, COL, doc.$id, patch);
      updated++;
    } else {
      updated++;
    }
  }
  cursor = docs[docs.length - 1].$id;
  if (docs.length < pageLimit) break;
}

console.log({ scanned, updated, already, dry });
