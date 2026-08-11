/**
 * Wire startAdaptiveBeacon into App root useEffect.
 *   node scripts/wire-adaptive-beacon-app.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/web/src/App.tsx");
let s = fs.readFileSync(appPath, "utf8");

if (s.includes("startAdaptiveBeacon")) {
  console.log("Already wired");
  process.exit(0);
}

if (!s.includes('from "@/lib/appwrite"')) {
  console.error("appwrite import not found");
  process.exit(1);
}

s = s.replace(
  'import { client as appwriteClient } from "@/lib/appwrite";',
  'import { client as appwriteClient } from "@/lib/appwrite";\nimport { startAdaptiveBeacon } from "@/lib/adaptive";',
);

const oldFx = `export default function App() {
  useEffect(() => {
    if (import.meta.env.VITE_APPWRITE_PROJECT_ID) {
      try {
        appwriteClient.setEndpoint(
          import.meta.env.VITE_APPWRITE_ENDPOINT ||
            "https://fra.cloud.appwrite.io/v1",
        );
        appwriteClient.setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
      } catch (e) {
        console.warn("Appwrite Client initialization notice:", e);
      }
    }
  }, []);`;

const newFx = `export default function App() {
  useEffect(() => {
    if (import.meta.env.VITE_APPWRITE_PROJECT_ID) {
      try {
        appwriteClient.setEndpoint(
          import.meta.env.VITE_APPWRITE_ENDPOINT ||
            "https://fra.cloud.appwrite.io/v1",
        );
        appwriteClient.setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
      } catch (e) {
        console.warn("Appwrite Client initialization notice:", e);
      }
    }
    // Anonymized adaptive signals → Appwrite aggregator (no-op without VITE_ADAPTIVE_FUNCTION_URL)
    return startAdaptiveBeacon(120_000);
  }, []);`;

if (!s.includes(oldFx)) {
  console.error("App useEffect block not found — update manually");
  process.exit(1);
}

s = s.replace(oldFx, newFx);
fs.writeFileSync(appPath, s);
console.log("Wired startAdaptiveBeacon into", appPath);
