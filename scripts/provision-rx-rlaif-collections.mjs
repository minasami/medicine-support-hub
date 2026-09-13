#!/usr/bin/env node
/**
 * Idempotent provision for Prescription → Pharmacy Negotiation + RLAIF collections.
 *
 * Creates/extends:
 *   prescriptions, prescription_items, orders, order_quotes, order_messages,
 *   pharmacies, annotations (extend), user_profiles (trust/role attrs), user_trust
 * Bucket: prescription-images (best-effort)
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/provision-rx-rlaif-collections.mjs
 */
import { Client, Databases, Storage, Permission, Role, Query, ID } from "node-appwrite";
import fs from "node:fs";
import path from "node:path";

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
const BUCKET = process.env.APPWRITE_RX_BUCKET || "prescription-images";

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const databases = new Databases(client);
const storage = new Storage(client);

const report = {
  endpoint: ENDPOINT,
  project: PROJECT,
  database: DB,
  collections: {},
  attributes: [],
  indexes: [],
  bucket: null,
  errors: [],
};

const permsUsers = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];
const permsAnyReadUsersWrite = [
  Permission.read(Role.any()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function ensureCollection(id, name, attrs, indexes = [], permissions = permsUsers) {
  try {
    await databases.getCollection(DB, id);
    console.log("exists", id);
    report.collections[id] = id;
  } catch {
    await databases.createCollection(DB, id, name, permissions, true, true);
    console.log("created", id);
    report.collections[id] = id;
  }

  const existing = await databases.listAttributes(DB, id, [Query.limit(100)]);
  const have = new Set(existing.attributes.map((a) => a.key));
  for (const a of attrs) {
    if (have.has(a.key)) continue;
    try {
      if (a.type === "string")
        await databases.createStringAttribute(
          DB,
          id,
          a.key,
          a.size || 255,
          !!a.required,
          a.default,
          !!a.array,
        );
      else if (a.type === "integer")
        await databases.createIntegerAttribute(
          DB,
          id,
          a.key,
          !!a.required,
          undefined,
          undefined,
          a.default,
        );
      else if (a.type === "double")
        await databases.createFloatAttribute(
          DB,
          id,
          a.key,
          !!a.required,
          undefined,
          undefined,
          a.default,
        );
      else if (a.type === "datetime")
        await databases.createDatetimeAttribute(DB, id, a.key, !!a.required, a.default);
      else if (a.type === "boolean")
        await databases.createBooleanAttribute(DB, id, a.key, !!a.required, a.default);
      console.log("+attr", id, a.key);
      report.attributes.push(`${id}.${a.key}`);
    } catch (e) {
      if (!/already exists/i.test(e.message || "")) {
        report.errors.push(`attr ${id}.${a.key}: ${e.message || e}`);
        console.warn("!attr", id, a.key, e.message);
      } else {
        console.log("exists-attr", id, a.key);
      }
    }
  }

  // Wait for attrs to become available before indexes
  await new Promise((r) => setTimeout(r, 3000));

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
      report.indexes.push(`${id}.${ix.key}`);
    } catch (e) {
      report.errors.push(`idx ${id}.${ix.key}: ${e.message || e}`);
      console.warn("!index", id, ix.key, e.message);
    }
  }
}

await ensureCollection(
  "prescriptions",
  "Prescriptions",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "image_id", type: "string", size: 128 },
    { key: "image_url", type: "string", size: 512 },
    { key: "status", type: "string", size: 32, default: "parsed" },
    { key: "pharmacy_id", type: "string", size: 64 },
    { key: "ai_parsed_json", type: "string", size: 16384 },
    { key: "confidence_score", type: "double", default: 0 },
    { key: "final_order_json", type: "string", size: 16384 },
    { key: "parse_source", type: "string", size: 64 },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    { key: "idx_pharmacy_id", type: "key", attributes: ["pharmacy_id"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "prescription_items",
  "Prescription Items",
  [
    { key: "prescription_id", type: "string", size: 64, required: true },
    { key: "drug_name", type: "string", size: 256, required: true },
    { key: "suggested_dose", type: "string", size: 128 },
    { key: "frequency", type: "string", size: 128 },
    { key: "duration", type: "string", size: 128 },
    { key: "confidence", type: "double", default: 0 },
    { key: "user_edited", type: "boolean", default: false },
    { key: "status", type: "string", size: 32, default: "ai" },
  ],
  [
    { key: "idx_prescription_id", type: "key", attributes: ["prescription_id"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "orders",
  "Rx Pharmacy Orders",
  [
    { key: "prescription_id", type: "string", size: 64, required: true },
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "pharmacy_id", type: "string", size: 64, required: true },
    { key: "items_json", type: "string", size: 16384 },
    { key: "status", type: "string", size: 32, default: "sent" },
    { key: "current_quote_id", type: "string", size: 64 },
    { key: "quote_price", type: "double", default: 0 },
    { key: "currency", type: "string", size: 8, default: "EGP" },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_pharmacy_id", type: "key", attributes: ["pharmacy_id"], orders: ["ASC"] },
    { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    { key: "idx_prescription_id", type: "key", attributes: ["prescription_id"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "order_quotes",
  "Order Quotes (versioned)",
  [
    { key: "order_id", type: "string", size: 64, required: true },
    { key: "pharmacy_id", type: "string", size: 64, required: true },
    { key: "quoted_items_json", type: "string", size: 16384, required: true },
    { key: "total_price", type: "double", required: true },
    { key: "notes", type: "string", size: 2048 },
    { key: "status", type: "string", size: 32, default: "sent" },
    { key: "version", type: "integer", default: 1 },
    { key: "currency", type: "string", size: 8, default: "EGP" },
  ],
  [
    { key: "idx_order_id", type: "key", attributes: ["order_id"], orders: ["ASC"] },
    { key: "idx_order_version", type: "key", attributes: ["order_id", "version"], orders: ["ASC", "DESC"] },
  ],
);

await ensureCollection(
  "order_messages",
  "Order Chat Messages",
  [
    { key: "order_id", type: "string", size: 64, required: true },
    { key: "sender_id", type: "string", size: 64, required: true },
    { key: "sender_role", type: "string", size: 32, required: true },
    { key: "message", type: "string", size: 4096 },
    { key: "attachments", type: "string", size: 2048 },
    { key: "timestamp", type: "datetime", required: true },
  ],
  [
    { key: "idx_order_id", type: "key", attributes: ["order_id"], orders: ["ASC"] },
    { key: "idx_timestamp", type: "key", attributes: ["timestamp"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "pharmacies",
  "Pharmacies (Rx negotiation)",
  [
    { key: "name", type: "string", size: 256, required: true },
    { key: "lat", type: "double" },
    { key: "lng", type: "double" },
    { key: "address", type: "string", size: 512 },
    { key: "is_active", type: "boolean", default: true },
    { key: "owner_user_id", type: "string", size: 64 },
    { key: "user_id", type: "string", size: 64 },
    { key: "notify_user_id", type: "string", size: 64 },
    { key: "phone", type: "string", size: 64 },
  ],
  [
    { key: "idx_is_active", type: "key", attributes: ["is_active"], orders: ["ASC"] },
    { key: "idx_name", type: "fulltext", attributes: ["name"] },
  ],
  permsAnyReadUsersWrite,
);

// Extend annotations for RLAIF Rx queue
await ensureCollection(
  "annotations",
  "OCR Annotations (RLAIF)",
  [
    { key: "image_crop_id", type: "string", size: 128 },
    { key: "image_id", type: "string", size: 128 },
    { key: "prescription_id", type: "string", size: 64 },
    { key: "user_id", type: "string", size: 64 },
    { key: "label_json", type: "string", size: 8192 },
    { key: "ai_parsed_json", type: "string", size: 16384 },
    { key: "ground_truth_json", type: "string", size: 16384 },
    { key: "votes", type: "string", size: 512, array: true },
    { key: "status", type: "string", size: 32, default: "pending" },
    { key: "created_at", type: "datetime" },
    { key: "confidence", type: "double" },
    { key: "drug_name", type: "string", size: 256 },
    { key: "assigned_pharmacists", type: "string", size: 1024 },
  ],
  [
    { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    { key: "idx_created_at", type: "key", attributes: ["created_at"], orders: ["DESC"] },
    { key: "idx_prescription_id", type: "key", attributes: ["prescription_id"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "user_profiles",
  "User Profiles",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "role", type: "string", size: 64 },
    { key: "trust_score", type: "double", default: 50 },
    { key: "is_verified_pharmacist", type: "boolean", default: false },
    { key: "display_name", type: "string", size: 256 },
    { key: "annotation_points", type: "integer", default: 0 },
    { key: "annotation_streak", type: "integer", default: 0 },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_role", type: "key", attributes: ["role"], orders: ["ASC"] },
  ],
);

await ensureCollection(
  "user_trust",
  "User TrustScore",
  [
    { key: "user_id", type: "string", size: 64, required: true },
    { key: "approved_count", type: "integer", default: 0 },
    { key: "rejected_count", type: "integer", default: 0 },
    { key: "account_created_at", type: "datetime" },
    { key: "is_verified_rep", type: "boolean", default: false },
    { key: "is_pharmacist", type: "boolean", default: false },
    { key: "trust_score", type: "double", default: 0 },
    { key: "updated_at", type: "datetime" },
  ],
  [
    { key: "idx_user_id", type: "key", attributes: ["user_id"], orders: ["ASC"] },
    { key: "idx_trust_score", type: "key", attributes: ["trust_score"], orders: ["DESC"] },
  ],
);

// Bucket for Rx images
try {
  await storage.getBucket(BUCKET);
  console.log("exists bucket", BUCKET);
  report.bucket = BUCKET;
} catch {
  try {
    await storage.createBucket(
      BUCKET,
      "Prescription Images",
      [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      true,
      true,
      undefined,
      ["jpg", "jpeg", "png", "webp", "heic", "pdf"],
    );
    console.log("created bucket", BUCKET);
    report.bucket = BUCKET;
  } catch (e) {
    report.errors.push(`bucket ${BUCKET}: ${e.message || e}`);
    console.warn("!bucket", e.message);
  }
}

// Seed a couple demo pharmacies if empty
try {
  const existing = await databases.listDocuments(DB, "pharmacies", [Query.limit(1)]);
  if ((existing.total || 0) === 0) {
    const seeds = [
      {
        name: "Demo Nile Pharmacy",
        lat: 30.0444,
        lng: 31.2357,
        address: "Downtown Cairo",
        is_active: true,
        phone: "+20-2-0000-0001",
      },
      {
        name: "Demo Maadi Care Pharmacy",
        lat: 29.9602,
        lng: 31.2769,
        address: "Maadi, Cairo",
        is_active: true,
        phone: "+20-2-0000-0002",
      },
      {
        name: "Demo Alexandria Rx",
        lat: 31.2001,
        lng: 29.9187,
        address: "Alexandria",
        is_active: true,
        phone: "+20-3-0000-0003",
      },
    ];
    for (const s of seeds) {
      await databases.createDocument(DB, "pharmacies", ID.unique(), s);
      console.log("+seed pharmacy", s.name);
    }
  }
} catch (e) {
  report.errors.push(`seed pharmacies: ${e.message || e}`);
  console.warn("!seed", e.message);
}

const outDir = path.join(process.cwd(), "artifacts");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "rx-rlaif-collections-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("done →", outPath);
console.log(JSON.stringify(report.collections, null, 2));
