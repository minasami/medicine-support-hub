#!/usr/bin/env node
/**
 * Clear image_url on products flagged by detect-image-mismatches.mjs.
 *
 * Prerequisites:
 *   node scripts/detect-image-mismatches.mjs --write-clear-list
 *
 * Usage:
 *   node scripts/clear-mismatched-images.mjs --dry-run
 *   node scripts/clear-mismatched-images.mjs --apply   # needs APPWRITE_API_KEY
 *
 * --apply updates Appwrite documents: image_url → "", image_is_verified → false
 * Static dataset clear is optional via --static-write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");
const clearPath = path.join(reportDir, "image-clear-candidates.json");
const staticPath = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);

const apply = process.argv.includes("--apply");
const staticWrite = process.argv.includes("--static-write");
const dryRun = !apply && !staticWrite;

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

async function clearAppwriteImage(canonicalId) {
  const docId = `med_${canonicalId}`;
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${docId}`;
  const payload = {
    data: {
      image_url: "",
      image_is_verified: false,
    },
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`${docId}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.status;
}

async function main() {
  if (!fs.existsSync(path.join(reportDir, "image-mismatch-report.json")) && !writeClear) {
    // always regenerate report
  }

  // Inline re-scan so this script can stand alone after a prior detect run
  // Prefer reusing report if present and --apply-from-report
  let candidates = [];

  if (fs.existsSync(path.join(reportDir, "image-mismatch-report.json")) && args.includes("--from-report")) {
    const prev = JSON.parse(
      fs.readFileSync(path.join(reportDir, "image-mismatch-report.json"), "utf8"),
    );
    candidates = (prev.findings || []).filter((f) => f.suggest_clear_image);
  } else {
    // run detection inline by re-invoking logic via spawning would be heavy; just require report
    if (!fs.existsSync(path.join(reportDir, "image-mismatch-report.json"))) {
      console.error("Run detect-image-mismatches.mjs first to generate a report.");
      process.exit(1);
    }
    const prev = JSON.parse(
      fs.readFileSync(path.join(reportDir, "image-mismatch-report.json"), "utf8"),
    );
    candidates = (prev.findings || []).filter((f) => f.suggest_clear_image);
  }

  console.log(`Clear candidates: ${candidates.length}`);
  if (dryRun && !writeClear) {
    console.log("Dry context: use detect script with --write-clear-list");
  }

  if (writeClear) {
    const clearPath = path.join(reportDir, "image-clear-candidates.json");
    fs.writeFileSync(
      clearPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          count: findings.filter((f) => f.suggest_clear_image).length,
          items: findings.filter((f) => f.suggest_clear_image),
        },
        null,
        2,
      ),
    );
    console.log("Clear list:", clearPath);
  }

  if (args.includes("--apply") && process.env.APPWRITE_API_KEY) {
    const API_KEY = process.env.APPWRITE_API_KEY;
    const ENDPOINT = (
      process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
    ).replace(/\/$/, "");
    const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
    const DATABASE_ID =
      process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
    const COLLECTION_ID =
      process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

    const clearList = findings.filter((f) => f.suggest_clear_image);
    let ok = 0;
    for (const item of clearList) {
      if (item.canonical_id == null) continue;
      const docId = `med_${item.canonical_id}`;
      const endpoint = `${process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"}/databases/${DATABASE_ID}/collections/medicines/documents/${docId}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "X-Appwrite-Project":
            process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0",
          "X-Appwrite-Key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: { image_url: "", image_is_verified: false },
        }),
      });
      if (res.ok || res.status === 404) ok += 1;
      else console.warn(docId, res.status, await res.text());
    }
    console.log(`Cleared images on Appwrite: ${ok}/${clearList.length}`);
  } else if (args.includes("--apply")) {
    console.error("--apply requires APPWRITE_API_KEY");
  }

  if (writeClear) {
    const clearPath = path.join(reportDir, "image-clear-candidates.json");
    const items = findings.filter((f) => f.suggest_clear_image);
    fs.writeFileSync(
      clearPath,
      JSON.stringify(
        { generated_at: new Date().toISOString(), count: items.length, items },
        null,
        2,
      ),
    );
    console.log("Clear candidates:", clearPath, `(${items.length})`);
  }
}

main();
