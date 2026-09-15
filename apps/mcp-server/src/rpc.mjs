import { randomUUID } from "node:crypto";
import { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool } from "./tools.mjs";
import {
  protectedResourceMetadata,
  authorizationServerMetadata,
  beginAuthorize,
  completeAuthorize,
  handleTokenRequest,
  handleDynamicClientRegistration,
  wwwAuthenticateChallenge,
  oauthConfigured,
  getPublicBase,
} from "./oauth.mjs";
import { authContextFromRequest } from "./auth-context.mjs";

const CORS = process.env.CORS_ORIGIN || "*";
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const buckets = new Map();
const sseSessions = new Map();

export const PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05"];
export { SERVER_INFO, INSTRUCTIONS, TOOLS };

export async function handleRpc(body, auth = null) {
  if (Array.isArray(body)) return Promise.all(body.map((m) => handleRpc(m, auth)));
  const { id, method, params } = body || {};
  const isNote = id === undefined || id === null;
  try {
    if (method === "initialize") {
      const requested = params?.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : "2025-03-26";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false }, logging: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    if (method === "notifications/initialized" || method === "initialized") {
      return isNote ? null : { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      return { jsonrpc: "2.0", id, result: await callTool(params?.name, params?.arguments || {}, auth) };
    }
    if (isNote) return null;
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err) {
    if (isNote) return null;
    return { jsonrpc: "2.0", id, error: { code: err.code || -32000, message: err.message || "Tool failed" } };
  }
}

function rateOk(ip) {
  const slot = Math.floor(Date.now() / 60000);
  const key = `${ip}:${slot}`;
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 5000) buckets.clear();
  return n <= RATE;
}

function corsHeaders(extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": CORS,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    ...extra,
  };
}

function sseHeaders(sessionId) {
  return corsHeaders({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Mcp-Session-Id": sessionId,
    "X-Accel-Buffering": "no",
  });
}

function wantsSse(req) {
  return String(req.headers.accept || "").toLowerCase().includes("text/event-stream");
}

function writeSse(res, data, event = "message") {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body) {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.reject(new Error("parse")); }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("parse")); }
    });
    req.on("error", reject);
  });
}

function sessionIdFrom(req, url) {
  return (
    req.headers["mcp-session-id"] ||
    url.searchParams.get("sessionId") ||
    randomUUID()
  ).toString();
}

/**
 * Resolve the logical request path after Vercel rewrites.
 * On Vercel, req.url inside a rewritten /api handler often becomes "/api" or "/",
 * so well-known and /oauth routes must recover the original path from headers,
 * query __path, or /api/oauth/… destinations.
 */
export function requestPath(req) {
  const headers = req?.headers || {};
  const headerCandidates = [
    headers["x-forwarded-uri"],
    headers["x-original-uri"],
    headers["x-invoke-path"],
    headers["x-matched-path"],
    headers["x-vercel-original-url"],
  ];

  let urlPath = "/";
  let queryPath = null;
  try {
    const url = new URL(req?.url || "/", "http://localhost");
    urlPath = url.pathname || "/";
    queryPath = url.searchParams.get("__path");
  } catch {
    /* ignore */
  }

  const segs = req?.query?.path;
  if (segs != null) {
    const suffix = Array.isArray(segs) ? segs.filter(Boolean).join("/") : String(segs);
    if (suffix) headerCandidates.unshift(`/oauth/${suffix}`);
  }

  const candidates = [];
  if (queryPath) candidates.push(queryPath);
  candidates.push(...headerCandidates);
  // Prefer a concrete pathname over bare /api rewrite targets
  if (urlPath && urlPath !== "/" && urlPath !== "/api") candidates.push(urlPath);
  candidates.push(urlPath);

  const mapApiAlias = (p) => {
    if (p === "/api/oauth-protected-resource") return "/.well-known/oauth-protected-resource";
    if (p === "/api/oauth-authorization-server") return "/.well-known/oauth-authorization-server";
    if (p === "/api/openai-apps-challenge") return "/.well-known/openai-apps-challenge";
    if (p.startsWith("/api/oauth/") || p === "/api/oauth") return p.replace(/^\/api/, "") || "/oauth";
    return p;
  };

  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    let p = String(raw).trim();
    if (!p) continue;
    if (/^https?:\/\//i.test(p)) {
      try {
        p = new URL(p).pathname;
      } catch {
        continue;
      }
    }
    p = p.split("?")[0];
    if (!p.startsWith("/")) p = `/${p}`;
    p = p.replace(/\/+$/, "") || "/";
    // Skip Vercel filesystem pattern paths like /api/oauth/[...path]
    if (p.includes("[") || p.includes("]")) continue;
    p = mapApiAlias(p);
    // Skip collapsed rewrite targets — keep looking for a better candidate
    if (p === "/api" || p === "/") continue;
    return p;
  }

  return mapApiAlias(urlPath.replace(/\/+$/, "") || "/") || "/";
}

function bearerPresent(req) {
  const h = req?.headers?.authorization || "";
  return /^Bearer\s+\S+/i.test(String(h));
}

export async function handleHttp(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const method = req.method || "GET";
  const path = requestPath(req);

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }


  // —— OAuth 2.1 AS + Protected Resource Metadata ——
  if (
    path === "/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource/mcp" ||
    path === "/api/oauth-protected-resource" ||
    path.endsWith("/.well-known/oauth-protected-resource")
  ) {
    res.writeHead(200, corsHeaders({ "Cache-Control": "no-store" }));
    res.end(JSON.stringify(protectedResourceMetadata(req)));
    return;
  }
  if (
    path === "/.well-known/oauth-authorization-server" ||
    path === "/.well-known/openid-configuration" ||
    path === "/api/oauth-authorization-server" ||
    path.endsWith("/.well-known/oauth-authorization-server")
  ) {
    res.writeHead(200, corsHeaders({ "Cache-Control": "no-store" }));
    res.end(JSON.stringify(authorizationServerMetadata(req)));
    return;
  }

  if ((path === "/oauth/register" || path === "/api/oauth/register") && method === "POST") {
    let body;
    try { body = await readBody(req); } catch {
      res.writeHead(400, corsHeaders());
      res.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    try {
      const out = await handleDynamicClientRegistration(body);
      res.writeHead(out.status, corsHeaders());
      res.end(JSON.stringify(out.json));
    } catch (err) {
      res.writeHead(500, corsHeaders());
      res.end(JSON.stringify({ error: "server_error", error_description: err.message }));
    }
    return;
  }

  if ((path === "/oauth/authorize" || path === "/api/oauth/authorize") && method === "GET") {
    try {
      const out = await beginAuthorize(Object.fromEntries(url.searchParams.entries()));
      if (out.location) {
        res.writeHead(out.status || 302, { ...corsHeaders(), Location: out.location });
        res.end();
        return;
      }
      res.writeHead(out.status || 400, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end(out.text || "error");
    } catch (err) {
      res.writeHead(500, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end(err.message || "authorize failed");
    }
    return;
  }

  if ((path === "/oauth/complete" || path === "/api/oauth/complete") && (method === "GET" || method === "POST")) {
    let ticket = url.searchParams.get("ticket");
    let appwrite_jwt = url.searchParams.get("appwrite_jwt") || url.searchParams.get("jwt");
    if (method === "POST") {
      try {
        const body = await readBody(req);
        ticket = ticket || body.ticket;
        appwrite_jwt = appwrite_jwt || body.appwrite_jwt || body.jwt;
      } catch { /* query only */ }
    }
    try {
      const out = await completeAuthorize({ ticket, appwrite_jwt });
      if (out.location) {
        res.writeHead(302, { ...corsHeaders(), Location: out.location });
        res.end();
        return;
      }
      res.writeHead(out.status || 400, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end(out.text || "complete failed");
    } catch (err) {
      res.writeHead(500, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end(err.message || "complete failed");
    }
    return;
  }

  if ((path === "/oauth/token" || path === "/api/oauth/token") && method === "POST") {
    let body = {};
    const ctype = String(req.headers["content-type"] || "");
    try {
      if (ctype.includes("application/x-www-form-urlencoded")) {
        const raw = await new Promise((resolve, reject) => {
          if (typeof req.body === "string") return resolve(req.body);
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          req.on("error", reject);
        });
        body = Object.fromEntries(new URLSearchParams(raw));
      } else {
        body = await readBody(req);
      }
    } catch {
      res.writeHead(400, corsHeaders());
      res.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    try {
      const out = await handleTokenRequest(body, req.headers.authorization || "");
      res.writeHead(out.status, corsHeaders({ "Cache-Control": "no-store" }));
      res.end(JSON.stringify(out.json));
    } catch (err) {
      res.writeHead(500, corsHeaders());
      res.end(JSON.stringify({ error: "server_error", error_description: err.message }));
    }
    return;
  }

  if ((path === "/oauth/jwks" || path === "/api/oauth/jwks") && method === "GET") {
    // HS256 shared-secret AS — no public JWK; advertise empty set.
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ keys: [] }));
    return;
  }

  // OpenAI Apps marketplace domain challenge (plain text token)
  if (
    path === "/.well-known/openai-apps-challenge" ||
    path === "/openai-apps-challenge" ||
    path === "/api/openai-apps-challenge" ||
    path.endsWith("/openai-apps-challenge")
  ) {
    const token = process.env.OPENAI_APPS_CHALLENGE || "";
    const headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": CORS,
    };
    if (!token) {
      res.writeHead(404, headers);
      res.end("OPENAI_APPS_CHALLENGE not configured");
      return;
    }
    if (method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    if (method !== "GET") {
      res.writeHead(405, headers);
      res.end("method not allowed");
      return;
    }
    res.writeHead(200, headers);
    res.end(token);
    return;
  }

  if (path === "/health" || path === "/" || (path === "/api" && method === "GET" && !url.searchParams.get("sessionId"))) {
    res.writeHead(200, corsHeaders());
    const base = getPublicBase(req);
    res.end(JSON.stringify({
      ok: true,
      service: "medicine-support-hub-mcp",
      version: SERVER_INFO.version,
      transports: {
        "streamable-http": MCP_PATH,
        sse: "/sse",
        messages: "/messages",
        stdio: "node src/stdio.mjs",
      },
      protocolVersions: PROTOCOL_VERSIONS,
      oauth: {
        configured: oauthConfigured(),
        resource_metadata: `${base}/.well-known/oauth-protected-resource`,
        authorization_server_metadata: `${base}/.well-known/oauth-authorization-server`,
        authorize: `${base}/oauth/authorize`,
        token: `${base}/oauth/token`,
        register: `${base}/oauth/register`,
        login_bridge: `${process.env.PUBLIC_SITE_URL || "https://medicinesupport.app"}/mcp-oauth`,
      },
      tools: TOOLS.map((t) => t.name),
    }));
    return;
  }

  const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (!rateOk(ip)) {
    res.writeHead(429, corsHeaders());
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded" }, id: null }));
    return;
  }

  if (path === "/sse" && method === "GET") {
    const sid = randomUUID();
    res.writeHead(200, sseHeaders(sid));
    writeSse(res, `/messages?sessionId=${sid}`, "endpoint");
    sseSessions.set(sid, res);
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 15000);
    req.on("close", () => {
      clearInterval(ping);
      sseSessions.delete(sid);
    });
    return;
  }

  if ((path === "/messages" || path === MCP_PATH || path === "/api" || path === "/mcp") && method === "DELETE") {
    const sid = sessionIdFrom(req, url);
    const stream = sseSessions.get(sid);
    if (stream) {
      try { stream.end(); } catch { /* ignore */ }
      sseSessions.delete(sid);
    }
    res.writeHead(204, corsHeaders({ "Mcp-Session-Id": sid }));
    res.end();
    return;
  }

  if ((path === MCP_PATH || path === "/mcp" || path === "/api") && method === "GET" && wantsSse(req)) {
    const sid = sessionIdFrom(req, url);
    res.writeHead(200, sseHeaders(sid));
    sseSessions.set(sid, res);
    writeSse(res, { jsonrpc: "2.0", method: "notifications/ready", params: { sessionId: sid } }, "message");
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 15000);
    req.on("close", () => {
      clearInterval(ping);
      sseSessions.delete(sid);
    });
    return;
  }

  if (method === "GET") {
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({
      name: SERVER_INFO.name,
      transports: ["streamable-http", "sse", "stdio"],
      endpoints: { mcp: MCP_PATH, sse: "/sse", messages: "/messages" },
      protocolVersions: PROTOCOL_VERSIONS,
      instructions: INSTRUCTIONS,
      tools: TOOLS.map((t) => t.name),
    }));
    return;
  }

  if (method !== "POST") {
    res.writeHead(405, corsHeaders());
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, corsHeaders());
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
    return;
  }

  const auth = authContextFromRequest(req);
  // Invalid bearer on MCP calls: challenge (mixed-auth — public tools still work if no header)
  if (auth.oauthReady && bearerPresent(req) && !auth.user) {
    res.writeHead(401, corsHeaders({
      "WWW-Authenticate": wwwAuthenticateChallenge({ error: "invalid_token", error_description: "Access token invalid or expired" }),
    }));
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }));
    return;
  }
  const out = await handleRpc(body, auth);
  const sid = sessionIdFrom(req, url);

  if (path === "/messages") {
    const stream = sseSessions.get(sid);
    if (stream && out != null) writeSse(stream, out, "message");
    res.writeHead(out == null ? 202 : 200, corsHeaders({ "Mcp-Session-Id": sid }));
    res.end(out == null ? undefined : JSON.stringify(out));
    return;
  }

  if (out == null) {
    res.writeHead(202, corsHeaders({ "Mcp-Session-Id": sid }));
    res.end();
    return;
  }

  if (wantsSse(req)) {
    res.writeHead(200, sseHeaders(sid));
    writeSse(res, out, "message");
    res.end();
    return;
  }

  res.writeHead(200, corsHeaders({ "Mcp-Session-Id": sid }));
  res.end(JSON.stringify(out));
}
