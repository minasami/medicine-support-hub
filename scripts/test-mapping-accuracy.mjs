#!/usr/bin/env node
/**
 * Automated accuracy tests for static→live canonical ID mapping.
 *
 * Usage:
 *   node scripts/test-mapping-accuracy.mjs
 *   pnpm test:mapping-accuracy
 *
 * Exit 0 on pass, 1 on failure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLiveIndexes,
  matchStaticRow,
  mapCorpus,
  runAccuracyAudit,
  nameSimilarity,
  normName,
  normMfr,
} from "./lib/mapping-match.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  "fixtures/mapping-accuracy-cases.json",
);

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(msg);
    console.error("  FAIL:", msg);
  }
}

function almostEq(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function loadFixture() {
  const raw = fs.readFileSync(fixturePath, "utf8");
  return JSON.parse(raw);
}

function testNormalization() {
  console.log("\n[1] Normalization helpers");
  assert(normName("ARMOWAKE 50 MG!") === "armowake 50 mg", "normName strips punct");
  assert(normName("  Foo   Bar ") === "foo bar", "normName collapses space");
  assert(normMfr("Eva Pharma S.A.E.") === "eva", "normMfr strips pharma/sae");
  assert(
    nameSimilarity("ARMOWAKE 50 MG 20 TABS", "ARMOWAKE 50 MG 20 TABS") === 1,
    "identical names Jaccard=1",
  );
  assert(
    nameSimilarity("ARMOWAKE 50 MG", "DABUR AMLA SHAMPOO") < 0.2,
    "unrelated names low Jaccard",
  );
}

function testFixtureCases(fixture) {
  console.log("\n[2] Fixture match cases");
  const indexes = buildLiveIndexes(fixture.live);

  for (const c of fixture.cases) {
    const result = matchStaticRow(c.static, indexes);
    const liveId = result.row
      ? Number(result.row.canonical_id)
      : null;
    const exp = c.expect;

    if (Object.prototype.hasOwnProperty.call(exp, "live_id")) {
      assert(
        liveId === exp.live_id,
        `${c.id}: live_id expected ${exp.live_id}, got ${liveId} (${result.method})`,
      );
    }
    if (exp.not_live_id != null) {
      assert(
        liveId !== exp.not_live_id,
        `${c.id}: must not map to ${exp.not_live_id}`,
      );
    }
    if (exp.method) {
      assert(
        result.method === exp.method,
        `${c.id}: method expected ${exp.method}, got ${result.method}`,
      );
    }
    if (exp.confidence_min != null) {
      assert(
        result.confidence >= exp.confidence_min - 1e-9,
        `${c.id}: confidence ${result.confidence} < min ${exp.confidence_min}`,
      );
    }
    if (exp.confidence_max != null) {
      assert(
        result.confidence <= exp.confidence_max + 1e-9,
        `${c.id}: confidence ${result.confidence} > max ${exp.confidence_max}`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(exp, "ambiguous")) {
      assert(
        Boolean(result.ambiguous) === Boolean(exp.ambiguous),
        `${c.id}: ambiguous expected ${exp.ambiguous}, got ${result.ambiguous}`,
      );
    }
  }
}

function testConfidenceTable(fixture) {
  console.log("\n[3] Confidence score table");
  const indexes = buildLiveIndexes(fixture.live);

  const barcode = matchStaticRow(
    { name_en: "x", barcode: "6224000123456" },
    indexes,
  );
  assert(
    almostEq(barcode.confidence, 0.99),
    `exact_barcode confidence 0.99 got ${barcode.confidence}`,
  );

  const code = matchStaticRow(
    { name_en: "x", code: "DAB-AMLA-400" },
    indexes,
  );
  assert(
    almostEq(code.confidence, 0.97),
    `exact_code confidence 0.97 got ${code.confidence}`,
  );

  const nameEn = matchStaticRow(
    { name_en: "ARMOWAKE 50 MG 20 TABS" },
    indexes,
  );
  assert(
    almostEq(nameEn.confidence, 0.92),
    `exact_name_en confidence 0.92 got ${nameEn.confidence}`,
  );

  const mfr = matchStaticRow(
    { name_en: "PARACETAMOL 500 MG", manufacturer: "Company A" },
    indexes,
  );
  assert(
    mfr.method === "dup_manufacturer" && almostEq(mfr.confidence, 0.85),
    `dup_manufacturer confidence 0.85 got ${mfr.method}/${mfr.confidence}`,
  );
}

function testAccuracyAuditFormula() {
  console.log("\n[4] Accuracy audit aggregate formula");
  const rows = [
    {
      live_canonical_id: 1,
      confidence: 0.99,
      match_method: "exact_barcode",
      static_name_en: "A",
      live_name_en: "A",
      ambiguous: false,
    },
    {
      live_canonical_id: 2,
      confidence: 0.92,
      match_method: "exact_name_en",
      static_name_en: "B",
      live_name_en: "B",
      ambiguous: false,
    },
    {
      live_canonical_id: 3,
      confidence: 0.85,
      match_method: "dup_manufacturer",
      static_name_en: "C",
      live_name_en: "C",
      ambiguous: false,
    },
    {
      live_canonical_id: null,
      confidence: 0,
      match_method: "unmatched",
      static_name_en: "D",
      live_name_en: null,
      ambiguous: false,
    },
  ];
  // high=2, medium=1, low=0, matched=3
  // score = 100 * (2 + 0.7*1) / 3 = 90
  const audit = runAccuracyAudit(rows);
  assert(audit.matched_count === 3, `matched_count 3 got ${audit.matched_count}`);
  assert(audit.unmatched_count === 1, `unmatched 1 got ${audit.unmatched_count}`);
  assert(audit.confidence.high_ge_0_9 === 2, "high=2");
  assert(audit.confidence.medium_0_7_to_0_9 === 1, "medium=1");
  assert(
    almostEq(audit.accuracy_score_percent, 90),
    `accuracy_score 90 got ${audit.accuracy_score_percent}`,
  );
  assert(audit.pass === true, "audit should pass");
}

function testCorpusNoCrossLink(fixture) {
  console.log("\n[5] Corpus: Armowake must never map to Dabur");
  const staticList = [
    {
      name_en: "ARMOWAKE 50 MG 20 TABS",
      manufacturer: "Eva Pharma",
      barcode: "6224000123456",
    },
    {
      name_en: "ARMOWAKE 50 MG 20 TABS",
      manufacturer: "Eva Pharma",
    },
  ];
  const rows = mapCorpus(staticList, fixture.live);
  for (const r of rows) {
    assert(
      r.live_canonical_id === 1001,
      `Armowake row mapped to ${r.live_canonical_id} via ${r.match_method}`,
    );
    assert(
      r.live_canonical_id !== 1002,
      "Armowake must not map to Dabur (1002)",
    );
  }
}

function testClientMapRules() {
  console.log("\n[6] Client map rules (ambiguous names)");
  // Simulate public map behavior: ambiguous names must not be in name_to_live
  const live = [
    { canonical_id: 1, name_en: "SAME NAME", manufacturer: "A" },
    { canonical_id: 2, name_en: "SAME NAME", manufacturer: "B" },
    { canonical_id: 3, name_en: "UNIQUE PRODUCT", manufacturer: "C" },
  ];
  const indexes = buildLiveIndexes(live);
  const name_to_live = {};
  const ambiguous_names = {};
  for (const [name, rows] of indexes.byNameEn.entries()) {
    if (rows.length === 1) {
      name_to_live[name] = Number(rows[0].canonical_id);
    } else {
      ambiguous_names[name] = rows.map((r) => Number(r.canonical_id));
    }
  }
  assert(
    name_to_live["unique product"] === 3,
    "unique name in name_to_live",
  );
  assert(
    ambiguous_names["same name"]?.length === 2,
    "duplicate name marked ambiguous",
  );
  assert(
    name_to_live["same name"] == null,
    "duplicate name must NOT be in name_to_live",
  );
}

function main() {
  console.log("=== Mapping accuracy automated tests ===");
  const fixture = loadFixture();

  testNormalization();
  testFixtureCases(fixture);
  testConfidenceTable(fixture);
  testAccuracyAuditFormula();
  testCorpusNoCrossLink(fixture);
  testClientMapRules();

  console.log("\n=== Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) {
    console.error("\nFailures:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("All mapping accuracy tests passed.");
}

main();
