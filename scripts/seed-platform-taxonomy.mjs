#!/usr/bin/env node
/**
 * Seed / refresh Appwrite `platform_taxonomy` from medicines aggregates.
 *
 *   APPWRITE_API_KEY=… node scripts/seed-platform-taxonomy.mjs
 *   APPWRITE_API_KEY=… node scripts/seed-platform-taxonomy.mjs --pages=40
 *
 * Never expose APPWRITE_API_KEY to the browser bundle.
 */
import { Client, Databases, Query, Permission, Role } from "node-appwrite";
import { createHash } from "node:crypto";

const KEY = process.env.APPWRITE_API_KEY || "";
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const EP = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const DB =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  "medicine_support_hub";
const COL = "platform_taxonomy";

const pagesArg = process.argv.find((a) => a.startsWith("--pages="));
const MAX_PAGES = pagesArg ? Number(pagesArg.split("=")[1]) || 80 : 80;

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

const client = new Client().setEndpoint(EP).setProject(PROJECT).setKey(KEY);
const databases = new Databases(client);

const SPLIT_RE = /\s*(?:\+|\/|&|;|\||\band\b)\s*/i;
function parseIngredients(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s
    .split(SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);
  const skip =
    /^(active ingredient|active pharmaceutical ingredients|n\/?a|unknown|null)$/i;
  return parts.filter((p) => !skip.test(p) && p.length >= 2 && p.length <= 120);
}
function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
function docIdFor(kind, valueKey) {
  const h = createHash("sha1").update(`${kind}|${valueKey}`).digest("hex").slice(0, 28);
  const prefix = kind.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "tax";
  return `${prefix}_${h}`.slice(0, 36);
}

const buckets = {
  dosage_form: new Map(),
  route: new Map(),
  category: new Map(),
  drug_class: new Map(),
  ingredient: new Map(),
  strength: new Map(),
  product_line: new Map(),
};

function add(kind, value) {
  const v = String(value || "").trim();
  if (!v || v.length > 255) return;
  const key = normalizeKey(v);
  if (!key) return;
  if (
    /^(therapeutic category|active ingredient|active pharmaceutical ingredients)$/i.test(
      v,
    )
  ) {
    if (kind === "ingredient" || kind === "drug_class") return;
  }
  const map = buckets[kind];
  if (!map.has(key)) map.set(key, v);
}

const PLACEHOLDER_SCI = /^(active ingredient|active pharmaceutical ingredients)$/i;
const PLACEHOLDER_CLASS = /^therapeutic category$/i;

let cursor = null;
let pages = 0;
while (pages < MAX_PAGES) {
  const queries = [Query.limit(100), Query.orderAsc("$id")];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const res = await databases.listDocuments(DB, "medicines", queries);
  if (!res.documents.length) break;
  for (const d of res.documents) {
    if (d.dosage_form) add("dosage_form", d.dosage_form);
    if (d.route) add("route", d.route);
    if (d.category) add("category", d.category);
    if (d.drug_class && !PLACEHOLDER_CLASS.test(d.drug_class))
      add("drug_class", d.drug_class);
    if (d.strength) add("strength", d.strength);
    if (d.line) add("product_line", d.line);
    if (d.product_type) add("product_line", d.product_type);
    if (d.scientific_name && !PLACEHOLDER_SCI.test(d.scientific_name)) {
      for (const ing of parseIngredients(d.scientific_name)) add("ingredient", ing);
    }
  }
  cursor = res.documents[res.documents.length - 1].$id;
  pages++;
  if (res.documents.length < 100) break;
  if (pages % 10 === 0) {
    console.log(
      "scanned",
      pages,
      Object.fromEntries(Object.entries(buckets).map(([k, m]) => [k, m.size])),
    );
  }
}

for (const v of [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Ointment",
  "Drops",
  "Suspension",
  "Powder",
  "Gel",
  "Spray",
  "Suppository",
  "Solution",
  "Ampoule",
  "Vial",
  "Sachet",
])
  add("dosage_form", v);
for (const v of [
  "Oral",
  "Topical",
  "Injection / Subcutaneous",
  "Intravenous",
  "Intramuscular",
  "Nasal",
  "Ophthalmic",
  "Otic",
  "Rectal",
  "Inhalation",
  "Sublingual",
  "Transdermal",
])
  add("route", v);
for (const v of [
  "Prescription Medicines",
  "OTC Medicine",
  "Prescription",
  "Hospital",
  "Supplement",
  "Cosmeceutical",
])
  add("category", v);

console.log(
  "counts",
  Object.fromEntries(Object.entries(buckets).map(([k, m]) => [k, m.size])),
);

let written = 0,
  skipped = 0,
  failed = 0;
for (const [kind, map] of Object.entries(buckets)) {
  for (const [valueKey, value] of map.entries()) {
    const id = docIdFor(kind, valueKey);
    try {
      await databases.createDocument(
        DB,
        COL,
        id,
        {
          kind,
          value,
          value_key: valueKey,
          source: "medicines_aggregate",
          created_by: "seed",
          usage_count: 1,
        },
        [Permission.read(Role.any()), Permission.update(Role.any())],
      );
      written++;
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("already exists") || e.code === 409) skipped++;
      else {
        failed++;
        if (failed < 5) console.warn("fail", kind, value, msg.slice(0, 120));
      }
    }
  }
}
console.log({ written, skipped, failed });
