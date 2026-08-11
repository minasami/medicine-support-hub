/**
 * edge-api — lightweight Appwrite Function (regional “edge” entrypoint)
 *
 * Appwrite does not expose a separate Supabase-style Edge Functions product.
 * This function is the project’s public HTTP surface for:
 *   GET  /health
 *   GET  /version
 *   GET  /catalog/ping   — verifies medicines collection read path
 *   POST /search/expand  — typo/alias expand helper (no PII stored)
 *
 * Deploy: pnpm run deploy:functions -- --only edge-api
 * Console: Functions → edge-api → Domains (optional custom path)
 */

import { Client, Databases, Query } from "node-appwrite";

const DB =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.DATABASE_ID ||
  "medicine_support_hub";
const COL_MEDICINES =
  process.env.MEDICINES_COLLECTION_ID || "medicines";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers":
    "content-type,x-appwrite-project,x-appwrite-key,authorization",
  "content-type": "application/json",
};

function json(res, status, body) {
  return res.json(body, status, CORS);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch {
    return {};
  }
}

/** Path after function base (supports domain path or ?path=) */
function requestPath(req) {
  const fromQuery = req.query?.path || req.query?.p;
  if (fromQuery) return String(fromQuery);
  const path =
    req.path ||
    req.url ||
    req.headers["x-forwarded-path"] ||
    "/";
  const s = String(path);
  // Strip function id prefix if present
  return s.replace(/^\/v1\/functions\/[^/]+\/executions?/, "") || "/";
}

function normalizeQuery(q) {
  return String(q || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Small built-in typo map (same spirit as client expandSearchQuery). */
const ALIASES = {
  nortryptalin: "nortriptyline",
  nortryptyline: "nortriptyline",
  concor: "concor",
  panadol: "paracetamol",
  brufen: "ibuprofen",
};

function expandQuery(q) {
  const n = normalizeQuery(q);
  if (!n) return { primary: "", aliases: [] };
  const aliases = [];
  if (ALIASES[n]) aliases.push(ALIASES[n]);
  // light phonetic: strip trailing vowels for matching
  const stem = n.replace(/[aeiou]+$/g, "");
  if (stem.length >= 4 && stem !== n) aliases.push(stem);
  return { primary: n, aliases: [...new Set(aliases)].filter((a) => a !== n) };
}

function getDb() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key =
    process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Databases(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") {
    return res.empty ? res.empty() : json(res, 204, {});
  }

  const path = requestPath(req).toLowerCase();
  const method = (req.method || "GET").toUpperCase();

  try {
    // —— Health ——
    if (
      path === "/" ||
      path === "/health" ||
      path.endsWith("/health") ||
      (method === "GET" && !req.query?.action)
    ) {
      if (path.includes("version") || req.query?.action === "version") {
        return json(res, 200, {
          ok: true,
          service: "edge-api",
          region: process.env.APPWRITE_REGION || "fra",
          runtime: process.env.APPWRITE_FUNCTION_RUNTIME_NAME || "node",
          functionId: process.env.APPWRITE_FUNCTION_ID || "edge-api",
          ts: new Date().toISOString(),
        });
      }
      if (path.includes("catalog/ping") || req.query?.action === "catalog_ping") {
        const db = getDb();
        if (!db) {
          return json(res, 503, {
            ok: false,
            error: "db_not_configured",
            hint: "Set APPWRITE_API_KEY on the function",
          });
        }
        const list = await db.listDocuments(DB, COL_MEDICINES, [Query.limit(1)]);
        return json(res, 200, {
          ok: true,
          catalog: "up",
          sampleTotal: list.total,
          ts: new Date().toISOString(),
        });
      }
      if (path.includes("search/expand") || req.query?.action === "expand") {
        const body = parseBody(req);
        const q = body.q || body.query || req.query?.q || "";
        const expanded = expandQuery(q);
        return json(res, 200, { ok: true, ...expanded });
      }

      // default health
      if (
        path === "/" ||
        path.endsWith("/health") ||
        path === "/health" ||
        method === "GET"
      ) {
        return json(res, 200, {
          ok: true,
          service: "edge-api",
          endpoints: ["/health", "/version", "/catalog/ping", "/search/expand"],
          ts: new Date().toISOString(),
        });
      }
    }

    // POST expand
    if (method === "POST") {
      const body = parseBody(req);
      const action = (body.action || "expand").toLowerCase();
      if (action === "expand" || path.includes("search/expand")) {
        const expanded = expandQuery(body.q || body.query || "");
        return json(res, 200, { ok: true, ...expanded });
      }
      if (action === "health") {
        return json(res, 200, { ok: true, service: "edge-api" });
      }
    }

    return json(res, 404, {
      ok: false,
      error: "not_found",
      path,
      hint: "Use /health, /version, /catalog/ping, /search/expand",
    });
  } catch (e) {
    error(String(e?.message || e));
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
};
