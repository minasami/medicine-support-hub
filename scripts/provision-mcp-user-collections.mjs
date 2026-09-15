#!/usr/bin/env node
/**
 * Idempotent provision for MCP OAuth user collections:
 *   mcp_support_requests, user_watchlist
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/provision-mcp-user-collections.mjs
 */
import { Client, Databases, Permission, Role, Query } from "node-appwrite";

const ENDPOINT =
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1";
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

const databases = new Databases(new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY));

const perms = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function ensureCollection(id, name, attrs, indexes = []) {
  try {
    await databases.getCollection(DB, id);
    console.log("exists", id);
  } catch {
    await databases.createCollection(DB, id, name, perms, true, true);
    console.log("created", id);
  }
  const existing = await databases.listAttributes(DB, id, [Query.limit(100)]);
  const have = new Set(existing.attributes.map((a) => a.key));
  for (const a of attrs) {
    if (have.has(a.key)) continue;
    try {
      if (a.type === "string")
        await databases.createStringAttribute(DB, id, a.key, a.size || 255, !!a.required, a.default, !!a.array);
      else if (a.type === "integer")
        await databases.createIntegerAttribute(DB, id, a.key, !!a.required, undefined, undefined, a.default);
      else if (a.type === "double")
        await databases.createFloatAttribute(DB, id, a.key, !!a.required, undefined, undefined, a.default);
      else if (a.type === "datetime")
        await databases.createDatetimeAttribute(DB, id, a.key, !!a.required, a.default);
      else if (a.type === "boolean")
        await databases.createBooleanAttribute(DB, id, a.key, !!a.required, a.default);
      console.log("+attr", id, a.key);
    } catch (e) {
      if (!/already exists/i.test(e.message || "")) console.warn("!attr", id, a.key, e.message);
    }
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
  "mcp_support_requests",
  "MCP Support Requests",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "medicine_summary", type: "string", size: 2000, required: true },
    { key: "clinical_notes", type: "string", size: 4000 },
    { key: "priority", type: "string", size: 32, default: "normal" },
    { key: "status", type: "string", size: 32, default: "submitted" },
    { key: "requested_months", type: "integer" },
    { key: "estimated_monthly_cost", type: "double" },
    { key: "contact_phone", type: "string", size: 64 },
    { key: "city", type: "string", size: 128 },
    { key: "source", type: "string", size: 32, default: "mcp" },
    { key: "created_at", type: "datetime" },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    { key: "idx_created_at", type: "key", attributes: ["created_at"], orders: ["DESC"] },
  ],
);

await ensureCollection(
  "user_watchlist",
  "User Price Watchlist",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "query", type: "string", size: 256 },
    { key: "medicine_id", type: "string", size: 64 },
    { key: "canonical_id", type: "integer" },
    { key: "name_en", type: "string", size: 256 },
    { key: "name_ar", type: "string", size: 256 },
    { key: "target_price_egp", type: "double" },
    { key: "active", type: "boolean", default: true },
    { key: "source", type: "string", size: 32, default: "mcp" },
    { key: "created_at", type: "datetime" },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_active", type: "key", attributes: ["active"], orders: ["ASC"] },
  ],
);

console.log("done — mapping:");
console.log(
  JSON.stringify(
    {
      mcp_support_requests:
        "Appwrite-native MCP/NGO personal support requests (replaces Supabase support_requests for connector writes)",
      user_watchlist: "Account-scoped price watchlist (separate from global MCP data/price-watchlist.json)",
      prescriptions: "Existing Appwrite Rx negotiation collection",
      drug_contributions: "Existing barcode wiki contributions",
    },
    null,
    2,
  ),
);
