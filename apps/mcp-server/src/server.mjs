/**
 * Medicine Support Hub — Phase 1 remote MCP server (Streamable HTTP / JSON-RPC).
 * Tools: search_medicines, get_medicine, estimate_cost, list_popular_medicines, get_disclaimer
 */
import http from "node:http";
import { estimateCost, getMedicine, searchMedicines, listPopular, DISCLAIMER_AR, DISCLAIMER_EN } from "./catalog.mjs";

const PORT = Number(process.env.PORT || 8787);
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const CORS = process.env.CORS_ORIGIN || "*";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 60);

const buckets = new Map();
function rateOk(ip) {
  const now = Date.now();
  const slot = Math.floor(now / 60000);
  const key = `${ip}:${slot}`;
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 5000) buckets.clear();
  return n <= RATE;
}

const SERVER_INFO = { name: "medicine-support-hub", version: "0.1.0" };
const INSTRUCTIONS = [
  "Medicine Support Hub provides Egyptian medicine catalog search and indicative EGP cost estimates.",
  "Always include the tool disclaimer when discussing prices.",
  "Never invent a price if unit_egp is null.",
  "Never present results as a pharmacy quote, prescription, diagnosis, or insurance approval.",
  "Prefer confirming pack/strength when multiple products match.",
].join(" ");

const TOOLS = [
  {
    name: "search_medicines",
    description:
      "Search the Medicine Support Hub Egyptian catalog by brand, Arabic name, or scientific name. Returns product ids, strengths, manufacturers, and indicative EGP prices when known.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Medicine name in Arabic or English" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_medicine",
    description: "Get one catalog product by canonical_id, document id, barcode-like id, or exact name.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "canonical_id or document id" },
      },
      required: ["id"],
    },
  },
  {
    name: "estimate_cost",
    description:
      "Estimate indicative total cost in EGP for a list of medicines. Match by canonical_id and/or name query and quantity. Unpriced or unmatched lines are listed separately. Always show the returned disclaimer to the user.",
    inputSchema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              canonical_id: { type: ["string", "number"] },
              quantity: { type: "number", minimum: 1, default: 1 },
            },
          },
        },
        locale: { type: "string", enum: ["ar", "en"], default: "ar" },
      },
      required: ["lines"],
    },
  },
  {
    name: "list_popular_medicines",
    description: "Return a starter list of commonly searched Egyptian pharmacy brands with catalog matches when available.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_disclaimer",
    description: "Return the official price/cost estimate disclaimer in Arabic and English.",
    inputSchema: { type: "object", properties: {} },
  },
];

function textResult(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: "text", text }], structuredContent: typeof obj === "string" ? undefined : obj };
}

async function callTool(name, args = {}) {
  switch (name) {
    case "search_medicines": {
      const items = await searchMedicines(args.query, args.limit);
      return textResult({ query: args.query, count: items.length, items, disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    }
    case "get_medicine": {
      const item = await getMedicine(args.id);
      return textResult({ found: Boolean(item), item, disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    }
    case "estimate_cost": {
      const estimate = await estimateCost(args.lines || []);
      return textResult(estimate);
    }
    case "list_popular_medicines": {
      const items = await listPopular();
      return textResult({ items, disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    }
    case "get_disclaimer":
      return textResult({ disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR, site: process.env.PUBLIC_SITE_URL || "https://medicinesupport.app" });
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

async function handleRpc(body) {
  if (Array.isArray(body)) {
    return Promise.all(body.map((m) => handleRpc(m)));
  }
  const { id, method, params } = body || {};
  const isNote = id === undefined || id === null;

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    if (method === "notifications/initialized" || method === "initialized") {
      return isNote ? null : { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    }
    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments || {};
      const result = await callTool(name, args);
      return { jsonrpc: "2.0", id, result };
    }
    if (isNote) return null;
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err) {
    if (isNote) return null;
    return {
      jsonrpc: "2.0",
      id,
      error: { code: err.code || -32000, message: err.message || "Tool failed" },
    };
  }
}

function send(res, status, payload, extra = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": CORS,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
    ...extra,
  };
  res.writeHead(status, headers);
  res.end(payload == null ? "" : JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    send(res, 204, null);
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/") {
    send(res, 200, {
      ok: true,
      service: "medicine-support-hub-mcp",
      version: SERVER_INFO.version,
      mcp: MCP_PATH,
      tools: TOOLS.map((t) => t.name),
    });
    return;
  }

  if (url.pathname !== MCP_PATH) {
    send(res, 404, { error: "not found" });
    return;
  }

  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  if (!rateOk(ip)) {
    send(res, 429, { jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded" }, id: null });
    return;
  }

  if (req.method === "GET") {
    send(res, 200, {
      name: SERVER_INFO.name,
      transport: "streamable-http",
      instructions: INSTRUCTIONS,
      tools: TOOLS.map((t) => t.name),
    });
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "method not allowed" });
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    send(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
    return;
  }

  const out = await handleRpc(body);
  if (out == null) {
    send(res, 202, null);
    return;
  }
  send(res, 200, out);
});

server.listen(PORT, () => {
  console.log(`MSH MCP Phase 1 listening on :${PORT}${MCP_PATH}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
