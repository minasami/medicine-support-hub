/**
 * Human-gated promotion: pull approved aliases from the aggregator function
 * and merge into apps/web/src/lib/expand-search-query.ts as INN_FIXUPS regexes.
 *
 *   ADAPTIVE_FUNCTION_URL=https://... ADAPTIVE_ADMIN_KEY=... \
 *     node scripts/promote-approved-aliases.mjs [--dry-run]
 *
 * After review, commit the file change — shared catalog rules never change
 * without this explicit step.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expandPath = path.join(root, "apps/web/src/lib/expand-search-query.ts");
const url = process.env.ADAPTIVE_FUNCTION_URL || "";
const adminKey = process.env.ADAPTIVE_ADMIN_KEY || "";
const dry = process.argv.includes("--dry-run");

if (!url) {
  console.error("ADAPTIVE_FUNCTION_URL is required");
  process.exit(1);
}

async function call(action, extra = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(adminKey ? { "x-adaptive-key": adminKey } : {}),
    },
    body: JSON.stringify({ action, adminKey, ...extra }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || res.statusText);
  }
  return data;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const data = await call("list_approved");
const approved = data.approved || [];
if (!approved.length) {
  console.log("No approved aliases waiting for promotion.");
  process.exit(0);
}

console.log(`Found ${approved.length} approved alias(es):`);
for (const a of approved) {
  console.log(`  ${a.fromQuery}  →  ${a.toQuery}  (${a.reviewer || "?"})`);
}

let src = fs.readFileSync(expandPath, "utf8");
const markerStart = "/** Known pharma misspelling → preferred form (lowercase). */";
const arrStart = src.indexOf("const INN_FIXUPS");
if (arrStart < 0) {
  console.error("INN_FIXUPS not found in expand-search-query.ts");
  process.exit(1);
}

const insertAt = src.indexOf("];", arrStart);
if (insertAt < 0) {
  console.error("Could not find end of INN_FIXUPS array");
  process.exit(1);
}

const existing = src.slice(arrStart, insertAt);
const lines = [];
const promotedIds = [];

for (const a of approved) {
  const from = String(a.fromQuery || "").trim();
  const to = String(a.toQuery || "").trim();
  if (!from || !to) continue;
  // Skip if already present
  if (existing.includes(`to: "${to}"`) && existing.toLowerCase().includes(from.toLowerCase())) {
    console.log(`  skip (already present): ${from} → ${to}`);
    promotedIds.push(a.id);
    continue;
  }
  const re = escapeRegex(from);
  lines.push(`  { re: /${re}/i, to: "${to}" }, // adaptive approved`);
  promotedIds.push(a.id);
}

if (!lines.length) {
  console.log("Nothing new to insert.");
  if (promotedIds.length && !dry) {
    await call("mark_promoted", { ids: promotedIds });
    console.log("Marked already-present aliases as promoted.");
  }
  process.exit(0);
}

const injection = lines.join("\n") + "\n";
if (dry) {
  console.log("DRY RUN would insert:\n" + injection);
  process.exit(0);
}

src = src.slice(0, insertAt) + injection + src.slice(insertAt);
fs.writeFileSync(expandPath, src);
console.log(`Updated ${expandPath}`);

await call("mark_promoted", { ids: promotedIds.filter(Boolean) });
console.log("Marked decisions promoted=true. Review diff and commit.");
