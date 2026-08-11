#!/usr/bin/env node
/**
 * Batch backfill RxCUI + PubChem CID onto Appwrite medicines (fill-only).
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/backfill-external-ids.mjs --limit=50 --dry-run
 *   APPWRITE_API_KEY=... node scripts/backfill-external-ids.mjs --limit=200 --write
 *
 * Queries NIH RxNorm approximateTerm + PubChem name→CID for rows missing IDs.
 */

import fs from "node:fs";
import path from "node:path";

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const KEY = process.env.APPWRITE_API_KEY || "";
const DB =
  process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 50;
const WRITE = args.includes("--write");
const DRY = !WRITE || args.includes("--dry-run");

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

async function listPage(cursor) {
  const queries = [
    'orderAsc("name_en")',
    `limit(${Math.min(100, LIMIT)})`,
  ];
  if (cursor) queries.push(`cursorAfter("${cursor}")`);
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
  const url = `${ENDPOINT}/databases/${DB}/collections/${COL}/documents?${qs}`;
  const res = await fetch(url, {
    headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-Key": KEY },
  });
  if (!res.ok) throw new Error(`list ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchDoc(id, data) {
  const url = `${ENDPOINT}/databases/${DB}/collections/${COL}/documents/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    // Optional attrs may not exist — try without
    if (res.status === 400) {
      const core = { ...data };
      delete core.rxcui;
      delete core.pubchem_cid;
      delete core.field_sources;
      delete core.last_enriched_at;
      if (!Object.keys(core).length) return { ok: false, error: text };
      const res2 = await fetch(url, {
        method: "PATCH",
        headers: {
          "X-Appwrite-Project": PROJECT,
          "X-Appwrite-Key": KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: core }),
      });
      return { ok: res2.ok, error: res2.ok ? null : await res2.text() };
    }
    return { ok: false, error: text };
  }
  return { ok: true };
}

async function rxnorm(name) {
  try {
    const url =
      "https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=" +
      encodeURIComponent(name) +
      "&maxEntries=1";
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.approximateGroup?.candidate?.[0]?.rxcui || null;
  } catch {
    return null;
  }
}

async function pubchem(name) {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.IdentifierList?.CID?.[0] || null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const report = [];
let processed = 0;
let written = 0;

console.log(`Backfill external IDs · limit=${LIMIT} · write=${!DRY}`);

const page = await listPage(null);
const docs = page.documents || [];

for (const doc of docs) {
  if (processed >= LIMIT) break;
  processed += 1;
  const name = doc.scientific_name || doc.name_en;
  if (!name) continue;
  const needRxcui = !doc.rxcui;
  const needCid = !doc.pubchem_cid;
  if (!needRxcui && !needCid) continue;

  const payload = {};
  if (needRxcui) {
    const rxcui = await rxnorm(name);
    await sleep(120);
    if (rxcui) payload.rxcui = String(rxcui);
  }
  if (needCid) {
    const cid = await pubchem(name);
    await sleep(120);
    if (cid) payload.pubchem_cid = String(cid);
  }
  if (!Object.keys(payload).length) {
    report.push({ id: doc.$id, name, status: "no_match" });
    continue;
  }
  payload.last_enriched_at = new Date().toISOString();
  payload.field_sources = JSON.stringify({
    ...(needRxcui && payload.rxcui ? { rxcui: "rxnorm" } : {}),
    ...(needCid && payload.pubchem_cid ? { pubchem_cid: "pubchem" } : {}),
  });

  if (DRY) {
    report.push({ id: doc.$id, name, status: "dry_run", payload });
    console.log("[dry]", doc.$id, name, payload);
  } else {
    const result = await patchDoc(doc.$id, payload);
    if (result.ok) {
      written += 1;
      report.push({ id: doc.$id, name, status: "written", payload });
      console.log("[ok]", doc.$id, name, payload);
    } else {
      report.push({ id: doc.$id, name, status: "error", error: result.error });
      console.warn("[err]", doc.$id, result.error?.slice?.(0, 120));
    }
    await sleep(80);
  }
}

const outDir = path.join(process.cwd(), "scripts", "reports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "external-ids-backfill.json");
fs.writeFileSync(
  outPath,
  JSON.stringify({ generated_at: new Date().toISOString(), dry: DRY, processed, written, report }, null, 2),
);
console.log(`Done. processed=${processed} written=${written} report=${outPath}`);
