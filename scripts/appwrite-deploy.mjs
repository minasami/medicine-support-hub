#!/usr/bin/env node
/**
 * Appwrite deployment automation (Sites + Functions).
 *
 * Env:
 *   APPWRITE_ENDPOINT     default https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID   required
 *   APPWRITE_API_KEY      required
 *   APPWRITE_SITE_ID      required for --site
 *   APPWRITE_SITE_BRANCH  default main
 *
 * Usage:
 *   node scripts/appwrite-deploy.mjs --site
 *   node scripts/appwrite-deploy.mjs --functions
 *   node scripts/appwrite-deploy.mjs --all
 *   node scripts/appwrite-deploy.mjs --list-sites
 *   node scripts/appwrite-deploy.mjs --list-functions
 */

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const KEY = process.env.APPWRITE_API_KEY || "";
const SITE_ID = process.env.APPWRITE_SITE_ID || "";
const BRANCH = process.env.APPWRITE_SITE_BRANCH || "main";

const args = new Set(process.argv.slice(2));

function requireAuth() {
  if (!PROJECT || !KEY) {
    console.error("APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required");
    process.exit(1);
  }
}

async function appwrite(path, opts = {}) {
  const url = `${ENDPOINT}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": KEY,
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.message || data.raw || res.statusText;
    const err = new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function listSites() {
  const data = await appwrite("/sites?queries[]=${limit}&queries[]=${limitVal}"
    .replace("${limit}", encodeURIComponent('limit(25)'))
    .replace("${limitVal}", ""));
  // fallback simple
  let sites = data.sites || data.documents || [];
  if (!sites.length) {
    const d2 = await appwrite("/sites");
    sites = d2.sites || [];
  }
  return sites;
}

async function listSitesSimple() {
  const data = await appwrite("/sites");
  return data.sites || [];
}

async function listFunctions() {
  const data = await appwrite("/functions");
  return data.functions || [];
}

/**
 * Trigger a Site rebuild from the connected Git branch (VCS deployment).
 * Requires the Site to be connected to GitHub in Appwrite Console.
 * API: POST /sites/{siteId}/deployments/vcs
 */
async function deploySiteVcs() {
  if (!SITE_ID) {
    console.error(
      "APPWRITE_SITE_ID is required for --site.\n" +
        "Find it: Console → Sites → your site → Settings (Site ID).\n" +
        "Or run: node scripts/appwrite-deploy.mjs --list-sites",
    );
    process.exit(1);
  }

  console.log(`Triggering VCS deployment for site=${SITE_ID} branch=${BRANCH}…`);

  // Appwrite expects form or JSON depending on version — try JSON body first
  const body = {
    type: "branch",
    reference: BRANCH,
    activate: true,
  };

  try {
    const result = await appwrite(`/sites/${SITE_ID}/deployments/vcs`, {
      method: "POST",
      body,
    });
    console.log("Site VCS deployment accepted:");
    console.log(
      JSON.stringify(
        {
          $id: result.$id,
          status: result.status,
          type: result.type,
          activate: true,
          branch: BRANCH,
        },
        null,
        2,
      ),
    );
    return result;
  } catch (e) {
    // Some gateways want x-www-form-urlencoded
    if (e.status === 400 || e.status === 415) {
      console.warn("JSON body rejected, retrying as form…");
      const url = `${ENDPOINT}/sites/${SITE_ID}/deployments/vcs`;
      const form = new URLSearchParams();
      form.set("type", "branch");
      form.set("reference", BRANCH);
      form.set("activate", "true");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Appwrite-Project": PROJECT,
          "X-Appwrite-Key": KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          `VCS deploy failed ${res.status}: ${data.message || res.statusText}`,
        );
      }
      console.log("Site VCS deployment accepted (form):", data.$id || data);
      return data;
    }
    throw e;
  }
}

async function printSites() {
  const sites = await listSitesSimple();
  if (!sites.length) {
    console.log("No sites found.");
    return;
  }
  console.log("Sites:");
  for (const s of sites) {
    console.log(
      `  id=${s.$id}  name=${s.name || "?"}  branch=${s.providerBranch || s.provider_branch || "?"}`,
    );
  }
  console.log("\nSet APPWRITE_SITE_ID to the id you want CD to redeploy.");
}

async function printFunctions() {
  const fns = await listFunctions();
  if (!fns.length) {
    console.log("No functions found.");
    return;
  }
  console.log("Functions:");
  for (const f of fns) {
    console.log(`  id=${f.$id}  name=${f.name || "?"}  runtime=${f.runtime || "?"}`);
  }
}

async function main() {
  if (args.has("--help") || args.size === 0) {
    console.log(`Appwrite deploy automation

  --list-sites       List site IDs
  --list-functions   List function IDs
  --site             Trigger Site VCS deploy (needs APPWRITE_SITE_ID)
  --functions        Print note: use Appwrite CLI push / Console for code upload
  --all              --site + --functions note
`);
    process.exit(args.has("--help") ? 0 : 1);
  }

  requireAuth();

  if (args.has("--list-sites")) {
    await printSites();
  }
  if (args.has("--list-functions")) {
    await printFunctions();
  }
  if (args.has("--site") || args.has("--all")) {
    await deploySiteVcs();
  }
  if (args.has("--functions") || args.has("--all")) {
    console.log(
      "Functions: code deployments need CLI package upload.\n" +
        "  npm i -g appwrite-cli && appwrite login\n" +
        "  appwrite push functions\n" +
        "Or rely on Git-connected functions if configured.\n" +
        "This script lists functions with --list-functions.",
    );
    await printFunctions();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
