#!/usr/bin/env node
/**
 * Smoke-check OAuth well-known metadata + health version.
 *
 * Usage:
 *   node apps/mcp-server/scripts/smoke-oauth-wellknown.mjs
 *   MCP_BASE=https://mcp.medicinesupport.app node apps/mcp-server/scripts/smoke-oauth-wellknown.mjs
 *   EXPECT_VERSION=0.3.3 node apps/mcp-server/scripts/smoke-oauth-wellknown.mjs
 */
const BASE = (process.env.MCP_BASE || "https://mcp.medicinesupport.app").replace(/\/+$/, "");
const EXPECT_VERSION = process.env.EXPECT_VERSION || "0.3.3";

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep null */
  }
  return { status: res.status, json, text: text.slice(0, 500) };
}

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

const as = await getJson("/.well-known/oauth-authorization-server");
if (as.status !== 200 || !as.json) {
  fail(`AS metadata HTTP ${as.status}: ${as.text}`);
} else {
  const need = ["issuer", "authorization_endpoint", "token_endpoint"];
  const missing = need.filter((k) => !as.json[k]);
  if (missing.length || as.json.ok === true || as.json.service) {
    fail(
      `AS metadata missing ${missing.join(", ") || "fields"} or looks like health/discovery: ${JSON.stringify(as.json).slice(0, 200)}`,
    );
  } else {
    ok(`AS metadata issuer=${as.json.issuer}`);
  }
}

const prm = await getJson("/.well-known/oauth-protected-resource");
if (prm.status !== 200 || !prm.json) {
  fail(`PRM HTTP ${prm.status}: ${prm.text}`);
} else {
  const need = ["resource", "authorization_servers"];
  const missing = need.filter((k) => !prm.json[k]);
  if (missing.length || prm.json.ok === true || prm.json.service) {
    fail(
      `PRM missing ${missing.join(", ") || "fields"} or looks like health/discovery: ${JSON.stringify(prm.json).slice(0, 200)}`,
    );
  } else {
    ok(`PRM resource=${prm.json.resource}`);
  }
}

const health = await getJson("/health");
if (health.status !== 200 || !health.json?.version) {
  fail(`health HTTP ${health.status}: ${health.text}`);
} else if (health.json.version !== EXPECT_VERSION) {
  fail(`health version=${health.json.version} expected=${EXPECT_VERSION}`);
} else {
  ok(`health version=${health.json.version}`);
}

if (process.exitCode) {
  console.error(`\nSmoke failed against ${BASE}`);
  process.exit(1);
}
console.log(`\nSmoke passed against ${BASE}`);
