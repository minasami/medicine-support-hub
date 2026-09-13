#!/usr/bin/env node
/**
 * Idempotent provision for search_logs, annotations, fcm_tokens + medicines ranking attrs.
 * Usage: APPWRITE_API_KEY=... node scripts/provision-upgrade-collections.mjs
 */
import { Client, Databases } from "node-appwrite";

const ENDPOINT =
  process.env.APPWRITE_ENDPOINT || "https://appwrite.medicinesupport.app/v1";
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const KEY = process.env.APPWRITE_API_KEY || "";
const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

const databases = new Databases(
  new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY),
);

async function ensureCollection(id, name, attrs, indexes = []) {
  try {
    await databases.getCollection(DB, id);
    console.log("exists", id);
  } catch {
    const { Permission, Role } = await import("node-appwrite");
    await databases.createCollection(
      DB,
      id,
      name,
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      true,
      true,
    );
    console.log("created", id);
  }
  const existing = await databases.listAttributes(DB, id);
  const have = new Set(existing.attributes.map((a) => a.key));
  for (const a of attrs) {
    if (have.has(a.key)) continue;
    if (a.type === "string")
      await databases.createStringAttribute(DB, id, a.key, a.size || 255, !!a.required, a.default, !!a.array);
    else if (a.type === "integer")
      await databases.createIntegerAttribute(DB, id, a.key, !!a.required, undefined, undefined, a.default);
    else if (a.type === "double")
      await databases.createFloatAttribute(DB, id, a.key, !!a.required, undefined, undefined, a.default);
    else if (a.type === "datetime")
      await databases.createDatetimeAttribute(DB, id, a.key, !!a.required, a.default);
    console.log("+attr", id, a.key);
  }
  await new Promise((r) => setTimeout(r, 2500));
  let idxList = { indexes: [] };
  try {
    idxList = await databases.listIndexes(DB, id);
  } catch {}
  const haveIdx = new Set((idxList.indexes || []).map((i) => i.key));
  for (const ix of indexes) {
    if (haveIdx.has(ix.key)) continue;
    try {
      await databases.createIndex(DB, id, ix.key, ix.type, ix.attributes, ix.orders);
      console.log("+index", id, ix.key);
    } catch (e) {
      console.warn("!index", id, ix.key, e.message);
    }
  }
}

await ensureCollection(
  "search_logs",
  "Search Logs",
  [
    { key: "user_id", type: "string", size: 64 },
    { key: "query", type: "string", size: 256 },
    { key: "drug_id", type: "string", size: 64 },
    { key: "medicine_id", type: "string", size: 64 },
    { key: "canonical_id", type: "integer" },
    { key: "timestamp", type: "datetime" },
    { key: "source", type: "string", size: 64 },
  ],
  [
    { key: "idx_timestamp", type: "key", attributes: ["timestamp"], orders: ["DESC"] },
    { key: "idx_drug_id", type: "key", attributes: ["drug_id"], orders: ["ASC"] },
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "annotations",
  "OCR Annotations (RLAIF)",
  [
    { key: "image_crop_id", type: "string", size: 128 },
    { key: "user_id", type: "string", size: 64 },
    { key: "label_json", type: "string", size: 8192 },
    { key: "votes", type: "string", size: 512, array: true },
    { key: "status", type: "string", size: 32, default: "pending" },
    { key: "created_at", type: "datetime" },
    { key: "confidence", type: "double" },
    { key: "drug_name", type: "string", size: 256 },
  ],
  [
    { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    { key: "idx_created_at", type: "key", attributes: ["created_at"], orders: ["DESC"] },
  ],
);

await ensureCollection(
  "fcm_tokens",
  "FCM Push Tokens",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "token", type: "string", size: 512, required: true },
    { key: "platform", type: "string", size: 32 },
    { key: "updated_at", type: "datetime" },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_token", type: "key", attributes: ["token"], orders: ["ASC"] },
  ],
);

{
  const id = "medicines";
  const existing = await databases.listAttributes(DB, id);
  const have = new Set(existing.attributes.map((a) => a.key));
  for (const a of [
    { key: "search_score", type: "double", default: 0 },
    { key: "search_count_30d", type: "integer", default: 0 },
    { key: "order_count_30d", type: "integer", default: 0 },
    { key: "completeness_score", type: "double", default: 0 },
    { key: "description", type: "string", size: 4096 },
    { key: "ingredients", type: "string", size: 2048 },
  ]) {
    if (have.has(a.key)) continue;
    if (a.type === "string")
      await databases.createStringAttribute(DB, id, a.key, a.size, false);
    else if (a.type === "integer")
      await databases.createIntegerAttribute(DB, id, a.key, false, undefined, undefined, a.default);
    else if (a.type === "double")
      await databases.createFloatAttribute(DB, id, a.key, false, undefined, undefined, a.default);
    console.log("+attr medicines", a.key);
  }
  await new Promise((r) => setTimeout(r, 4000));
  const idxList = await databases.listIndexes(DB, id);
  const haveIdx = new Set(idxList.indexes.map((i) => i.key));
  for (const ix of [
    { key: "idx_key_search_score", type: "key", attributes: ["search_score"], orders: ["DESC"] },
    { key: "idx_key_search_count_30d", type: "key", attributes: ["search_count_30d"], orders: ["DESC"] },
    { key: "idx_key_completeness_score", type: "key", attributes: ["completeness_score"], orders: ["DESC"] },
  ]) {
    if (haveIdx.has(ix.key)) continue;
    try {
      await databases.createIndex(DB, id, ix.key, ix.type, ix.attributes, ix.orders);
      console.log("+index", ix.key);
    } catch (e) {
      console.warn("!", ix.key, e.message);
    }
  }
}

console.log("done");
