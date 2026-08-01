#!/usr/bin/env node
/**
 * Enrich Appwrite medicines collection from Egyptian pharmacy prices dataset.
 *
 * Env:
 *   APPWRITE_API_KEY (required for --write)
 *   APPWRITE_PROJECT_ID (default 6a54ac3a00272c02d6e0)
 *   APPWRITE_ENDPOINT (default https://fra.cloud.appwrite.io/v1)
 *   APPWRITE_DATABASE_ID (default medicine_support_hub)
 *   APPWRITE_MEDICINES_COLLECTION_ID (default medicines)
 *
 * Usage:
 *   node scripts/enrich-appwrite-from-pharmacy-prices.mjs --dry-run
 *   node scripts/enrich-appwrite-from-pharmacy-prices.mjs --write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const API_KEY =
  process.env.APPWRITE_API_KEY ||
  "standard_5437d46726944bc5cd5f9b4fc4d71e6a88f2c8fb722884ddb92e0e758b1e2fbbda03e4f5798153f7a15a2f4093633e5a205d48852322919eb74edeb51d0dd75163d00411a6e9c895cfb04cfe6c11ba855ef04255d2a64743d846c625ff3b65f5887110c78f8a435b557e94e1ef756dd1ed90fb65d9fd4baf10331972e0c06023";
const DATABASE_ID =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  "medicine_support_hub";
const COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
  "medicines";

const IS_WRITE = process.argv.includes("--write");
const MEDICINES_FILE = path.join(
  root,
  "scripts/reports/egyptian-pharmacy-medicines.json",
);
const REPORT_FILE = path.join(
  root,
  "scripts/reports/pharmacy-prices-enrichment-report.json",
);

function norm(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function fetchAppwriteDocuments() {
  const exportPath = path.join(root, "scripts/reports/appwrite-medicines-export.json");
  const staticPath = path.join(root, "apps/web/public/data/egyptian-medicines-dataset.json");

  if (fs.existsSync(exportPath)) {
    console.log(`[Enricher] Loading live export from ${exportPath}...`);
    try {
      const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));
      const docs = Array.isArray(data) ? data : (data.documents || data.medicines || []);
      if (docs.length > 0) return docs;
    } catch {}
  }

  console.log("[Enricher] Fetching existing medicines from Appwrite Cloud...");
  const headers = {
    "X-Appwrite-Project": PROJECT,
    "Content-Type": "application/json",
  };
  if (API_KEY) headers["X-Appwrite-Key"] = API_KEY;

  const limit = 100;
  let offset = 0;
  let allDocs = [];

  while (true) {
    const queries = [
      JSON.stringify({ method: "limit", values: [limit] }),
      JSON.stringify({ method: "offset", values: [offset] }),
    ];
    const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents?queries[]=${encodeURIComponent(
      queries[0],
    )}&queries[]=${encodeURIComponent(queries[1])}`;

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        console.warn(
          `[Enricher] Appwrite list documents returned HTTP ${res.status}`,
        );
        break;
      }
      const data = await res.json();
      const docs = data.documents || [];
      allDocs.push(...docs);
      const total = Number(data.total || 0);
      console.log(`[Enricher] Loaded page (offset: ${offset}, page size: ${docs.length}, total: ${total})`);
      if (docs.length < limit || (total > 0 && offset + docs.length >= total)) break;
      offset += limit;
    } catch (err) {
      console.warn("[Enricher] Appwrite fetch notice:", err.message);
      break;
    }
  }

  if (allDocs.length > 0) {
    console.log(`[Enricher] Loaded ${allDocs.length} live Appwrite documents.`);
    return allDocs;
  }

  if (fs.existsSync(staticPath)) {
    console.log(`[Enricher] Fallback loading static dataset from ${staticPath}...`);
    try {
      const data = JSON.parse(fs.readFileSync(staticPath, "utf8"));
      return data.medicines || [];
    } catch {}
  }

  return [];
}

async function patchAppwriteDocument(docId, patchData) {
  const headers = {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": API_KEY,
    "Content-Type": "application/json",
  };
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${docId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ data: patchData }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(
    `=== Egyptian Pharmacy Prices → Appwrite Medicines Enrichment ===`,
  );
  console.log(`Mode: ${IS_WRITE ? "WRITE (Applying PATCHES)" : "DRY RUN"}`);

  if (!fs.existsSync(MEDICINES_FILE)) {
    console.error(
      `Missing parsed medicines candidate file: ${MEDICINES_FILE}`,
    );
    console.error(
      `Run node scripts/parse-egyptian-pharmacy-prices.mjs "--input=..." first.`,
    );
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(MEDICINES_FILE, "utf8"));
  const candidateItems = Array.isArray(rawData) ? rawData : (rawData.products || []);
  console.log(
    `Loaded ${candidateItems.length} medicine candidates from pharmacy price list.`,
  );

  const existingDocs = await fetchAppwriteDocuments();

  // Index existing documents by barcode, name_en, name_ar
  const barcodeMap = new Map();
  const nameEnMap = new Map();
  const nameArMap = new Map();

  for (const doc of existingDocs) {
    if (doc.barcode) barcodeMap.set(String(doc.barcode).trim(), doc);
    if (doc.code) barcodeMap.set(String(doc.code).trim(), doc);
    if (doc.name_en) {
      const key = norm(doc.name_en);
      if (key) nameEnMap.set(key, doc);
    }
    if (doc.name_ar) {
      const key = String(doc.name_ar).trim();
      if (key) nameArMap.set(key, doc);
    }
  }

  let matchedCount = 0;
  let barcodeMatched = 0;
  let nameMatched = 0;
  let patchCandidates = [];

  for (const cand of candidateItems) {
    let matchedDoc = null;
    let matchMethod = null;

    // 1. Try barcode match
    if (cand.barcode && cand.barcode.length >= 8 && barcodeMap.has(cand.barcode)) {
      matchedDoc = barcodeMap.get(cand.barcode);
      matchMethod = "barcode";
      barcodeMatched++;
    }

    // 2. Try normalized name_en match
    if (!matchedDoc && cand.name_en) {
      const key = norm(cand.name_en);
      if (key && nameEnMap.has(key)) {
        matchedDoc = nameEnMap.get(key);
        matchMethod = "name_en";
        nameMatched++;
      }
    }

    // 3. Try Arabic name match
    if (!matchedDoc && cand.name_ar) {
      const key = String(cand.name_ar).trim();
      if (key && nameArMap.has(key)) {
        matchedDoc = nameArMap.get(key);
        matchMethod = "name_ar";
        nameMatched++;
      }
    }

    if (matchedDoc) {
      matchedCount++;
      const patch = {};

      // Price update
      if (cand.current_price_egp && cand.current_price_egp > 0) {
        if (
          !matchedDoc.current_price_egp ||
          matchedDoc.current_price_egp === 0 ||
          matchedDoc.current_price_egp !== cand.current_price_egp
        ) {
          patch.current_price_egp = cand.current_price_egp;
        }
      }

      // Barcode backfill
      if (cand.barcode && (!matchedDoc.barcode || matchedDoc.barcode === "")) {
        patch.barcode = cand.barcode;
      }

      // Arabic name backfill
      if (cand.name_ar && (!matchedDoc.name_ar || matchedDoc.name_ar === "")) {
        patch.name_ar = cand.name_ar;
      }

      // Product type
      if (!matchedDoc.product_type || matchedDoc.product_type === "") {
        patch.product_type = cand.product_type || "medicine";
      }

      if (Object.keys(patch).length > 0) {
        patchCandidates.push({
          docId: matchedDoc.$id,
          name_en: matchedDoc.name_en || cand.name_en,
          matchMethod,
          patch,
        });
      }
    }
  }

  console.log(`\n=== Match & Enrichment Statistics ===`);
  console.log(`Total Candidates Evaluated: ${candidateItems.length}`);
  console.log(`Total Matched to Live DB:   ${matchedCount}`);
  console.log(`  - By Barcode:             ${barcodeMatched}`);
  console.log(`  - By Name (EN/AR):        ${nameMatched}`);
  console.log(`Documents with Pending Patch: ${patchCandidates.length}`);

  if (patchCandidates.length > 0) {
    console.log(`\nSample Patch Candidates:`);
    for (const p of patchCandidates.slice(0, 10)) {
      console.log(`  Doc [${p.docId}] (${p.name_en}) matched via ${p.matchMethod} →`, JSON.stringify(p.patch));
    }
  }

  if (IS_WRITE && patchCandidates.length > 0) {
    console.log(`\nApplying ${patchCandidates.length} PATCH updates to Appwrite (throttled 50ms)...`);
    let updatedCount = 0;
    let errorCount = 0;

    for (const item of patchCandidates) {
      try {
        await patchAppwriteDocument(item.docId, item.patch);
        updatedCount++;
        if (updatedCount % 20 === 0) {
          console.log(`[Progress] Applied ${updatedCount}/${patchCandidates.length} patches...`);
        }
        await new Promise((r) => setTimeout(r, 50));
      } catch (err) {
        console.error(`[Error] Patching doc ${item.docId}:`, err.message);
        errorCount++;
      }
    }
    console.log(`=== Write Complete: ${updatedCount} updated, ${errorCount} errors ===`);
  }

  const reportData = {
    timestamp: new Date().toISOString(),
    isWriteMode: IS_WRITE,
    totalCandidates: candidateItems.length,
    totalMatched: matchedCount,
    barcodeMatched,
    nameMatched,
    patchCount: patchCandidates.length,
    samplePatches: patchCandidates.slice(0, 50),
  };

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(reportData, null, 2));
  console.log(`\nWrote report to: ${REPORT_FILE}`);
}

main().catch(console.error);
