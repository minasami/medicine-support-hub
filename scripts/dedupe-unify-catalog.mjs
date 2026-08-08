/**
 * CLI: merge + dedupe local catalog files → unified JSON.
 *
 * Usage:
 *   node scripts/dedupe-unify-catalog.mjs \
 *     --input ./data/Egyptian\ medicines.json \
 *     --input ./data/medicines2.csv \
 *     --input ./data/medicines5.csv \
 *     --out apps/web/public/data/unified-medicines-deduped.json
 *
 *   node scripts/dedupe-unify-catalog.mjs --dir ./data --out ./out.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  dedupeMedicines,
  normalizeSourceRow,
} from "./lib/medicine-dedupe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const inputs = [];
  let dir = null;
  let out = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) inputs.push(argv[++i]);
    else if (argv[i] === "--dir" && argv[i + 1]) dir = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
  }
  return { inputs, dir, out };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] != null ? cols[idx] : "";
    });
    rows.push(obj);
  }
  return rows;
}

function loadFile(filePath) {
  const base = path.basename(filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const tag = base.replace(/\.[^.]+$/, "");
  if (base.endsWith(".json")) {
    const data = JSON.parse(text);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.medicines)
        ? data.medicines
        : [];
    return list.map((r) => normalizeSourceRow(r, tag));
  }
  if (base.endsWith(".csv")) {
    return parseCsv(text).map((r) =>
      normalizeSourceRow(
        {
          name_en: r.name_en || r.commercial_name_en,
          name_ar: r.name_ar || r.commercial_name_ar,
          barcode: r.barcode,
          code: r.code || r.custom_product_code,
          price: r.price,
          manufacturer: r.manufacturer,
          scientific_name: r.scientific_name,
          drug_class: r.drug_class,
          route: r.route,
          commercial_name_en: r.commercial_name_en,
          commercial_name_ar: r.commercial_name_ar,
          price_egp: r.price_egp,
        },
        tag,
      ),
    );
  }
  console.warn("Skip unsupported:", filePath);
  return [];
}

const { inputs, dir, out } = parseArgs(process.argv);
const files = [...inputs];
if (dir && fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (/\.(json|csv)$/i.test(f) && !/ichi|linearization/i.test(f)) {
      files.push(path.join(dir, f));
    }
  }
}

if (!files.length) {
  console.error("Provide --input file.json|csv and/or --dir folder");
  process.exit(1);
}

const all = [];
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.warn("Missing:", f);
    continue;
  }
  const rows = loadFile(f);
  console.log(`Loaded ${rows.length} from ${path.basename(f)}`);
  all.push(...rows);
}

const { medicines, stats } = dedupeMedicines(all, { startCanonicalId: 10001 });
console.log("\n=== Dedupe stats ===");
console.log(JSON.stringify(stats, null, 2));

const payload = {
  version: "5.0.0-dedupe",
  last_updated: new Date().toISOString(),
  total_count: medicines.length,
  stats,
  medicines,
};

const outPath =
  out ||
  path.join(root, "apps/web/public/data/unified-medicines-deduped.json");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
console.log(
  `\nWrote ${medicines.length} medicines → ${outPath} (${(
    fs.statSync(outPath).size / 1e6
  ).toFixed(2)} MB)`,
);
console.log(`Med-Care toll tagged: ${stats.medcare_toll}`);
