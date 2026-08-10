/**
 * Normalize manufacturer / toll_manufacturer / company_slug on Appwrite medicines
 * so Med-Care / Medcare / Med care (etc.) share one identity.
 *
 *   APPWRITE_API_KEY=... node scripts/backfill-canonical-company-labels.mjs [--dry-run]
 *
 * Logic mirrors apps/web/src/lib/company-identity.ts (kept inline for node scripts).
 */
import { Client, Databases, Query } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DB = "medicine_support_hub";
const COL = "medicines";
const KEY = process.env.APPWRITE_API_KEY;
const dry = process.argv.includes("--dry-run");

if (!KEY) {
  console.error("APPWRITE_API_KEY required");
  process.exit(1);
}

const REGISTRY = [
  {
    id: "med-care",
    slug: "med-care",
    displayName: "Med-Care",
    patterns: [/med[\s.\-_/]*care/i, /medcare/i],
  },
  {
    id: "soul-pharma",
    slug: "soul-pharma",
    displayName: "Soul Pharma",
    patterns: [/soul[\s.\-_/]*pharma/i, /soulpharma/i],
  },
  {
    id: "smartec",
    slug: "smartec",
    displayName: "Smartec",
    patterns: [/\bsmartec\b/i],
  },
  {
    id: "eva-pharma",
    slug: "eva-pharma",
    displayName: "Eva Pharma",
    patterns: [/eva[\s.\-_/]*pharma/i],
  },
  {
    id: "pharco",
    slug: "pharco",
    displayName: "Pharco",
    patterns: [/\bpharco\b/i],
  },
];

function resolve(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  for (const c of REGISTRY) {
    if (c.patterns.some((re) => re.test(s))) return c;
  }
  return null;
}

/** Rewrite dual labels with canonical party names when known. */
function canonicalizeManufacturer(raw) {
  const s = String(raw || "").trim();
  if (!s) return { value: s, changed: false, slug: null };

  const parts = s.split(/\s*[>\/|]+\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    let changed = false;
    const out = parts.map((p) => {
      const r = resolve(p);
      if (r && r.displayName !== p) {
        changed = true;
        return r.displayName;
      }
      return p;
    });
    const primary = resolve(parts[parts.length - 1]) || resolve(parts[0]);
    return {
      value: out.join(" > "),
      changed: changed || out.join(" > ") !== s,
      slug: primary?.slug || null,
      isMedCare: parts.some((p) => resolve(p)?.id === "med-care"),
    };
  }

  const r = resolve(s);
  if (!r) return { value: s, changed: false, slug: null, isMedCare: false };
  return {
    value: r.displayName,
    changed: r.displayName !== s,
    slug: r.slug,
    isMedCare: r.id === "med-care",
  };
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const db = new Databases(client);

let cursor = null;
let scanned = 0;
let updated = 0;

console.log(dry ? "DRY RUN" : "LIVE", ENDPOINT);

for (let page = 0; page < 800; page++) {
  const queries = [Query.limit(100), Query.orderAsc("$id")];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const res = await db.listDocuments(DB, COL, queries);
  const docs = res.documents || [];
  if (!docs.length) break;

  for (const doc of docs) {
    scanned++;
    const mfg = canonicalizeManufacturer(doc.manufacturer);
    const toll = canonicalizeManufacturer(doc.toll_manufacturer);
    const patch = {};

    if (mfg.changed) patch.manufacturer = mfg.value;
    if (toll.changed && doc.toll_manufacturer) patch.toll_manufacturer = toll.value;

    if (mfg.isMedCare || toll.isMedCare) {
      if (doc.is_medcare_toll !== true) patch.is_medcare_toll = true;
      if (!doc.toll_manufacturer && mfg.isMedCare) {
        patch.toll_manufacturer = "Med-Care";
      }
    }

    // Prefer company_slug when attribute exists and we know the brand party
    const slug = mfg.slug || toll.slug;
    if (slug && doc.company_slug !== undefined && doc.company_slug !== slug) {
      // only set if field present on schema — ignore errors per doc
      patch.company_slug = slug;
    }

    if (!Object.keys(patch).length) continue;

    console.log(
      (dry ? "would" : "update"),
      doc.canonical_id,
      doc.name_en || doc.$id,
      patch,
    );
    if (!dry) {
      try {
        await db.updateDocument(DB, COL, doc.$id, patch);
        updated++;
      } catch (e) {
        // company_slug may not exist on all schemas — retry without it
        if (patch.company_slug) {
          const { company_slug: _, ...rest } = patch;
          if (Object.keys(rest).length) {
            await db.updateDocument(DB, COL, doc.$id, rest);
            updated++;
          }
        } else {
          console.warn("fail", doc.$id, e.message || e);
        }
      }
    } else {
      updated++;
    }
  }

  cursor = docs[docs.length - 1].$id;
  if (docs.length < 100) break;
}

console.log({ scanned, updated, dry });
