#!/usr/bin/env node
/**
 * Inserts AdminAutomatePanel into admin-command-hub.tsx if missing.
 * Run: node scripts/wire-admin-automate-panel.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "apps/web/src/pages/admin-command-hub.tsx");
let t = fs.readFileSync(file, "utf8");

if (t.includes("AdminAutomatePanel")) {
  console.log("AdminAutomatePanel already wired");
  process.exit(0);
}

if (!t.includes('from "@/components/admin-shell"')) {
  console.error("admin-command-hub.tsx missing AdminShell import");
  process.exit(1);
}

t = t.replace(
  'import { AdminShell } from "@/components/admin-shell";',
  'import { AdminShell } from "@/components/admin-shell";\nimport { AdminAutomatePanel } from "@/components/admin-automate-panel";',
);

const marker =
  '{/* One-click claim approval */}';
const insert =
  '<AdminAutomatePanel\n        actorEmail={email}\n        onCompleted={() => void load()}\n      />\n\n      {/* One-click claim approval */}';

if (t.includes(marker)) {
  t = t.replace(marker, insert);
} else {
  // Fallback: after first queues section close
  const alt = "</section>\n\n      <Card className=\"border-amber-500/20\">";
  if (t.includes(alt)) {
    t = t.replace(
      alt,
      `</section>\n\n      <AdminAutomatePanel\n        actorEmail={email}\n        onCompleted={() => void load()}\n      />\n\n      <Card className=\"border-amber-500/20\">`,
    );
  } else {
    console.error("Could not find insertion point");
    process.exit(1);
  }
}

fs.writeFileSync(file, t);
console.log("Wired AdminAutomatePanel into command hub");
