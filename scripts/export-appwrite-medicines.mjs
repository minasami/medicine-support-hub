#!/usr/bin/env node
/**
 * Export all live medicines from Appwrite Cloud for ID unification.
 *
 * Env:
 *   APPWRITE_API_KEY (required)
 *   APPWRITE_PROJECT_ID (default 6a54ac3a00272c02d6e0)
 *   APPWRITE_ENDPOINT (default https://fra.cloud.appwrite.io/v1)
 *   APPWRITE_DATABASE_ID (default medicine_support_hub)
 *   APPWRITE_MEDICINES_COLLECTION_ID (default medicines)
 *
 * Output:
 *   scripts/reports/appwrite-medicines-export.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

const PAGE = 2500;

if (!API_KEY) {
  console.error("APPWRITE_API_KEY is required");
  process.exit(1);
}

async function listPage(offset) {
  const queries = [
    JSON.stringify({ method: "limit", values: [PAGE] }),
    JSON.stringify({ method: "offset", values: [offset] }),
    JSON.stringify({ method: "orderAsc", values: ["canonical_id"] }),
  ];
  // Appwrite REST: queries[] as query params
  const qs = queries
    .map((q) => `queries[]=${encodeURIComponent(q)}`)
    .join("&");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents?${qs}`;

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const res = await fetch(url, {
        headers: {
          "X-Appwrite-Project": PROJECT,
          "X-Appwrite-Key": API_KEY,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Appwrite ${res.status}: ${text.slice(0, 400)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempts >= 5) throw err;
      console.warn(`[export-appwrite-medicines] Fetch attempt ${attempts} failed (${err.message}), retrying in ${attempts * 2}s...`);
      await new Promise((r) => setTimeout(r, attempts * 2000));
    }
  }
}

function pick(doc) {
  return {
    $id: doc.$id,
    canonical_id:
      doc.canonical_id != null ? Number(doc.canonical_id) : null,
    name_en: doc.name_en || null,
    name_ar: doc.name_ar || null,
    scientific_name: doc.scientific_name || null,
    manufacturer: doc.manufacturer || null,
    barcode: doc.barcode || null,
    code: doc.code || null,
    category: doc.category || null,
    drug_class: doc.drug_class || null,
    route: doc.route || null,
    product_type: doc.product_type || null,
    current_price_egp:
      doc.current_price_egp != null ? Number(doc.current_price_egp) : null,
    has_verified_dataset: Boolean(doc.has_verified_dataset),
  };
}

async function main() {
  console.log("Exporting Appwrite medicines…");
  console.log(`  ${ENDPOINT} / ${DATABASE_ID} / ${COLLECTION_ID}`);

  const all = [];
  let offset = 0;
  let total = null;

  for (;;) {
    const page = await listPage(offset);
    const docs = page.documents || [];
    if (total == null) total = page.total ?? docs.length;
    for (const d of docs) all.push(pick(d));
    console.log(`  fetched ${all.length}${total != null ? ` / ${total}` : ""}`);
    if (docs.length < PAGE) break;
    offset += PAGE;
    // safety cap
    if (offset > 500000) break;
  }

  fs.mkdirSync(reportDir, { recursive: true });
  const outPath = path.join(reportDir, "appwrite-medicines-export.json");
  const payload = {
    exported_at: new Date().toISOString(),
    endpoint: ENDPOINT,
    project_id: PROJECT,
    database_id: DATABASE_ID,
    collection_id: COLLECTION_ID,
    total: all.length,
    medicines: all,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${all.length} rows → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
