#!/usr/bin/env node
/**
 * Automated unit tests for donation CSV parsing.
 * Run: node scripts/test-donation-csv.mjs
 *      pnpm run test:donation-csv
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDonationCsv,
  parseDonationExpiry,
  normalizeHeader,
  summarizeParse,
} from "./lib/donation-csv-parser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n=== normalizeHeader ===");
assert('"Lot No." → lot no', normalizeHeader("Lot No.") === "lot no");
assert('"Lot No" → lot no', normalizeHeader("Lot No") === "lot no");
assert('"ITEM CODE" → item code', normalizeHeader("ITEM CODE") === "item code");
assert('"Exp Date" → exp date', normalizeHeader("Exp Date") === "exp date");
assert("trims spaces", normalizeHeader("  Qty  ") === "qty");

console.log("\n=== parseDonationExpiry ===");
assert("31-Dec-26", !!parseDonationExpiry("31-Dec-26")?.startsWith("2026-12-31"));
assert("30-Nov-26", !!parseDonationExpiry("30-Nov-26")?.startsWith("2026-11-30"));
assert("30-Sep-26", !!parseDonationExpiry("30-Sep-26")?.startsWith("2026-09-30"));
assert("31-Oct-2026", !!parseDonationExpiry("31-Oct-2026")?.startsWith("2026-10-31"));
assert("ISO date", !!parseDonationExpiry("2026-12-31"));
assert("empty → null", parseDonationExpiry("") === null);
assert("garbage → null", parseDonationExpiry("not-a-date") === null);

console.log("\n=== Lot No. regression (the live bug) ===");
{
  const csv = `Org Code,Item Code,Item Desc,Lot No.,Locator,Quantity Accept,Price List,Exp Date,Po Category
PFA,FP-VA-663.01,DALAFUNGIL 100 MG,2412169,Strips(Near Expire)10,658,1346,31-Dec-26,Local
`;
  const r = parseDonationCsv(csv);
  assert("maps lot_no column", Object.values(r.colMap).includes("lot_no"));
  assert("1 valid row", r.valid.length === 1, `got ${r.valid.length} valid, ${r.errors.length} errors`);
  assert("lot_no value", r.valid[0]?.lot_no === "2412169", `got ${r.valid[0]?.lot_no}`);
  assert("no missing lot no error", !r.errors.some((e) => e.error?.includes("lot no")));
}

console.log("\n=== Required field failures ===");
{
  const csv = `Item Code,Item Desc,Lot No.,Quantity Accept,Exp Date
,,2412169,10,31-Dec-26
FP-X,Widget,,10,31-Dec-26
FP-Y,Widget,LOT1,0,31-Dec-26
FP-Z,Widget,LOT2,5,bad-date
`;
  const r = parseDonationCsv(csv);
  assert("4 error rows", r.errors.length === 4, `got ${r.errors.length}`);
  assert("detects missing item code/desc", r.errors[0]?.error?.includes("item"));
  assert("detects missing lot", r.errors[1]?.error?.includes("lot"));
  assert("detects qty <= 0", r.errors[2]?.error?.includes("quantity"));
  assert("detects bad exp", r.errors[3]?.error?.includes("exp"));
}

console.log("\n=== Fixture: donation-ngo-sample.csv ===");
{
  const path = join(__dirname, "fixtures", "donation-ngo-sample.csv");
  const text = readFileSync(path, "utf8");
  const r = parseDonationCsv(text);
  const s = summarizeParse(r);
  assert("29 data rows", s.totalRows === 29, `got ${s.totalRows}`);
  assert("all valid", s.validRows === 29 && s.errorRows === 0, `valid=${s.validRows} errors=${s.errorRows}`);
  assert("no missing columns", s.missingRequiredColumns.length === 0, s.missingRequiredColumns.join(","));
  assert("maps lot_no", s.mappedColumns.includes("lot_no"));
  assert("total units > 0", s.totalUnits > 0, String(s.totalUnits));
  assert("near-expire flagged", s.nearExpireCount === 29, `got ${s.nearExpireCount}`);
  assert("first lot PFA/2412169", r.valid[0]?.org_code === "PFA" && r.valid[0]?.lot_no === "2412169");
}

console.log("\n=== Quoted fields / commas in desc ===");
{
  const csv = `Item Code,Item Desc,Lot No.,Quantity Accept,Exp Date
FP-1,"CREAM, 15 GM",L1,10,31-Dec-26
`;
  const r = parseDonationCsv(csv);
  assert("quoted comma preserved", r.valid[0]?.item_desc === "CREAM, 15 GM");
  assert("lot still mapped", r.valid[0]?.lot_no === "L1");
}

console.log("\n=== Summary ===");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
