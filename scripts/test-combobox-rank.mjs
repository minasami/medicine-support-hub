import assert from "node:assert/strict";

function normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreComboboxOption(query, label) {
  const q = normalize(query);
  const l = normalize(label);
  if (!q) {
    const comboPenalty =
      (l.match(/[+\/&,;|]/g) || []).length * 8 + Math.max(0, l.length - 48);
    return Math.max(0, 200 - comboPenalty);
  }
  if (l === q) return 10_000;
  if (l.startsWith(q + " ") || l.startsWith(q)) return 8_000 - Math.min(l.length, 500);
  const words = l.split(/[\s,+/&;|()\-]+/).filter(Boolean);
  if (words.some((w) => w === q)) return 7_000 - Math.min(l.length, 500);
  if (words.some((w) => w.startsWith(q))) return 6_000 - Math.min(l.length, 500);
  const idx = l.indexOf(q);
  if (idx >= 0) {
    const comboPenalty =
      (l.match(/[+\/&,;|]/g) || []).length * 40 + Math.max(0, l.length - 36);
    return 4_000 - idx - comboPenalty;
  }
  return -1;
}

function filterAndRank(options, query, limit = 80) {
  const scored = options
    .map((opt) => ({ opt, score: scoreComboboxOption(query, opt.label || opt.value) }))
    .filter((row) => row.score >= 0);
  scored.sort((a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label));
  return scored.slice(0, limit).map((r) => r.opt);
}

const options = [
  { label: "Probiotics + Vitamins + Minerals Complex Long Combination", value: "combo" },
  { label: "Probiotics", value: "exact" },
  { label: "Probiotic Blend", value: "prefixish" },
  { label: "Lactobacillus Probiotics Capsules with Zinc", value: "contains" },
];

const ranked = filterAndRank(options, "Probiotics");
assert.equal(ranked[0].value, "exact", "exact match should rank first");
assert.ok(
  ranked.findIndex((r) => r.value === "exact") <
    ranked.findIndex((r) => r.value === "combo"),
  "standalone before long combo",
);
console.log("combobox-rank OK", ranked.map((r) => r.value));
