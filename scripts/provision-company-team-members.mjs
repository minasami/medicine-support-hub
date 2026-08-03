#!/usr/bin/env node
/**
 * Provision Appwrite table company_team_members under medicine_support_hub.
 *
 * Requires: APPWRITE_API_KEY, APPWRITE_PROJECT_ID (or defaults),
 *           APPWRITE_ENDPOINT (default fra.cloud)
 *
 * Usage: node scripts/provision-company-team-members.mjs
 */
import { Client, Databases, ID } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_KEY || "";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const TABLE_ID = "company_team_members";

if (!KEY) {
  console.error("Set APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const databases = new Databases(client);

const stringAttrs = [
  ["company_slug", 128, true],
  ["company_name", 256, false],
  ["user_email", 256, true],
  ["user_id", 64, false],
  ["role", 64, true],
  ["product_lines", 2000, false],
  ["product_canonical_ids", 4000, false],
  ["status", 32, true],
  ["invited_by", 256, false],
  ["invited_at", 64, false],
  ["notes", 2000, false],
];

async function ensureCollection() {
  try {
    await databases.getCollection(DATABASE_ID, TABLE_ID);
    console.log("Collection exists:", TABLE_ID);
  } catch {
    await databases.createCollection(
      DATABASE_ID,
      TABLE_ID,
      TABLE_ID,
      undefined,
      true,
      true,
    );
    console.log("Created collection:", TABLE_ID);
  }
}

async function ensureAttrs() {
  for (const [key, size, required] of stringAttrs) {
    try {
      await databases.createStringAttribute(
        DATABASE_ID,
        TABLE_ID,
        key,
        size,
        required,
      );
      console.log("  attr", key);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.log("  attr skip", key, e?.message || e);
    }
  }
}

async function ensureIndexes() {
  const indexes = [
    ["idx_company_slug", ["company_slug"]],
    ["idx_user_email", ["user_email"]],
    ["idx_status", ["status"]],
  ];
  for (const [name, keys] of indexes) {
    try {
      await databases.createIndex(DATABASE_ID, TABLE_ID, name, "key", keys);
      console.log("  index", name);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.log("  index skip", name, e?.message || e);
    }
  }
}

async function main() {
  console.log("Provisioning", TABLE_ID, "on", DATABASE_ID);
  await ensureCollection();
  await ensureAttrs();
  await ensureIndexes();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
