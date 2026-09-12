#!/usr/bin/env node
/**
 * Pass-3 curated hard-gap packshot fills (high-confidence only).
 *
 * Targets remaining empty image_url SKUs after pass-2 where EgyptDwa AJAX
 * has exact strength+form packshots that fuzzy matching missed (XR form,
 * IV powder, amp, combo strengths, etc.).
 *
 * Never patches wrong form (IV ≠ tabs; XR ≠ IR; brand ≠ brand-alike).
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass3-gapfill.mjs --dry-run
 *   node scripts/enrich-product-photos-pass3-gapfill.mjs --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pass3Dir = path.join(root, "artifacts/photos-pass3");

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

/** Curated high-confidence mappings: Appwrite id → EgyptDwa packshot */
const TARGETS = [
  // Glucophage XR (exact XR strength — not IR)
  {
    id: "med_19525",
    expect: /glucophage\s*xr\s*500/i,
    product: "glucophage XR 500mg 30 tab",
    image_url: "https://egyptdwa.com/dwa/glucophage-XR-500mg-30-tab-5610.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/5610",
    note: "exact XR 500mg tabs",
  },
  {
    id: "med_19524",
    expect: /glucophage\s*xr\s*1000/i,
    product: "glucophage XR 1000mg 30 tab",
    image_url: "https://egyptdwa.com/dwa/glucophage-XR-1000mg-30-tab-5609.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/5609",
    note: "exact XR 1000mg tabs",
  },
  // Augmentin IV vial 600mg
  {
    id: "med_11847",
    expect: /augmentin\s*600.*vial/i,
    product: "augmentin 600mg vial for i.v.",
    image_url: "https://egyptdwa.com/dwa/augmentin-600mg-vial-for-i-v-1134.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/1134",
    note: "exact 600mg IV vial",
  },
  // Augmentin infant drops: catalog 62.5; EgyptDwa label typo 6.25 — same SKU/form/volume
  {
    id: "med_11848",
    expect: /augmentin\s*62\.?5.*infant\s*drops/i,
    product: "augmentin 6.25mg/ml infant drops 20 ml (EgyptDwa typo for 62.5)",
    image_url:
      "https://egyptdwa.com/dwa/augmentin-6-25mg-ml-infant-drops-20-ml-1135.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/1135",
    note: "same infant drops 20ml SKU; EgyptDwa lists 6.25 vs catalog/GSK 62.5",
  },
  // Nexium IV powder/vial 40mg
  {
    id: "med_25374",
    expect: /nexium\s*40.*(i\.?v|powder|vial)/i,
    product: "nexium 40 mg 10 i.v. vial.",
    image_url: "https://egyptdwa.com/dwa/nexium-40-mg-10-i-v-vial-23550.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/23550",
    note: "exact 40mg IV vial (not FC tabs)",
  },
  // Neuroton IM amps
  {
    id: "med_25260",
    expect: /neuroton.*amp/i,
    product: "neuroton 6 ampoules",
    image_url: "https://egyptdwa.com/dwa/neuroton-6-ampoules-8765.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/8765",
    note: "exact 6 IM ampoules",
  },
  // Xarelto 10mg
  {
    id: "med_34560",
    expect: /xarelto\s*10/i,
    product: "xarelto 10mg 10 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/xarelto-10mg-10-f-c-tab-29718.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/29718",
    note: "exact 10mg FC tabs",
  },
  // Coversyl 10mg
  {
    id: "med_15178",
    expect: /coversyl\s*10.*15/i,
    product: "coversyl 10mg 15 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/coversyl-10mg-15-f-c-tab-16875.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/16875",
    note: "exact 10mg 15 tabs",
  },
  {
    id: "med_15179",
    expect: /coversyl\s*10.*30/i,
    product: "coversyl 10mg 30 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/coversyl-10mg-30-f-c-tab-16876.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/16876",
    note: "exact 10mg 30 tabs",
  },
  // Clexane 60 / 80 (not 100 — no EgyptDwa packshot)
  {
    id: "med_43592",
    expect: /clexane.*60/i,
    product: "clexane 60mg/0.6ml 2 prefilled syringe",
    image_url:
      "https://egyptdwa.com/dwa/clexane-60mg-0-6ml-2-prefilled-syringe-2753.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/2753",
    note: "exact 60mg PFS",
  },
  {
    id: "med_43593",
    expect: /clexane.*80/i,
    product: "clexane 80mg/0.8ml 2 prefilled syringe",
    image_url:
      "https://egyptdwa.com/dwa/clexane-80mg-0-8ml-2-prefilled-syringe-2754.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/2754",
    note: "exact 80mg PFS",
  },
  // Ozempic pens
  {
    id: "med_26689",
    expect: /ozempic\s*0\.?25/i,
    product: "ozempic 0.25mg prefilled pen",
    image_url: "https://egyptdwa.com/dwa/ozempic-0-25mg-prefilled-pen-271.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/271",
    note: "exact 0.25mg pen",
  },
  {
    id: "med_26690",
    expect: /ozempic\s*0\.?5/i,
    product: "ozempic 0.5mg prefilled pen",
    image_url: "https://egyptdwa.com/dwa/ozempic-0-5mg-prefilled-pen-13327.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/13327",
    note: "exact 0.5mg pen",
  },
  {
    id: "med_26691",
    expect: /ozempic\s*1\s*mg/i,
    product: "ozempic 1mg prefilled pen",
    image_url: "https://egyptdwa.com/dwa/ozempic-1mg-prefilled-pen-13583.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/13583",
    note: "exact 1mg pen",
  },
  // Janumet strengths
  {
    id: "med_21487",
    expect: /janumet\s*50\s*\/?\s*1000/i,
    product: "janumet 50/1000mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-1000mg-56-f-c-tab-21137.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21137",
    note: "exact 50/1000",
  },
  {
    id: "med_21580",
    expect: /janumet\s*50\s*mg\s*\/\s*1000/i,
    product: "janumet 50/1000mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-1000mg-56-f-c-tab-21137.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21137",
    note: "exact 50/1000 dup",
  },
  {
    id: "med_53690",
    expect: /janumet\s*50\s*mg\s*\/\s*1000/i,
    product: "janumet 50/1000mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-1000mg-56-f-c-tab-21137.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21137",
    note: "exact 50/1000 dup",
  },
  {
    id: "med_21488",
    expect: /janumet\s*50\s*\/?\s*500/i,
    product: "janumet 50/500mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-500mg-56-f-c-tab-21138.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21138",
    note: "exact 50/500",
  },
  {
    id: "med_21489",
    expect: /janumet\s*50\s*\/?\s*850/i,
    product: "janumet 50/850mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-850mg-56-f-c-tab-21139.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21139",
    note: "exact 50/850",
  },
  {
    id: "med_53691",
    expect: /janumet\s*50\s*mg\s*\/\s*850/i,
    product: "janumet 50/850mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-850mg-56-f-c-tab-21139.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21139",
    note: "exact 50/850 dup",
  },
  {
    id: "med_53692",
    expect: /janumet\s*50\s*mg\s*\/\s*850/i,
    product: "janumet 50/850mg 56 f.c. tab.",
    image_url: "https://egyptdwa.com/dwa/janumet-50-850mg-56-f-c-tab-21139.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/21139",
    note: "exact 50/850 old dup",
  },
  // Byetta pens
  {
    id: "med_13273",
    expect: /byetta\s*10/i,
    product: "byetta 10mcg sol. for inj. prefilled pen",
    image_url:
      "https://egyptdwa.com/dwa/byetta-10mcg-sol-for-inj-prefilled-pen-15591.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/15591",
    note: "exact 10mcg pen",
  },
  {
    id: "med_13274",
    expect: /byetta\s*5/i,
    product: "byetta 5mcg sol. for inj. prefilled pen",
    image_url:
      "https://egyptdwa.com/dwa/byetta-5mcg-sol-for-inj-prefilled-pen-15592.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/15592",
    note: "exact 5mcg pen",
  },
  // Entresto
  {
    id: "med_17243",
    expect: /entresto\s*100/i,
    product: "entresto 100 mg (49/51 mg) 28 f.c. tabs.",
    image_url:
      "https://egyptdwa.com/dwa/entresto-100-mg-49-51-mg-28-f-c-tabs-18348.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/18348",
    note: "exact 100mg (49/51)",
  },
  {
    id: "med_17244",
    expect: /entresto\s*200/i,
    product: "entresto 200 mg (97/103 mg) 56 f.c. tabs.",
    image_url:
      "https://egyptdwa.com/dwa/entresto-200-mg-97-103-mg-56-f-c-tabs-18349.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/18349",
    note: "exact 200mg (97/103)",
  },
  {
    id: "med_17245",
    expect: /entresto\s*50/i,
    product: "entresto 50 mg (24/26 mg) 28 f.c. tabs.",
    image_url:
      "https://egyptdwa.com/dwa/entresto-50-mg-24-26-mg-28-f-c-tabs-18350.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/18350",
    note: "exact 50mg (24/26)",
  },
  // Prolia
  {
    id: "med_27954",
    expect: /prolia\s*60/i,
    product: "prolia 60 mg 1 pref.syringe",
    image_url: "https://egyptdwa.com/dwa/prolia-60-mg-1-pref-syringe-25332.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/25332",
    note: "exact 60mg PFS",
  },
  // Mabthera
  {
    id: "med_23180",
    expect: /mabthera\s*500/i,
    product: "mabthera 500mg/50 ml vial",
    image_url: "https://egyptdwa.com/dwa/mabthera-500mg-50-ml-vial-22168.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/22168",
    note: "exact 500mg vial",
  },
  {
    id: "med_23178",
    expect: /mabthera\s*100/i,
    product: "mabthera 100mg/10 ml 2 vials",
    image_url: "https://egyptdwa.com/dwa/mabthera-100mg-10-ml-2-vials-22166.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/22166",
    note: "exact 100mg 2 vials",
  },
  {
    id: "med_23179",
    expect: /mabthera\s*1400/i,
    product: "mabthera 1400mg/11.7 ml vial s.c.",
    image_url:
      "https://egyptdwa.com/dwa/mabthera-1400mg-11-7-ml-vial-s-c-22167.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/22167",
    note: "exact 1400mg SC vial",
  },
  // Panadol All in One
  {
    id: "med_78549",
    expect: /panadol.*(all\s*in\s*one|cold\s*&\s*flu.*all)/i,
    product: "panadol all in one 24tab",
    image_url: "https://egyptdwa.com/dwa/panadol-all-in-one-24tab-9561.jpg",
    egyptdwa_source_url: "https://egyptdwa.com/m/9561",
    note: "exact All in One 24 tabs",
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
    if (res.ok && /image\//i.test(ct)) return true;
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
  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }
  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    const { egyptdwa_source_url, ...rest } = data;
    if (Object.keys(rest).length) result = await attempt(rest);
  }
  if (!result.ok && result.status === 404) return { missing: true };
  if (!result.ok) {
    throw new Error(`PATCH ${id} ${result.status}: ${result.text.slice(0, 180)}`);
  }
  return { missing: false };
}

async function main() {
  if (!ENDPOINT || !API_KEY) {
    throw new Error("APPWRITE_ENDPOINT and APPWRITE_API_KEY required");
  }
  console.log(`[pass3] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} targets=${TARGETS.length}`);
  fs.mkdirSync(pass3Dir, { recursive: true });

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    provenance: "egyptdwa.com:packshot (curated pass3 hard-gap)",
    patched: [],
    skipped_already_filled: [],
    skipped_name_mismatch: [],
    skipped_bad_image: [],
    skipped_missing_doc: [],
    errors: [],
    still_empty_notable: [],
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
      const patch = {
        image_url: t.image_url,
        egyptdwa_source_url: t.egyptdwa_source_url,
      };
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
        note: t.note,
      };
      report.patched.push(row);
      console.log(`${IS_WRITE ? "PATCHED" : "WOULD_PATCH"} ${t.id} | ${name} → ${t.product}`);
    } catch (err) {
      report.errors.push({ id: t.id, error: String(err.message || err) });
      console.error(`ERR ${t.id}`, err.message || err);
    }
  }

  // Document still-empty named hard gaps we intentionally did not patch
  report.still_empty_notable = [
    {
      brand: "PLAVIX",
      names: ["PLAVIX 300 MG 30 F.C.TABS. (med_27504)"],
      reason: "EgyptDwa only has Plavix 75mg; no 300mg packshot",
    },
    {
      brand: "NORVASC VAL",
      names: [
        "NORVASC VAL 10/160MG (med_25650, med_86958)",
        "NORVASC VAL 5/160MG (med_25651)",
        "NORVASC VAL 5/80MG (med_25652)",
      ],
      reason:
        "No Norvasc Val packshots on EgyptDwa; Exforge is same APIs but different brand packaging — not used",
    },
    {
      brand: "PANADOL",
      names: [
        "PANADOL ACUTE HEAD COLD 20 F.C.TABS. (med_26761, med_78550)",
      ],
      reason:
        "No EgyptDwa Panadol Acute Head Cold packshot (Comtrex-only hit — wrong brand)",
    },
    {
      brand: "CLEXANE",
      names: [
        "CLEXANE 100MG/ML 2 PREFILLED SYRINGES (med_14648)",
        "CLEXANE PREF.SYRINGE 100MG 2 SYRING (med_84664)",
      ],
      reason: "No EgyptDwa packshot for 100mg strength (60/80 filled)",
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

  const outPath = path.join(pass3Dir, "pass3-gapfill-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[pass3] report → ${outPath}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
