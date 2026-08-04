#!/usr/bin/env node
/**
 * Restores medicines-encyclopedia.tsx from a known-good commit on GitHub,
 * then applies live-search UX via wire-encyclopedia-live-search.mjs
 *
 * Run:
 *   node scripts/restore-encyclopedia-from-cdn.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const OUT = path.join("apps/web/src/pages/medicines-encyclopedia.tsx");
const COMMIT = "dcbaf47f68e91316be70a59c10f18f17b01df7be";
const URL =
  "https://cdn.jsdelivr.net/gh/minasami/medicine-support-hub@" +
  COMMIT +
  "/apps/web/src/pages/medicines-encyclopedia.tsx";

const res = await fetch(URL);
if (!res.ok) {
  console.error("Failed to download encyclopedia:", res.status, URL);
  process.exit(1);
}
const text = await res.text();
if (!text.includes("MedicinesEncyclopediaPage") && !text.includes("export default")) {
  console.error("Downloaded content does not look like the encyclopedia page");
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
console.log("Restored", OUT, "bytes", text.length, "from", COMMIT);

const wire = path.join("scripts", "wire-encyclopedia-live-search.mjs");
if (fs.existsSync(wire)) {
  const r = spawnSync(process.execPath, [wire], { stdio: "inherit" });
  process.exit(r.status ?? 1);
} else {
  console.warn("wire-encyclopedia-live-search.mjs not found — restored base only");
}
