#!/usr/bin/env node
/**
 * Deploy Appwrite Functions from this repo using the REST API.
 *
 * Packages each functions/<id> directory as tar.gz and POSTs:
 *   POST /v1/functions/{functionId}/deployments
 *
 * Env (required):
 *   APPWRITE_ENDPOINT   e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY    API key with functions.write
 *
 * Usage:
 *   node scripts/deploy-appwrite-functions.mjs
 *   node scripts/deploy-appwrite-functions.mjs --only adaptive-signal-aggregator
 *   node scripts/deploy-appwrite-functions.mjs --dry-run
 *   node scripts/deploy-appwrite-functions.mjs --ensure   # create missing functions from appwrite.json
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
const ensure = args.includes("--ensure");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

if (!PROJECT || !KEY) {
  console.error("APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required");
  process.exit(1);
}

function loadManifest() {
  const raw = JSON.parse(fs.readFileSync(APPWRITE_JSON, "utf8"));
  const list = Array.isArray(raw.functions) ? raw.functions : [];
  // Also discover unlisted dirs under functions/
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

async function functionExists(id) {
  try {
    await api(`/functions/${id}`);
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

async function ensureFunction(fn) {
  const exists = await functionExists(fn.$id);
  if (exists) {
    console.log(`  ✓ function exists: ${fn.$id}`);
    return;
  }
  if (dryRun) {
    console.log(`  [dry-run] would create function ${fn.$id}`);
    return;
  }
  console.log(`  + creating function ${fn.$id}…`);
  // Appwrite create function body (Cloud)
  await api("/functions", {
    method: "POST",
    body: {
      functionId: fn.$id,
      name: fn.name,
      runtime: fn.runtime,
      execute: fn.execute,
      events: fn.events,
      schedule: fn.schedule || "",
      timeout: fn.timeout,
      enabled: fn.enabled,
      logging: true,
      entrypoint: fn.entrypoint,
      commands: fn.commands,
    },
  });
  console.log(`  ✓ created ${fn.$id}`);
}

function packageCode(absDir) {
  if (!fs.existsSync(absDir)) {
    throw new Error(`Missing function directory: ${absDir}`);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aw-fn-"));
  const tarPath = path.join(tmp, "code.tar.gz");
  // Portable tar: contents of the function folder at archive root
  execFileSync(
    "tar",
    ["-czf", tarPath, "-C", absDir, "."],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const buf = fs.readFileSync(tarPath);
  return { tarPath, buf, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

async function deployFunction(fn) {
  const absDir = path.join(ROOT, fn.path);
  console.log(`\n→ ${fn.$id}  (${fn.path})`);

  if (ensure || !(await functionExists(fn.$id))) {
    await ensureFunction(fn);
  }

  const { buf, cleanup } = packageCode(absDir);
  try {
    if (dryRun) {
      console.log(`  [dry-run] would upload ${buf.length} bytes tar.gz, activate=true`);
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
  const functions = loadManifest();
  if (!functions.length) {
    console.error("No functions found in appwrite.json or functions/");
    process.exit(1);
  }

  console.log(
    `Appwrite Functions deploy\n  endpoint=${ENDPOINT}\n  project=${PROJECT}\n  count=${functions.length}${dryRun ? "  (dry-run)" : ""}`,
  );

  const results = [];
  for (const fn of functions) {
    try {
      const r = await deployFunction(fn);
      results.push({ id: fn.$id, ...r });
    } catch (e) {
      console.error(`  ✗ ${fn.$id}: ${e.message}`);
      results.push({ id: fn.$id, ok: false, error: e.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n———");
  console.log(
    `done: ok=${results.length - failed.length} failed=${failed.length}`,
  );
  if (failed.length) {
    for (const f of failed) console.log(`  fail ${f.id}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
