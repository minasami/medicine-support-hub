import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Inline mirror of apps/web/src/lib/scientific-ingredients.ts for node test without TS loader
const SPLIT_RE = /\s*(?:\+|\/|&|;|\||\band\b)\s*/i;
function parseScientificIngredients(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
function joinScientificIngredients(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const trimmed = String(p || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.join(" + ");
}

assert.deepEqual(parseScientificIngredients("Paracetamol + Caffeine"), ["Paracetamol", "Caffeine"]);
assert.deepEqual(parseScientificIngredients("A / B & C"), ["A", "B", "C"]);
assert.equal(joinScientificIngredients(["Paracetamol", "Caffeine"]), "Paracetamol + Caffeine");
assert.equal(joinScientificIngredients(["X", "x", "Y"]), "X + Y");
console.log("scientific-ingredients OK");
