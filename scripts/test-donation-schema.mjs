#!/usr/bin/env node
/** Schema validation unit tests (Node, no Zod). */

import {
  validateParsedRow,
  validateImportPayload,
  validateRequestPayload,
} from "./lib/donation-schema.mjs";
import { parseDonationCsv } from "./lib/donation-csv-parser.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

console.log("\n=== validateParsedRow ===");
assert(
  "accepts valid row",
  validateParsedRow({
    item_code: "FP-1",
    item_desc: "Test",
    lot_no: "L1",
    expiry_date: "2026-12-31T23:59:59.000Z",
    quantity_accept: 10,
    list_price_egp: 5,
  }).length === 0,
);
assert(
  "rejects missing lot",
  validateParsedRow({
    item_code: "FP-1",
    item_desc: "Test",
    lot_no: "",
    expiry_date: "2026-12-31",
    quantity_accept: 10,
    list_price_egp: 0,
  }).some((p) => p.includes("lot_no")),
);
assert(
  "rejects qty 0",
  validateParsedRow({
    item_code: "FP-1",
    item_desc: "Test",
    lot_no: "L1",
    expiry_date: "2026-12-31",
    quantity_accept: 0,
    list_price_egp: 0,
  }).some((p) => p.includes("quantity")),
);

console.log("\n=== validateImportPayload ===");
assert(
  "requires orgId/title/rows",
  validateImportPayload({}).length >= 3,
);
assert(
  "accepts minimal",
  validateImportPayload({
    orgId: "demo",
    title: "Batch",
    rows: [{ item_code: "x" }],
  }).length === 0,
);

console.log("\n=== validateRequestPayload ===");
assert(
  "rejects over-available",
  validateRequestPayload({
    requesterOrgId: "a",
    requestedBy: "u",
    quantity: 20,
    available: 5,
  }).some((p) => p.includes("exceeds")),
);
assert(
  "accepts valid request",
  validateRequestPayload({
    requesterOrgId: "a",
    requestedBy: "u",
    quantity: 5,
    available: 10,
  }).length === 0,
);

console.log("\n=== fixture rows pass schema ===");
{
  const path = join(__dirname, "fixtures", "donation-ngo-sample.csv");
  const r = parseDonationCsv(readFileSync(path, "utf8"));
  let schemaFails = 0;
  for (const row of r.valid) {
    const problems = validateParsedRow(row);
    if (problems.length) schemaFails += 1;
  }
  assert("all 29 fixture rows schema-valid", schemaFails === 0 && r.valid.length === 29, `fails=${schemaFails}`);
}

console.log("\n=== Summary ===");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
