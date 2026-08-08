/**
 * Bulk upsert unified/deduped medicines JSON into Appwrite Cloud.
 *
 * Prerequisites:
 *   - APPWRITE_API_KEY with databases.read + databases.write
 *   - Optional: --ensure-attrs for is_medcare_toll / toll_manufacturer
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/import-unified-to-appwrite.mjs \
 *     --input apps/web/public/data/unified-medicines-deduped.json \
 *     --ensure-attrs --concurrency 8
 *
 * Flags:
 *   --input PATH     unified JSON (medicines[] or root array)
 *   --concurrency N  parallel workers (default 6)
 *   --limit N        max docs (0 = all)
 *   --offset N       skip first N
 *   --dry-run        parse only
 *   --ensure-attrs   create is_medcare_toll / toll_manufacturer if missing
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

function parseArgs(argv) {
  let input = null;
  let concurrency = 6;
  let limit = 0;
  let offset = 0;
  let dryRun = false;
  let ensureAttrs = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) input = argv[++i];
    else if (argv[i] === "--concurrency" && argv[i + 1])
      concurrency = Number(argv[++i]) || 6;
    else if (argv[i] === "--limit" && argv[i + 1]) limit = Number(argv[++i]) || 0;
    else if (argv[i] === "--offset" && argv[i + 1]) offset = Number(argv[++i]) || 0;
    else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--ensure-attrs") ensureAttrs = true;
  }
  return { input, concurrency, limit, offset, dryRun, ensureAttrs };
}

async function aw(method, urlPath, body) {
  const res = await fetch(`${ENDPOINT}${urlPath}`, {
    method,
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function str(v, max = 255) {
  if (v == null) return null;
  const s = String(v).replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function toPayload(m) {
  const canonical_id = Number(m.canonical_id) || 0;
  const isMed = Boolean(m.is_medcare_toll);
  const toll = str(m.toll_manufacturer, 64);
  let manufacturer = str(m.manufacturer, 255);
  if (isMed && manufacturer && !/med[\s-]?care/i.test(manufacturer)) {
    manufacturer = str(`Med-Care > ${manufacturer}`, 255);
  } else if (isMed && !manufacturer) {
    manufacturer = "Med-Care";
  }

  const data = {
    canonical_id,
    name_en: str(m.name_en, 255) || `Product ${canonical_id}`,
    name_ar: str(m.name_ar, 255),
    scientific_name: str(m.scientific_name, 512),
    manufacturer,
    category: str(m.category || m.drug_class, 128),
    dosage_form: str(m.dosage_form, 128),
    strength: str(m.strength, 64),
    drug_class: str(m.drug_class, 128),
    route: str(m.route, 64),
    product_type: str(m.product_type, 32),
    current_price_egp:
      m.current_price_egp != null && Number(m.current_price_egp) > 0
        ? Number(m.current_price_egp)
        : null,
    image_url: str(m.image_url, 2048),
    has_verified_dataset: Boolean(m.has_verified_dataset),
    barcode: str(m.barcode, 32),
    code: str(m.code, 64),
    is_medcare_toll: isMed,
    toll_manufacturer: toll || (isMed ? "Med-Care" : null),
  };

  for (const k of Object.keys(data)) {
    if (data[k] === null || data[k] === undefined || data[k] === "") delete data[k];
  }
  return data;
}

async function ensureOptionalAttributes() {
  const attrs = [
    {
      key: "is_medcare_toll",
      path: `/databases/${DB}/collections/${COL}/attributes/boolean`,
      body: { key: "is_medcare_toll", required: false, default: false },
    },
    {
      key: "toll_manufacturer",
      path: `/databases/${DB}/collections/${COL}/attributes/string`,
      body: { key: "toll_manufacturer", size: 64, required: false },
    },
  ];
  for (const a of attrs) {
    const r = await aw("POST", a.path, a.body);
    if (r.ok || r.status === 409) {
      console.log(`  attr ${a.key}: ${r.ok ? "created" : "exists"}`);
    } else {
      console.warn(`  attr ${a.key}: ${r.status}`, r.json?.message || r.json);
    }
  }
  console.log("  waiting 5s for attribute availability...");
  await new Promise((r) => setTimeout(r, 5000));
}

async function upsertOne(med, stripOptional = false) {
  const data = toPayload(med);
  if (stripOptional) {
    delete data.is_medcare_toll;
    delete data.toll_manufacturer;
  }
  const documentId = `med_${data.canonical_id}`;
  const create = await aw("POST", `/databases/${DB}/collections/${COL}/documents`, {
    documentId,
    data,
  });
  if (create.ok) return { ok: true, action: "create" };
  if (create.status === 409) {
    const patch = await aw(
      "PATCH",
      `/databases/${DB}/collections/${COL}/documents/${documentId}`,
      { data },
    );
    if (patch.ok) return { ok: true, action: "update" };
    if (!stripOptional && patch.status === 400) return upsertOne(med, true);
    return {
      ok: false,
      action: "update_fail",
      status: patch.status,
      message: patch.json?.message,
    };
  }
  if (!stripOptional && create.status === 400) return upsertOne(med, true);
  return {
    ok: false,
    action: "create_fail",
    status: create.status,
    message: create.json?.message,
  };
}

async function mapPool(items, concurrency, fn) {
  let i = 0;
  let ok = 0;
  let fail = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      try {
        const r = await fn(item);
        if (r.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
      const done = ok + fail;
      if (done % 500 === 0 || done === items.length) {
        console.log(`  progress ${done}/${items.length} (ok=${ok} fail=${fail})`);
      }
    }
  });
  await Promise.all(workers);
  return { ok, fail };
}

const args = parseArgs(process.argv);
if (!API_KEY && !args.dryRun) {
  console.error("Set APPWRITE_API_KEY");
  process.exit(1);
}

const inputPath = args.input
  ? path.resolve(args.input)
  : path.join(root, "apps/web/public/data/unified-medicines-deduped.json");

if (!fs.existsSync(inputPath)) {
  console.error("Input not found:", inputPath);
  console.error("Run: node scripts/dedupe-unify-catalog.mjs --dir <Databases>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
let list = Array.isArray(raw) ? raw : raw.medicines || [];
console.log(`Loaded ${list.length} medicines from ${inputPath}`);

if (args.offset) list = list.slice(args.offset);
if (args.limit > 0) list = list.slice(0, args.limit);

const medcare = list.filter((m) => m.is_medcare_toll).length;
console.log(`Slice: ${list.length} (Med-Care toll in slice: ${medcare})`);

if (args.dryRun) {
  console.log("Dry run — sample:", JSON.stringify(toPayload(list[0] || {}), null, 2));
  process.exit(0);
}

if (args.ensureAttrs) {
  console.log("Ensuring optional attributes...");
  await ensureOptionalAttributes();
}

console.log(`Upserting concurrency=${args.concurrency} → ${ENDPOINT} ${DB}/${COL}`);
const t0 = Date.now();
const { ok, fail } = await mapPool(list, args.concurrency, (m) => upsertOne(m));
const sec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${sec}s — ok=${ok} fail=${fail}`);
console.log("Tip: add a key index on is_medcare_toll for fast Med-Care filtering.");
