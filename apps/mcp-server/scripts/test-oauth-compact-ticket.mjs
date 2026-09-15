#!/usr/bin/env node
/**
 * Offline unit: compact OAuth tickets use cid_hash and stay << 500 chars.
 */
process.env.MCP_OAUTH_SIGNING_SECRET =
  process.env.MCP_OAUTH_SIGNING_SECRET || "test-signing-secret-32chars-min!!";

import {
  handleDynamicClientRegistration,
  beginAuthorize,
  completeAuthorize,
  clientIdHash,
  verifyJwt,
  expandTicketPayload,
} from "../src/oauth.mjs";
import { createHash, randomBytes } from "node:crypto";

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

const reg = await handleDynamicClientRegistration({
  client_name: "unit-compact-ticket",
  redirect_uris: ["http://127.0.0.1:9876/callback"],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
});
if (reg.status !== 201 || !reg.json?.client_id) {
  fail(`DCR failed: ${JSON.stringify(reg)}`);
  process.exit(1);
}
const client_id = reg.json.client_id;
ok(`DCR client_id length=${client_id.length}`);

const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const auth = await beginAuthorize({
  response_type: "code",
  client_id,
  redirect_uri: "http://127.0.0.1:9876/callback",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state: "unit",
  scope: "msh:user",
});
if (auth.status !== 302 || !auth.location) {
  fail(`beginAuthorize: ${JSON.stringify(auth)}`);
  process.exit(1);
}
const ticket = new URL(auth.location).searchParams.get("ticket") || "";
if (ticket.length >= 500) {
  fail(`ticket length ${ticket.length} >= 500`);
} else {
  ok(`ticket length=${ticket.length} (< 500)`);
}

const raw = verifyJwt(ticket, { typ: "oauth-ticket" });
const payload = expandTicketPayload(raw);
if (!raw?.h) {
  fail(`raw ticket should use compact key h=, got ${JSON.stringify(raw)}`);
} else if (!payload?.cid_hash) {
  fail(`expand failed: ${JSON.stringify(raw)}`);
} else if (payload.cid_hash !== clientIdHash(client_id)) {
  fail(`cid_hash mismatch`);
} else if (raw.client_id) {
  fail(`ticket still embeds client_id`);
} else {
  ok(`cid_hash=${payload.cid_hash} (compact h=)`);
}

const noJwt = await completeAuthorize({ ticket, appwrite_jwt: "" });
if (noJwt.status !== 401 || noJwt.text !== "appwrite_auth_failed") {
  fail(`expected appwrite_auth_failed, got ${JSON.stringify(noJwt)}`);
} else {
  ok(`complete without jwt → appwrite_auth_failed`);
}

const bad = await completeAuthorize({ ticket: ticket.slice(0, 40), appwrite_jwt: "x" });
if (bad.status !== 400 || bad.text !== "invalid_ticket") {
  fail(`expected invalid_ticket, got ${JSON.stringify(bad)}`);
} else {
  ok(`truncated ticket → invalid_ticket`);
}

// Longer ChatGPT-like state still under 500 when possible
const longState = "st_" + "x".repeat(80);
const authLong = await beginAuthorize({
  response_type: "code",
  client_id,
  redirect_uri: "http://127.0.0.1:9876/callback",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state: longState,
  scope: "msh:user",
});
if (authLong.status !== 302 || !authLong.location) {
  fail(`long-state beginAuthorize: ${JSON.stringify(authLong)}`);
  process.exit(1);
}
const tLong = new URL(authLong.location).searchParams.get("ticket") || "";
if (tLong.length >= 500) {
  fail(`long-state ticket length ${tLong.length} >= 500`);
} else {
  ok(`long-state ticket length=${tLong.length} (< 500)`);
}

if (process.exitCode) {
  console.error("\nCompact ticket unit failed");
  process.exit(1);
}
console.log("\nCompact ticket unit passed");
