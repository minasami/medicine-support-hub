/**
 * RFC 9728 OAuth Protected Resource Metadata.
 * Rewritten from /.well-known/oauth-protected-resource via vercel.json.
 * Dedicated route so Vercel rewrite does not collapse path to /api.
 */
import { protectedResourceMetadata } from "../src/oauth.mjs";

const CORS = process.env.CORS_ORIGIN || "*";

function headers() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
  };
}

export default function handler(req, res) {
  const h = headers();
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  res.statusCode = 200;
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify(protectedResourceMetadata(req)));
}
