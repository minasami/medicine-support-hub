#!/usr/bin/env node
/**
 * List Appwrite Functions + latest deployment status.
 *
 *   export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
 *   export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
 *   export APPWRITE_API_KEY=…
 *   node scripts/verify-appwrite-functions.mjs
 */

const ENDPOINT = (process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1").replace(
  /\/$/,
  "",
);
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const KEY = process.env.APPWRITE_API_KEY || "";

if (!PROJECT || !KEY) {
  console.error("APPWRITE_PROJECT_ID and APPWRITE_API_KEY required");
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": KEY,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data.message || res.statusText}`);
  return data;
}

const list = await api("/functions");
const fns = list.functions || [];
console.log(`Functions: ${fns.length}\n`);

if (!fns.length) {
  console.log("None found. Run: node scripts/deploy-appwrite-functions.mjs --ensure");
  process.exit(1);
}

let inactive = 0;
for (const f of fns) {
  let depStatus = "(no deployment)";
  let depId = f.deployment || f.deploymentId || "";
  try {
    const deps = await api(`/functions/${f.$id}/deployments?queries[]=${encodeURIComponent("limit(1)")}&queries[]=${encodeURIComponent("orderDesc(\"$createdAt\")")}`);
    const d = (deps.deployments || [])[0];
    if (d) {
      depStatus = d.status || "?";
      depId = d.$id;
      if (d.status !== "ready" && d.status !== "active") inactive += 1;
    } else {
      inactive += 1;
    }
  } catch {
    try {
      const deps = await api(`/functions/${f.$id}/deployments`);
      const d = (deps.deployments || [])[0];
      if (d) {
        depStatus = d.status || "?";
        depId = d.$id;
        if (!["ready", "active"].includes(String(d.status))) inactive += 1;
      } else inactive += 1;
    } catch (e) {
      depStatus = `error: ${e.message}`;
      inactive += 1;
    }
  }
  console.log(
    `${f.$id}\n  name=${f.name}\n  runtime=${f.runtime}\n  enabled=${f.enabled}\n  deployment=${depId} status=${depStatus}\n`,
  );
}

console.log(inactive ? `⚠ ${inactive} function(s) not ready yet — wait or open Deployments → Logs` : "✓ All listed deployments look ready");
console.log(
  "\nConsole: https://cloud.appwrite.io/console/project-fra-" +
    PROJECT +
    "/functions",
);
