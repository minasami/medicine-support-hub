#!/usr/bin/env node
/**
 * Restores medicines-encyclopedia.tsx from a known-good commit and applies
 * product-card image UI (if not already present).
 *
 * Usage:
 *   node scripts/restore-encyclopedia-with-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
const GOOD_SHA = "6a5d46e70e38826efceda5ab4a209a5cd9c6f651";

function restoreFromGit() {
  try {
    execSync(
      `git checkout ${GOOD_SHA} -- apps/web/src/pages/medicines-encyclopedia.tsx`,
      { cwd: root, stdio: "inherit" },
    );
    return true;
  } catch {
    return false;
  }
}

async function restoreFromRaw() {
  const url = `https://raw.githubusercontent.com/minasami/medicine-support-hub/${GOOD_SHA}/apps/web/src/pages/medicines-encyclopedia.tsx`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const text = await res.text();
  if (text.length < 10000 || text.includes("PLACEHOLDER")) {
    throw new Error("Remote content invalid");
  }
  fs.writeFileSync(target, text);
  console.log("Restored from raw.githubusercontent.com");
}

async function main() {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current.trim() === "PLACEHOLDER" || current.length < 500) {
    console.log("Encyclopedia corrupt/missing — restoring…");
    if (!restoreFromGit()) await restoreFromRaw();
  }

  // Apply image wire
  const wire = path.join(root, "scripts/wire-encyclopedia-card-images.mjs");
  if (fs.existsSync(wire)) {
    execSync(`node ${JSON.stringify(wire)}`, { cwd: root, stdio: "inherit" });
  } else {
    console.warn("wire-encyclopedia-card-images.mjs missing");
  }

  const final = fs.readFileSync(target, "utf8");
  console.log(
    "Final size", final.length,
    "has images", final.includes("object-contain"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
