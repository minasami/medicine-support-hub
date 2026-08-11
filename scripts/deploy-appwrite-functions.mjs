#!/usr/bin/env node
/**
 * Deploy Appwrite Functions from this repo (REST).
 *
 * Env:
 *   APPWRITE_ENDPOINT     default https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID   required (e.g. 6a54ac3a00272c02d6e0)
 *   APPWRITE_API_KEY      required — scopes: functions.read, functions.write
 *
 * Usage:
 *   node scripts/deploy-appwrite-functions.mjs --ensure
 *   node scripts/deploy-appwrite-functions.mjs --only edge-api --ensure
 *   node scripts/deploy-appwrite-functions.mjs --probe
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APPWRITE_JSON = path.join(ROOT, "appwrite.json");

const ENDPOINT = (process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1").replace(
  /\/$/,
  "",
);
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const KEY = process.env.APPWRITE_API_KEY || "";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ensure = args.includes("--ensure") || args.includes("--all");
const probeOnly = args.includes("--probe");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

if (!PROJECT || !KEY) {
  console.error(
    "Missing credentials.\n" +
      "  export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1\n" +
      "  export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0\n" +
      "  export APPWRITE_API_KEY=<API key with functions.read + functions.write>\n" +
      "  node scripts/deploy-appwrite-functions.mjs --ensure",
  );
  process.exit(1);
}

function loadManifest() {
  const raw = JSON.parse(fs.readFileSync(APPWRITE_JSON, "utf8"));
  const list = Array.isArray(raw.functions) ? raw.functions : [];
  const dir = path.join(ROOT, "functions");
  const discovered = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const byId = new Map();
  for (const f of list) {
    byId.set(f.$id, {
      $id: f.$id,
      name: f.name || f.$id,
      runtime: f.runtime || "node-18.0",
      entrypoint: f.entrypoint || "src/main.js",
      execute: f.execute || ["users"],
      timeout: f.timeout || 60,
      enabled: f.enabled !== false,
      path: f.path || `functions/${f.$id}`,
      schedule: f.schedule || "",
      events: f.events || [],
      commands: f.commands || "npm install",
    });
  }
  for (const id of discovered) {
    if (!byId.has(id)) {
      byId.set(id, {
        $id: id,
        name: id,
        runtime: "node-18.0",
        entrypoint: "src/main.js",
        execute: ["users"],
        timeout: 60,
        enabled: true,
        path: `functions/${id}`,
        schedule: "",
        events: [],
        commands: "npm install",
      });
    }
  }
  let out = [...byId.values()];
  if (only) out = out.filter((f) => f.$id === only);
  return out;
}

async function api(pathname, { method = "GET", body, formData } = {}) {
  const headers = {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": KEY,
  };
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${ENDPOINT}${pathname}`, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `${method} ${pathname} → ${res.status}: ${data.message || data.raw || res.statusText}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function probe() {
  console.log(`Probe ${ENDPOINT} project=${PROJECT}`);
  try {
    const list = await api("/functions");
    const fns = list.functions || [];
    console.log(`✓ Auth OK — ${fns.length} function(s) in project`);
    for (const f of fns) {
      console.log(`  - ${f.$id}  (${f.name})  runtime=${f.runtime}`);
    }
    return fns;
  } catch (e) {
    console.error(`✗ Auth/list failed: ${e.message}`);
    if (e.status === 401 || e.status === 403) {
      console.error(
        "  → Create an API key in Console → Overview → API keys\n" +
          "  → Enable scopes: functions.read, functions.write (or full access)\n" +
          "  → Use PROJECT ID from Settings (6a54ac3a00272c02d6e0), not the name",
      );
    }
    throw e;
  }
}

async function pickNodeRuntime(preferred) {
  try {
    const data = await api("/functions/runtimes");
    const runtimes = (data.runtimes || []).map((r) => r.$id || r.name).filter(Boolean);
    if (!runtimes.length) return preferred || "node-18.0";
    console.log(`Available runtimes (sample): ${runtimes.filter((r) => /node/i.test(r)).join(", ")}`);
    const order = [
      preferred,
      "node-22.0",
      "node-21.0",
      "node-20.0",
      "node-19.0",
      "node-18.0",
      "node-16.0",
    ].filter(Boolean);
    for (const id of order) {
      if (runtimes.includes(id)) return id;
    }
    const anyNode = runtimes.find((r) => /^node/i.test(r));
    return anyNode || preferred || "node-18.0";
  } catch (e) {
    console.warn(`Could not list runtimes (${e.message}); using ${preferred || "node-18.0"}`);
    return preferred || "node-18.0";
  }
}

async function functionExists(id) {
  try {
    await api(`/functions/${id}`);
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

async function ensureFunction(fn, runtime) {
  const exists = await functionExists(fn.$id);
  if (exists) {
    console.log(`  ✓ function exists: ${fn.$id}`);
    return;
  }
  if (dryRun) {
    console.log(`  [dry-run] would create function ${fn.$id} runtime=${runtime}`);
    return;
  }

  const candidates = [runtime, "node-22.0", "node-21.0", "node-20.0", "node-18.0"];
  const tried = new Set();
  let lastErr;

  for (const rt of candidates) {
    if (!rt || tried.has(rt)) continue;
    tried.add(rt);
    console.log(`  + creating function ${fn.$id} (runtime=${rt})…`);
    try {
      await api("/functions", {
        method: "POST",
        body: {
          functionId: fn.$id,
          name: fn.name,
          runtime: rt,
          execute: fn.execute,
          events: fn.events || [],
          schedule: fn.schedule || "",
          timeout: fn.timeout || 60,
          enabled: true,
          logging: true,
          entrypoint: fn.entrypoint || "src/main.js",
          commands: fn.commands || "npm install",
        },
      });
      console.log(`  ✓ created ${fn.$id}`);
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`    create failed with ${rt}: ${e.message}`);
    }
  }
  throw lastErr || new Error(`Could not create function ${fn.$id}`);
}

function packageCode(absDir) {
  if (!fs.existsSync(absDir)) {
    throw new Error(`Missing function directory: ${absDir}`);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aw-fn-"));
  const tarPath = path.join(tmp, "code.tar.gz");
  execFileSync("tar", ["-czf", tarPath, "-C", absDir, "."], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const buf = fs.readFileSync(tarPath);
  return { buf, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

async function deployFunction(fn, runtime) {
  const absDir = path.join(ROOT, fn.path);
  console.log(`\n→ ${fn.$id}  (${fn.path})`);

  if (ensure || !(await functionExists(fn.$id))) {
    await ensureFunction(fn, runtime);
  }

  if (!(await functionExists(fn.$id))) {
    throw new Error(
      `Function ${fn.$id} still missing after create — check API key scopes and runtime`,
    );
  }

  const { buf, cleanup } = packageCode(absDir);
  try {
    if (dryRun) {
      console.log(`  [dry-run] would upload ${buf.length} bytes tar.gz`);
      return { ok: true, dryRun: true };
    }

    const form = new FormData();
    form.append(
      "code",
      new Blob([buf], { type: "application/gzip" }),
      "code.tar.gz",
    );
    form.append("activate", "true");
    form.append("entrypoint", fn.entrypoint || "src/main.js");
    if (fn.commands) form.append("commands", fn.commands);

    const result = await api(`/functions/${fn.$id}/deployments`, {
      method: "POST",
      formData: form,
    });

    console.log(
      `  ✓ deployment ${result.$id || "ok"}  status=${result.status || "accepted"}`,
    );
    return { ok: true, id: result.$id, status: result.status };
  } finally {
    cleanup();
  }
}

async function main() {
  console.log(
    `Appwrite Functions deploy\n  endpoint=${ENDPOINT}\n  project=${PROJECT}`,
  );

  await probe();
  if (probeOnly) process.exit(0);

  const functions = loadManifest();
  if (!functions.length) {
    console.error("No functions found");
    process.exit(1);
  }

  const runtime = await pickNodeRuntime(functions[0]?.runtime || "node-18.0");
  console.log(`Using runtime: ${runtime}\nDeploying ${functions.length} function(s)…`);

  const results = [];
  for (const fn of functions) {
    try {
      const r = await deployFunction(fn, runtime);
      results.push({ id: fn.$id, ...r });
    } catch (e) {
      console.error(`  ✗ ${fn.$id}: ${e.message}`);
      results.push({ id: fn.$id, ok: false, error: e.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n———");
  console.log(`done: ok=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  fail ${f.id}: ${f.error}`);
    console.log(
      "\nIf the list is still empty, create one function manually in Console:\n" +
        "  Functions → Create function → Node.js → Function ID: edge-api\n" +
        "Then re-run: node scripts/deploy-appwrite-functions.mjs --only edge-api --ensure",
    );
    process.exit(1);
  }

  console.log(
    "\nRefresh Console:\n" +
      "https://cloud.appwrite.io/console/project-fra-6a54ac3a00272c02d6e0/functions",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
