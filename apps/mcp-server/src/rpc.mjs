import { estimateCost, getMedicine, searchMedicines, listPopular, DISCLAIMER_AR, DISCLAIMER_EN } from "./catalog.mjs";

const CORS = process.env.CORS_ORIGIN || "*";
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const buckets = new Map();

export const SERVER_INFO = { name: "medicine-support-hub", version: "0.1.0" };
export const INSTRUCTIONS = [
  "Medicine Support Hub provides Egyptian medicine catalog search and indicative EGP cost estimates.",
  "Always include the tool disclaimer when discussing prices.",
  "Never invent a price if unit_egp is null.",
  "Never present results as a pharmacy quote, prescription, diagnosis, or insurance approval.",
  "Prefer confirming pack/strength when multiple products match.",
].join(" ");

export const TOOLS = [
  {
    name: "search_medicines",
    description: "Search the Medicine Support Hub Egyptian catalog by brand, Arabic name, or scientific name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_medicine",
    description: "Get one catalog product by canonical_id or document id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "estimate_cost",
    description: "Estimate indicative total cost in EGP for a list of medicines. Always show the returned disclaimer.",
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
    description: "Starter list of commonly searched Egyptian pharmacy brands.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_disclaimer",
    description: "Official price/cost estimate disclaimer in Arabic and English.",
    inputSchema: { type: "object", properties: {} },
  },
];

function rateOk(ip) {
  const slot = Math.floor(Date.now() / 60000);
  const key = `${ip}:${slot}`;
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 5000) buckets.clear();
  return n <= RATE;
}

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj };
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
    case "estimate_cost":
      return textResult(await estimateCost(args.lines || []));
    case "list_popular_medicines":
      return textResult({ items: await listPopular(), disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    case "get_disclaimer":
      return textResult({ disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR, site: process.env.PUBLIC_SITE_URL || "https://medicinesupport.app" });
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

export async function handleRpc(body) {
  if (Array.isArray(body)) return Promise.all(body.map((m) => handleRpc(m)));
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

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": CORS,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  };
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

export async function handleHttp(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const method = req.method || "GET";
  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/" || (url.pathname === "/api" && method === "GET")) {
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ ok: true, service: "medicine-support-hub-mcp", version: SERVER_INFO.version, mcp: MCP_PATH, tools: TOOLS.map((t) => t.name) }));
    return;
  }

  const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (!rateOk(ip)) {
    res.writeHead(429, corsHeaders());
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded" }, id: null }));
    return;
  }

  if (method === "GET") {
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ name: SERVER_INFO.name, transport: "streamable-http", instructions: INSTRUCTIONS, tools: TOOLS.map((t) => t.name) }));
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
  if (out == null) {
    res.writeHead(202, corsHeaders());
    res.end();
    return;
  }
  res.writeHead(200, corsHeaders());
  res.end(JSON.stringify(out));
}
