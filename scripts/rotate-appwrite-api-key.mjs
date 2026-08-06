#!/usr/bin/env node
/**
 * Appwrite API key rotation helper (Keys API).
 *
 * Appwrite Cloud supports programmatic key create/list/delete via Project service
 * when the caller key has keys.read + keys.write scopes.
 *
 * Safe workflow:
 *   1. Create a one-time MANAGEMENT key in Console with scopes:
 *        keys.read, keys.write  (plus databases.* if you also use it for data)
 *   2. export APPWRITE_MANAGEMENT_KEY=...
 *   3. node scripts/rotate-appwrite-api-key.mjs --create
 *   4. Copy the printed secret into APPWRITE_API_KEY / CI secrets
 *   5. Verify data scripts work
 *   6. node scripts/rotate-appwrite-api-key.mjs --delete <oldKeyId>
 *
 * Never commit secrets. The secret is shown ONCE at create time.
 *
 * Env:
 *   APPWRITE_ENDPOINT (default https://fra.cloud.appwrite.io/v1)
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_MANAGEMENT_KEY  — key with keys.read + keys.write
 *
 * Flags:
 *   --list                 List existing keys (id, name, scopes, expire)
 *   --create               Create a new data key
 *   --name <label>         Name for new key (default: data-enrich-YYYY-MM-DD)
 *   --expire <ISO|days>    Optional expiry (e.g. 2027-01-01 or 90 for +90 days)
 *   --delete <keyId>       Delete a key by id (after new key is verified)
 *   --scopes <csv>         Override scopes (default: databases read/write + documents)
 *   --dry-run              Print planned actions only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const MGMT_KEY =
  process.env.APPWRITE_MANAGEMENT_KEY ||
  process.env.APPWRITE_KEYS_KEY ||
  "";

function argValue(flag, fallback = "") {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

const IS_LIST = hasFlag("--list");
const IS_CREATE = hasFlag("--create");
const DELETE_ID = argValue("--delete");
const KEY_NAME =
  argValue("--name") ||
  `data-enrich-${new Date().toISOString().slice(0, 10)}`;
const EXPIRE_RAW = argValue("--expire");
const IS_DRY = hasFlag("--dry-run");
const SCOPES_CSV = argValue("--scopes");

const DEFAULT_SCOPES = [
  "databases.read",
  "databases.write",
  "collections.read",
  "collections.write",
  "documents.read",
  "documents.write",
  "attributes.read",
  "indexes.read",
];

function resolveScopes() {
  if (SCOPES_CSV) return SCOPES_CSV.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_SCOPES;
}

function resolveExpire() {
  if (!EXPIRE_RAW) return null;
  if (/^\d+$/.test(EXPIRE_RAW)) {
    const d = new Date();
    d.setDate(d.getDate() + Number(EXPIRE_RAW));
    return d.toISOString();
  }
  return EXPIRE_RAW;
}

async function api(method, pathSuffix, body) {
  if (!MGMT_KEY) {
    throw new Error(
      "APPWRITE_MANAGEMENT_KEY required (Console key with keys.read + keys.write).",
    );
  }
  const url = `${ENDPOINT}/project${pathSuffix}`;
  const headers = {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": MGMT_KEY,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

function printManualFallback() {
  console.log(`
[rotate] Automated rotation needs APPWRITE_MANAGEMENT_KEY with scopes keys.read + keys.write.

Manual rotation (Console):
  1. Open https://cloud.appwrite.io → project ${PROJECT}
  2. Overview → Integration → API keys → Create API key
  3. Name: ${KEY_NAME}
  4. Scopes: databases.read, databases.write, documents.read, documents.write
  5. Copy the secret once → set APPWRITE_API_KEY in your shell / CI
  6. Verify: node scripts/export-appwrite-medicines.mjs  (or any read script)
  7. Delete the OLD exposed key in Console

After creating a management key:
  $env:APPWRITE_MANAGEMENT_KEY="<mgmt_key_with_keys_write>"
  node scripts/rotate-appwrite-api-key.mjs --list
  node scripts/rotate-appwrite-api-key.mjs --create --expire 90
  node scripts/rotate-appwrite-api-key.mjs --delete <oldKeyId>
`);
}

async function listKeys() {
  const result = await api("GET", "/keys");
  const keys = result?.keys || result || [];
  const arr = Array.isArray(keys) ? keys : keys.keys || [];
  console.log(`[rotate] ${arr.length} key(s) in project ${PROJECT}`);
  for (const k of arr) {
    console.log(
      JSON.stringify(
        {
          $id: k.$id || k.id,
          name: k.name,
          expire: k.expire,
          scopes: k.scopes,
          accessedAt: k.accessedAt,
        },
        null,
        2,
      ),
    );
  }
  return arr;
}

async function createKey() {
  const scopes = resolveScopes();
  const expire = resolveExpire();
  const keyId = `key_${Date.now().toString(36)}`;
  const body = {
    keyId,
    name: KEY_NAME,
    scopes,
  };
  if (expire) body.expire = expire;

  if (IS_DRY) {
    console.log("[rotate] DRY-RUN create", body);
    return null;
  }

  const result = await api("POST", "/keys", body);
  console.log("\n========== NEW API KEY (copy now — shown once) ==========");
  console.log(result.secret || result.key || JSON.stringify(result, null, 2));
  console.log("=========================================================\n");
  console.log(
    JSON.stringify(
      {
        $id: result.$id || result.id || keyId,
        name: result.name || KEY_NAME,
        expire: result.expire || expire,
        scopes: result.scopes || scopes,
      },
      null,
      2,
    ),
  );
  console.log(`
Next:
  $env:APPWRITE_API_KEY="<paste secret above>"
  node scripts/export-appwrite-medicines.mjs   # smoke test
  # After verified:
  node scripts/rotate-appwrite-api-key.mjs --delete <oldKeyId>
`);
  return result;
}

async function deleteKey(id) {
  if (!id) throw new Error("--delete requires key id");
  if (IS_DRY) {
    console.log("[rotate] DRY-RUN delete", id);
    return;
  }
  await api("DELETE", `/keys/${encodeURIComponent(id)}`);
  console.log(`[rotate] Deleted key ${id}`);
}

async function main() {
  console.log(`[rotate] endpoint=${ENDPOINT} project=${PROJECT}`);

  if (!IS_LIST && !IS_CREATE && !DELETE_ID) {
    printManualFallback();
    process.exit(0);
  }

  if (!MGMT_KEY) {
    printManualFallback();
    process.exit(1);
  }

  if (IS_LIST) await listKeys();
  if (IS_CREATE) await createKey();
  if (DELETE_ID) await deleteKey(DELETE_ID);
}

main().catch((err) => {
  console.error("[rotate] ERROR:", err.message || err);
  if (String(err.message || "").includes("404") || String(err.message || "").includes("401")) {
    console.error(
      "Keys API may be unavailable or management key lacks keys.read/keys.write. Use Console rotation steps above.",
    );
  }
  process.exit(1);
});
