/**
 * OpenAI Apps domain verification challenge.
 * Serves plain-text token from OPENAI_APPS_CHALLENGE (set in Vercel env).
 * Rewritten from /.well-known/openai-apps-challenge via vercel.json.
 */
export default function handler(req, res) {
  const token = process.env.OPENAI_APPS_CHALLENGE || "";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("method not allowed");
    return;
  }
  if (!token) {
    res.statusCode = 404;
    res.end("OPENAI_APPS_CHALLENGE not configured");
    return;
  }
  res.statusCode = 200;
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(token);
}
