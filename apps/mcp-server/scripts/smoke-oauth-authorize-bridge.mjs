#!/usr/bin/env node
/**
 * Smoke-check OAuth authorize → login bridge Location keeps a trailing slash
 * BEFORE the ?ticket= query (Appwrite Sites 301 /mcp-oauth → /mcp-oauth/ drops QS).
 *
 * Usage:
 *   node apps/mcp-server/scripts/smoke-oauth-authorize-bridge.mjs
 *   MCP_BASE=https://mcp.medicinesupport.app node apps/mcp-server/scripts/smoke-oauth-authorize-bridge.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const BASE = (process.env.MCP_BASE || "https://mcp.medicinesupport.app").replace(/\/+$/, "");
const REDIRECT_URI = process.env.SMOKE_REDIRECT_URI || "http://127.0.0.1:9876/callback";

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function main() {
  const regRes = await fetch(`${BASE}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "smoke-oauth-authorize-bridge",
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  const regText = await regRes.text();
  let reg;
  try {
    reg = JSON.parse(regText);
  } catch {
    fail(`DCR non-JSON HTTP ${regRes.status}: ${regText.slice(0, 200)}`);
    return;
  }
  if (regRes.status !== 201 || !reg.client_id) {
    fail(`DCR HTTP ${regRes.status}: ${regText.slice(0, 300)}`);
    return;
  }
  ok(`DCR client_id=${String(reg.client_id).slice(0, 24)}…`);

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const qs = new URLSearchParams({
    response_type: "code",
    client_id: reg.client_id,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "smoke-bridge",
    scope: "msh:user",
  });

  const authRes = await fetch(`${BASE}/oauth/authorize?${qs}`, { redirect: "manual" });
  const loc = authRes.headers.get("location") || "";
  if (authRes.status !== 302) {
    fail(`authorize HTTP ${authRes.status} (expected 302), Location=${loc.slice(0, 120)}`);
    return;
  }

  // Mandatory: slash immediately before ?ticket=
  if (!/\/mcp-oauth\/\?ticket=/.test(loc)) {
    fail(`authorize Location must contain /mcp-oauth/?ticket= (slash before ?); got: ${loc.slice(0, 180)}`);
    return;
  }
  ok(`authorize Location has /mcp-oauth/?ticket=`);

  let ticket = "";
  try {
    ticket = new URL(loc).searchParams.get("ticket") || "";
  } catch {
    fail(`authorize Location is not a valid URL: ${loc.slice(0, 180)}`);
    return;
  }
  if (!ticket || ticket.length < 40) {
    fail(`ticket missing or too short (${ticket.length})`);
    return;
  }
  if (ticket.length >= 500) {
    fail(`ticket too long (${ticket.length}); compact tickets must be << 500 chars`);
    return;
  }
  ok(`ticket length=${ticket.length} (< 500)`);

  // POST complete without JWT → appwrite_auth_failed (proves ticket verifies)
  const postNoJwt = await fetch(`${BASE}/oauth/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ ticket }),
  });
  const postNoJwtText = await postNoJwt.text();
  let postNoJwtJson = null;
  try {
    postNoJwtJson = JSON.parse(postNoJwtText);
  } catch { /* plain */ }
  if (postNoJwt.status !== 401) {
    fail(`POST complete without jwt expected 401, got ${postNoJwt.status}: ${postNoJwtText.slice(0, 200)}`);
    return;
  }
  const noJwtErr = postNoJwtJson?.error || postNoJwtText;
  if (!String(noJwtErr).includes("appwrite_auth_failed")) {
    fail(`POST complete without jwt expected appwrite_auth_failed, got: ${String(noJwtErr).slice(0, 200)}`);
    return;
  }
  ok(`POST complete without jwt → 401 appwrite_auth_failed`);

  // Truncated ticket → invalid_ticket
  const trunc = ticket.slice(0, Math.max(10, Math.floor(ticket.length / 3)));
  const postTrunc = await fetch(`${BASE}/oauth/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ ticket: trunc }),
  });
  const truncText = await postTrunc.text();
  let truncJson = null;
  try {
    truncJson = JSON.parse(truncText);
  } catch { /* plain */ }
  if (postTrunc.status !== 400) {
    fail(`truncated ticket expected 400, got ${postTrunc.status}: ${truncText.slice(0, 200)}`);
    return;
  }
  const truncErr = truncJson?.error || truncText;
  if (!String(truncErr).includes("invalid_ticket")) {
    fail(`truncated ticket expected invalid_ticket, got: ${String(truncErr).slice(0, 200)}`);
    return;
  }
  ok(`truncated ticket → 400 invalid_ticket`);

  // Optional follow: Appwrite Sites must not strip ticket when slash is already present
  if (process.env.SMOKE_FOLLOW_BRIDGE !== "0") {
    let cur = loc;
    let finalUrl = loc;
    for (let i = 0; i < 6; i++) {
      const r = await fetch(cur, { redirect: "manual", headers: { Accept: "text/html" } });
      const next = r.headers.get("location");
      if (!next || (r.status !== 301 && r.status !== 302 && r.status !== 307 && r.status !== 308)) {
        finalUrl = cur;
        ok(`bridge hop ${i}: HTTP ${r.status} at ${cur.split("?")[0]} has_ticket=${cur.includes("ticket=")}`);
        break;
      }
      const abs = new URL(next, cur).toString();
      ok(`bridge hop ${i}: ${r.status} → ${abs.split("?")[0]} has_ticket=${abs.includes("ticket=")}`);
      cur = abs;
      finalUrl = abs;
    }
    if (!finalUrl.includes("ticket=")) {
      fail(`after redirects, final URL lost ticket=: ${finalUrl}`);
      return;
    }
    ok(`final bridge URL preserves ticket=`);
  }
}

await main();
if (process.exitCode) {
  console.error(`\nSmoke failed against ${BASE}`);
  process.exit(1);
}
console.log(`\nSmoke passed against ${BASE}`);
