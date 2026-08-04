#!/usr/bin/env node
/**
 * Wires AdminCommandHub into App.tsx routes.
 * Run: node scripts/wire-admin-command-hub.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/web/src/App.tsx");
let t = fs.readFileSync(appPath, "utf8");

if (t.includes("AdminCommandHub") || t.includes("admin-command-hub")) {
  console.log("Admin command hub already wired");
  process.exit(0);
}

// Add lazy import near other admin imports
const importNeedle = "const AdminPortal = lazy(() => import(\"@/pages/admin\"));";
const importInsert =
  importNeedle +
  "\nconst AdminCommandHub = lazy(() => import(\"@/pages/admin-command-hub\"));";

if (!t.includes(importNeedle)) {
  console.error("Could not find AdminPortal lazy import");
  process.exit(1);
}
t = t.replace(importNeedle, importInsert);

// Add route before /admin
const routeNeedle = '<Route path="/admin" component={AdminPortal} />';
const routeInsert =
  '<Route path="/admin/hub" component={AdminCommandHub} />\n        <Route path="/admin" component={AdminPortal} />';

if (!t.includes(routeNeedle)) {
  console.error("Could not find /admin route");
  process.exit(1);
}
t = t.replace(routeNeedle, routeInsert);

fs.writeFileSync(appPath, t);
console.log("Wired /admin/hub -> AdminCommandHub");
