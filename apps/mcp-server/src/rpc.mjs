import { randomUUID } from "node:crypto";
import { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool } from "./tools.mjs";

const CORS = process.env.CORS_ORIGIN || "*";
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const buckets = new Map();
const sseSessions = new Map();

export const PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05"];
export { SERVER_INFO, INSTRUCTIONS, TOOLS };

export async function handleRpc(body) {
  if (Array.isArray(body)) return Promise.all(body.map((m) => handleRpc(m)));
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
      return { jsonrpc: "2.0", id, result: await callTool(params?.name, params?.arguments || {}) };
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version",
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

export async function handleHttp(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const method = req.method || "GET";
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (path === "/health" || path === "/" || (path === "/api" && method === "GET" && !url.searchParams.get("sessionId"))) {
    res.writeHead(200, corsHeaders());
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

  const out = await handleRpc(body);
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
