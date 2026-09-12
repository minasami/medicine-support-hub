#!/usr/bin/env node
/**
 * Pass-4 alternate-source packshot fills for remaining hard HV gaps.
 *
 * Sources beyond EgyptDwa: Egypt pharmacy shops (Al-Abdellatif Tarshouby CDN,
 * Doctor M Pharmacy CDN, DwaPrices product images) + verified strength+form.
 * HEAD/GET-verify image URLs. Never assign wrong strength/form.
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass4-alt-sources.mjs --dry-run
 *   node scripts/enrich-product-photos-pass4-alt-sources.mjs --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pass4Dir = path.join(root, "artifacts/photos-pass4");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  ""
).replace(/\/$/, "");
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  "medicine_support_hub";
const COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
  "medicines";

const IS_WRITE = process.argv.includes("--write");

/** Curated high-confidence alternate-source mappings */
const TARGETS = [
  // Plavix 300 — DwaPrices Egypt listing (Sanofi Plavix 300mg 30 FC tabs)
  {
    id: "med_27504",
    expect: /plavix\s*300/i,
    product: "Plavix 300 mg 30 film-coated tablets",
    image_url: "https://dwaprices.com/upload/1785920438.png",
    source_page: "https://dwaprices.com/med.php?id=10088",
    provenance: "dwaprices.com:packshot (Plavix 300mg 30 FC tabs — verified 300mg on carton)",
    note: "exact 300mg FC tabs; not Plavix 75",
  },
  // Norvasc Val combos — Al-Abdellatif Tarshouby CDN (Viatris Egypt packaging)
  {
    id: "med_25650",
    expect: /norvasc\s*val\s*10\s*\/?\s*160/i,
    product: "Norvasc Val 10/160 mg 30 FC tabs",
    image_url: "https://cdn.supercommerce.io/tarshouby/uploads/132548-1750864143.JPG",
    source_page: "https://alabdellatif-tarshouby.com/en/norvasc-val-10-160mg-30-tab",
    provenance:
      "alabdellatif-tarshouby.com CDN (Norvasc Val 10/160 — amlodipine 10 + valsartan 160 on box)",
    note: "exact 10/160; not Exforge, not Norvasc mono",
  },
  {
    id: "med_86958",
    expect: /norvasc\s*val\s*10\s*\/?\s*160/i,
    product: "Norvasc Val 10/160 mg 30 tab (dup)",
    image_url: "https://cdn.supercommerce.io/tarshouby/uploads/132548-1750864143.JPG",
    source_page: "https://alabdellatif-tarshouby.com/en/norvasc-val-10-160mg-30-tab",
    provenance:
      "alabdellatif-tarshouby.com CDN (Norvasc Val 10/160 — amlodipine 10 + valsartan 160 on box)",
    note: "same SKU as med_25650",
  },
  {
    id: "med_25651",
    expect: /norvasc\s*val\s*5\s*\/?\s*160/i,
    product: "Norvasc Val 5/160 mg 30 FC tabs",
    image_url: "https://cdn.supercommerce.io/tarshouby/uploads/132549--1750864261.JPG",
    source_page: "https://alabdellatif-tarshouby.com/en/norvasc-val-5-160mg-30-tab",
    provenance:
      "alabdellatif-tarshouby.com CDN (Norvasc Val 5/160 — amlodipine 5 + valsartan 160 on box)",
    note: "exact 5/160",
  },
  {
    id: "med_25652",
    expect: /norvasc\s*val\s*5\s*\/?\s*80/i,
    product: "Norvasc Val 5/80 mg 30 FC tabs",
    image_url: "https://cdn.supercommerce.io/tarshouby/uploads/132550-1783559405.JPG",
    source_page: "https://alabdellatif-tarshouby.com/en/norvasc-val-5-80mg-30-tab",
    provenance:
      "alabdellatif-tarshouby.com CDN (Norvasc Val 5/80 — amlodipine 5 + valsartan 80 on box)",
    note: "exact 5/80",
  },
  // Panadol Acute Head Cold — Doctor M Pharmacy CDN
  {
    id: "med_26761",
    expect: /panadol\s*acute\s*head\s*cold/i,
    product: "Panadol Acute Head Cold 20 FC tabs",
    image_url: "https://doctormpharmacy.com/cdn/shop/files/123247.jpg",
    source_page:
      "https://doctormpharmacy.com/products/panadol-acute-head-cold-20-film-coated-tab",
    provenance:
      "doctormpharmacy.com CDN (Panadol Acute Head Cold 20 FC — acetaminophen/pseudoephedrine/brompheniramine)",
    note: "exact Acute Head Cold 20 tabs",
  },
  {
    id: "med_78550",
    expect: /panadol\s*acute\s*head\s*cold/i,
    product: "Panadol Acute Head Cold 20 FC tabs (dup)",
    image_url: "https://doctormpharmacy.com/cdn/shop/files/123247.jpg",
    source_page:
      "https://doctormpharmacy.com/products/panadol-acute-head-cold-20-film-coated-tab",
    provenance:
      "doctormpharmacy.com CDN (Panadol Acute Head Cold 20 FC — acetaminophen/pseudoephedrine/brompheniramine)",
    note: "same SKU as med_26761",
  },
  // Clexane 100mg PFS — DwaPrices Egypt listing
  {
    id: "med_14648",
    expect: /clexane\s*100/i,
    product: "Clexane 100mg/ml 2 prefilled syringes",
    image_url: "https://dwaprices.com/upload/1778954993.png",
    source_page: "https://dwaprices.com/med.php?id=2752",
    provenance:
      "dwaprices.com:packshot (Clexane 100 mg / 1 ml — 2 prefilled syringes on carton)",
    note: "exact 100mg PFS; not 40/60/80",
  },
  {
    id: "med_84664",
    expect: /clexane.*100/i,
    product: "Clexane pref.syringe 100mg 2 syring (dup)",
    image_url: "https://dwaprices.com/upload/1778954993.png",
    source_page: "https://dwaprices.com/med.php?id=2752",
    provenance:
      "dwaprices.com:packshot (Clexane 100 mg / 1 ml — 2 prefilled syringes on carton)",
    note: "same strength as med_14648",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isEmpty(url) {
  const u = String(url || "");
  if (!u.trim()) return true;
  return /unsplash|placeholder|via\.placeholder|no_image|picsum/i.test(u);
}

async function getDoc(id) {
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
    },
  });
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${id} ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

async function verifyImage(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "MedicineSupportHubBot/1.0" },
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    if (res.ok && /image\//i.test(ct) && (len === 0 || len > 10000)) return true;
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "MedicineSupportHubBot/1.0",
        Range: "bytes=0-64",
      },
    });
    const ct = res.headers.get("content-type") || "";
    return (res.ok || res.status === 206) && /image\//i.test(ct);
  } catch {
    return false;
  }
}

async function patchDocument(id, data) {
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const text = await res.text();
  if (res.status === 404) return { missing: true };
  if (!res.ok) {
    throw new Error(`PATCH ${id} ${res.status}: ${text.slice(0, 180)}`);
  }
  return { missing: false };
}

async function main() {
  if (!ENDPOINT || !API_KEY) {
    throw new Error("APPWRITE_ENDPOINT and APPWRITE_API_KEY required");
  }
  console.log(`[pass4] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} targets=${TARGETS.length}`);
  fs.mkdirSync(pass4Dir, { recursive: true });

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    pass: "pass4-alt-sources",
    patched: [],
    skipped_already_filled: [],
    skipped_name_mismatch: [],
    skipped_bad_image: [],
    skipped_missing_doc: [],
    errors: [],
    still_impossible: [],
  };

  for (const t of TARGETS) {
    try {
      const doc = await getDoc(t.id);
      if (!doc) {
        report.skipped_missing_doc.push(t.id);
        console.log(`MISSING ${t.id}`);
        continue;
      }
      const name = doc.name_en || "";
      if (!t.expect.test(name)) {
        report.skipped_name_mismatch.push({
          id: t.id,
          name,
          expect: String(t.expect),
        });
        console.log(`NAME_MISMATCH ${t.id} | ${name}`);
        continue;
      }
      if (!isEmpty(doc.image_url)) {
        report.skipped_already_filled.push({
          id: t.id,
          name,
          image_url: doc.image_url,
        });
        console.log(`ALREADY ${t.id} | ${name}`);
        continue;
      }
      const ok = await verifyImage(t.image_url);
      if (!ok) {
        report.skipped_bad_image.push({ id: t.id, image: t.image_url });
        console.log(`BAD_IMAGE ${t.id} | ${t.image_url}`);
        continue;
      }
      const patch = { image_url: t.image_url };
      if (IS_WRITE) {
        const res = await patchDocument(t.id, patch);
        if (res.missing) {
          report.skipped_missing_doc.push(t.id);
          continue;
        }
        await sleep(40);
      }
      const row = {
        id: t.id,
        name,
        product: t.product,
        image_url: t.image_url,
        source_page: t.source_page,
        provenance: t.provenance,
        note: t.note,
      };
      report.patched.push(row);
      console.log(
        `${IS_WRITE ? "PATCHED" : "WOULD_PATCH"} ${t.id} | ${name} → ${t.product}`,
      );
    } catch (err) {
      report.errors.push({ id: t.id, error: String(err.message || err) });
      console.error(`ERR ${t.id}`, err.message || err);
    }
  }

  report.still_impossible = [
    {
      note: "All named hard gaps from pass-3 summary were targeted; none left if patched=9",
    },
  ];

  report.stats = {
    patched: report.patched.length,
    skipped_already_filled: report.skipped_already_filled.length,
    skipped_name_mismatch: report.skipped_name_mismatch.length,
    skipped_bad_image: report.skipped_bad_image.length,
    skipped_missing_doc: report.skipped_missing_doc.length,
    errors: report.errors.length,
  };

  const outPath = path.join(pass4Dir, "pass4-alt-sources-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[pass4] report → ${outPath}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
