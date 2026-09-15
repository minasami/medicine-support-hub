/**
 * OAuth 2.1 Authorization Server pieces for Medicine Support Hub MCP.
 * Stateless where possible: access/refresh/auth codes and DCR client_ids are
 * HMAC-signed JWTs (MCP_OAUTH_SIGNING_SECRET). Identity is bridged via Appwrite.
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const SITE = () => process.env.PUBLIC_SITE_URL || "https://medicinesupport.app";
const MCP_PUBLIC = () =>
  (process.env.MCP_PUBLIC_URL || process.env.PUBLIC_MCP_URL || "https://mcp.medicinesupport.app").replace(
    /\/+$/,
    "",
  );
const RESOURCE = () => process.env.MCP_RESOURCE_URI || `${MCP_PUBLIC()}/mcp`;
const ISSUER = () => process.env.MCP_OAUTH_ISSUER || MCP_PUBLIC();

const SCOPES = ["msh:user"];
const ACCESS_TTL_SEC = Number(process.env.MCP_OAUTH_ACCESS_TTL_SEC || 3600);
const REFRESH_TTL_SEC = Number(process.env.MCP_OAUTH_REFRESH_TTL_SEC || 60 * 60 * 24 * 30);
const CODE_TTL_SEC = Number(process.env.MCP_OAUTH_CODE_TTL_SEC || 300);
const TICKET_TTL_SEC = Number(process.env.MCP_OAUTH_TICKET_TTL_SEC || 600);

const REDIRECT_HOST_ALLOW = [
  /(^|\.)chatgpt\.com$/i,
  /(^|\.)chat\.openai\.com$/i,
  /(^|\.)openai\.com$/i,
  /(^|\.)claude\.ai$/i,
  /(^|\.)claude\.com$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)grok\.com$/i,
  /(^|\.)x\.ai$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^\[::1\]$/,
];

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signingSecret() {
  const s =
    process.env.MCP_OAUTH_SIGNING_SECRET ||
    process.env.MCP_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "";
  if (!s || s.length < 16) {
    throw Object.assign(new Error("MCP_OAUTH_SIGNING_SECRET (min 16 chars) is required for OAuth"), {
      code: -32000,
      httpStatus: 500,
    });
  }
  return s;
}

function signJwt(payload, typ = "JWT") {
  const header = { alg: "HS256", typ };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = createHmac("sha256", signingSecret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function verifyJwt(token, { typ } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac("sha256", signingSecret()).update(data).digest();
  let actual;
  try {
    actual = fromB64url(s);
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let header;
  let payload;
  try {
    header = JSON.parse(fromB64url(h).toString("utf8"));
    payload = JSON.parse(fromB64url(p).toString("utf8"));
  } catch {
    return null;
  }
  if (typ && header.typ !== typ && payload.typ !== typ) return null;
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) return null;
  return payload;
}

export function getPublicBase(req) {
  const env = MCP_PUBLIC();
  if (env && !/localhost|127\.0\.0\.1/i.test(env)) return env;
  const proto = (req?.headers?.["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
  const host = (req?.headers?.["x-forwarded-host"] || req?.headers?.host || "localhost").toString().split(",")[0].trim();
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export function protectedResourceMetadata(req) {
  const base = getPublicBase(req);
  return {
    resource: RESOURCE(),
    authorization_servers: [ISSUER()],
    bearer_methods_supported: ["header"],
    scopes_supported: SCOPES,
    resource_documentation: `${SITE()}/mcp`,
    resource_signing_alg_values_supported: ["HS256"],
  };
}

export function authorizationServerMetadata(req) {
  const base = getPublicBase(req);
  const issuer = ISSUER();
  return {
    issuer,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    jwks_uri: `${base}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: SCOPES,
    subject_types_supported: ["public"],
    service_documentation: `${SITE()}/mcp`,
    client_id_metadata_document_supported: true,
  };
}

export function wwwAuthenticateChallenge({ error = "invalid_token", error_description, scope } = {}) {
  const meta = `${MCP_PUBLIC()}/.well-known/oauth-protected-resource`;
  const parts = [
    `Bearer realm="medicine-support-hub"`,
    `resource_metadata="${meta}"`,
  ];
  if (error) parts.push(`error="${error}"`);
  if (error_description) parts.push(`error_description="${String(error_description).replace(/"/g, "'")}"`);
  if (scope || SCOPES.length) parts.push(`scope="${scope || SCOPES.join(" ")}"`);
  return parts.join(", ");
}

export function isRedirectUriAllowed(uri) {
  let u;
  try {
    u = new URL(String(uri || ""));
  } catch {
    return false;
  }
  if (u.protocol === "http:") {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname)) return false;
  } else if (u.protocol !== "https:" && u.protocol !== "http:") {
    // custom schemes used by some desktop clients — allow only known prefixes
    const allowedSchemes = /^(cursor|vscode|claude|chatgpt|openai|grok|xai|com\.openai)/i;
    if (!allowedSchemes.test(u.protocol.replace(":", ""))) return false;
    return true;
  }
  return REDIRECT_HOST_ALLOW.some((re) => re.test(u.hostname));
}

function parseClientIdToken(clientId) {
  if (!clientId) return null;
  if (String(clientId).startsWith("mshc_")) {
    return verifyJwt(String(clientId).slice(5), { typ: "oauth-client" });
  }
  const payload = verifyJwt(clientId, { typ: "oauth-client" });
  return payload;
}

async function resolveClient(clientId) {
  const fromJwt = parseClientIdToken(clientId);
  if (fromJwt) {
    return {
      client_id: clientId,
      client_name: fromJwt.client_name || "MCP Client",
      redirect_uris: fromJwt.redirect_uris || [],
      token_endpoint_auth_method: fromJwt.token_endpoint_auth_method || "none",
      client_secret: fromJwt.client_secret || null,
      grant_types: fromJwt.grant_types || ["authorization_code", "refresh_token"],
    };
  }

  // CIMD: client_id is an https URL to a client metadata document
  if (/^https:\/\//i.test(String(clientId || ""))) {
    try {
      const res = await fetch(clientId, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const doc = await res.json();
      const redirect_uris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris : [];
      if (!redirect_uris.length) return null;
      return {
        client_id: clientId,
        client_name: doc.client_name || doc.client_uri || "CIMD Client",
        redirect_uris,
        token_endpoint_auth_method: doc.token_endpoint_auth_method || "none",
        client_secret: null,
        grant_types: doc.grant_types || ["authorization_code", "refresh_token"],
        cimd: true,
      };
    } catch {
      return null;
    }
  }

  // Pre-registered public clients for major hosts (no secret)
  const presets = {
    chatgpt: {
      client_name: "ChatGPT",
      redirect_uris: [],
      allow_any_chatgpt: true,
    },
    claude: {
      client_name: "Claude",
      redirect_uris: [],
      allow_any_claude: true,
    },
    grok: {
      client_name: "Grok",
      redirect_uris: [],
      allow_any_grok: true,
    },
    openai: {
      client_name: "OpenAI",
      redirect_uris: [],
      allow_any_openai: true,
    },
  };
  if (presets[clientId]) {
    return { client_id: clientId, ...presets[clientId], token_endpoint_auth_method: "none" };
  }
  return null;
}

function redirectMatchesClient(client, redirectUri) {
  if (!isRedirectUriAllowed(redirectUri)) return false;
  if (Array.isArray(client.redirect_uris) && client.redirect_uris.length) {
    return client.redirect_uris.includes(redirectUri);
  }
  let host = "";
  try {
    host = new URL(redirectUri).hostname;
  } catch {
    return false;
  }
  if (client.allow_any_chatgpt && /(chatgpt\.com|openai\.com)$/i.test(host)) return true;
  if (client.allow_any_claude && /(claude\.(ai|com)|anthropic\.com)$/i.test(host)) return true;
  if (client.allow_any_grok && /(grok\.com|x\.ai)$/i.test(host)) return true;
  if (client.allow_any_openai && /openai\.com$/i.test(host)) return true;
  // DCR/CIMD with empty list + allowlisted host (dynamic clients may register later)
  if (client.cimd || client.client_id?.startsWith?.("mshc_") || parseClientIdToken(client.client_id)) {
    return isRedirectUriAllowed(redirectUri);
  }
  // loopback always ok for public desktop clients when host allowlisted
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host)) return true;
  return false;
}

export async function handleDynamicClientRegistration(body) {
  const redirect_uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!redirect_uris.length) {
    return { status: 400, json: { error: "invalid_client_metadata", error_description: "redirect_uris required" } };
  }
  for (const uri of redirect_uris) {
    if (!isRedirectUriAllowed(uri)) {
      return {
        status: 400,
        json: {
          error: "invalid_redirect_uri",
          error_description: `Redirect URI not allowlisted: ${uri}`,
        },
      };
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const client_secret = body?.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none"
    ? randomBytes(24).toString("hex")
    : null;
  const payload = {
    typ: "oauth-client",
    client_name: String(body?.client_name || "MCP Client").slice(0, 128),
    redirect_uris,
    token_endpoint_auth_method: body?.token_endpoint_auth_method || "none",
    grant_types: body?.grant_types || ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_secret,
    iat: now,
    exp: now + 60 * 60 * 24 * 365 * 2,
  };
  const raw = signJwt(payload, "oauth-client");
  const client_id = `mshc_${raw}`;
  return {
    status: 201,
    json: {
      client_id,
      client_id_issued_at: now,
      client_secret: client_secret || undefined,
      client_secret_expires_at: 0,
      redirect_uris,
      grant_types: payload.grant_types,
      response_types: ["code"],
      token_endpoint_auth_method: payload.token_endpoint_auth_method,
      client_name: payload.client_name,
    },
  };
}

function pkceS256(verifier) {
  return b64url(createHash("sha256").update(String(verifier)).digest());
}

export async function beginAuthorize(query) {
  const client_id = String(query.client_id || "");
  const redirect_uri = String(query.redirect_uri || "");
  const response_type = String(query.response_type || "");
  const state = query.state != null ? String(query.state) : "";
  const code_challenge = String(query.code_challenge || "");
  const code_challenge_method = String(query.code_challenge_method || "S256");
  const scope = String(query.scope || SCOPES.join(" "));
  const resource = String(query.resource || RESOURCE());

  if (response_type !== "code") {
    return { status: 400, text: "unsupported_response_type" };
  }
  if (!client_id || !redirect_uri || !code_challenge) {
    return { status: 400, text: "invalid_request: client_id, redirect_uri, code_challenge required" };
  }
  if (code_challenge_method !== "S256") {
    return { status: 400, text: "invalid_request: only S256 PKCE supported" };
  }
  const client = await resolveClient(client_id);
  if (!client) {
    return { status: 400, text: "invalid_client" };
  }
  if (!redirectMatchesClient(client, redirect_uri)) {
    return { status: 400, text: "invalid_redirect_uri" };
  }

  const now = Math.floor(Date.now() / 1000);
  const ticket = signJwt(
    {
      typ: "oauth-ticket",
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      scope,
      resource,
      iat: now,
      exp: now + TICKET_TTL_SEC,
    },
    "oauth-ticket",
  );

  // Trailing slash BEFORE ? so Appwrite Sites slash-redirect cannot strip ?ticket=
  const bridge = `${SITE()}/mcp-oauth/?ticket=${encodeURIComponent(ticket)}`;
  return { status: 302, location: bridge };
}

/**
 * After Appwrite sign-in on medicinesupport.app, complete issues an auth code.
 * Expects: ticket (signed), appwrite_jwt (from account.createJWT()).
 */
export async function completeAuthorize({ ticket, appwrite_jwt }) {
  const payload = verifyJwt(ticket, { typ: "oauth-ticket" });
  if (!payload || payload.typ !== "oauth-ticket") {
    return { status: 400, text: "invalid_ticket" };
  }
  const user = await verifyAppwriteJwt(appwrite_jwt);
  if (!user?.$id) {
    return { status: 401, text: "appwrite_auth_failed" };
  }

  const now = Math.floor(Date.now() / 1000);
  const code = signJwt(
    {
      typ: "oauth-code",
      sub: user.$id,
      email: user.email || null,
      name: user.name || null,
      client_id: payload.client_id,
      redirect_uri: payload.redirect_uri,
      code_challenge: payload.code_challenge,
      code_challenge_method: payload.code_challenge_method,
      scope: payload.scope || SCOPES.join(" "),
      resource: payload.resource || RESOURCE(),
      iat: now,
      exp: now + CODE_TTL_SEC,
      jti: randomBytes(8).toString("hex"),
    },
    "oauth-code",
  );

  const u = new URL(payload.redirect_uri);
  u.searchParams.set("code", code);
  if (payload.state) u.searchParams.set("state", payload.state);
  return { status: 302, location: u.toString(), user };
}

async function verifyAppwriteJwt(jwt) {
  const endpoint = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
  const project = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
  if (!jwt) return null;
  const res = await fetch(`${endpoint}/account`, {
    headers: {
      "X-Appwrite-Project": project,
      "X-Appwrite-JWT": String(jwt),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

function issueTokens({ sub, email, name, client_id, scope, resource }) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt(
    {
      typ: "access",
      sub,
      email: email || undefined,
      name: name || undefined,
      client_id,
      scope: scope || SCOPES.join(" "),
      aud: resource || RESOURCE(),
      iss: ISSUER(),
      iat: now,
      exp: now + ACCESS_TTL_SEC,
    },
    "access",
  );
  const refresh_token = signJwt(
    {
      typ: "refresh",
      sub,
      email: email || undefined,
      name: name || undefined,
      client_id,
      scope: scope || SCOPES.join(" "),
      aud: resource || RESOURCE(),
      iss: ISSUER(),
      iat: now,
      exp: now + REFRESH_TTL_SEC,
    },
    "refresh",
  );
  return {
    access_token,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SEC,
    refresh_token,
    scope: scope || SCOPES.join(" "),
  };
}

export function verifyAccessToken(token) {
  if (!token) return null;
  try {
    const payload = verifyJwt(token, { typ: "access" });
    if (!payload || payload.typ !== "access") return null;
    if (payload.aud && payload.aud !== RESOURCE() && payload.aud !== MCP_PUBLIC()) {
      // allow exact resource or host root
      const allowed = new Set([RESOURCE(), MCP_PUBLIC(), `${MCP_PUBLIC()}/`, `${MCP_PUBLIC()}/mcp`]);
      if (!allowed.has(payload.aud)) return null;
    }
    return {
      userId: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      scope: payload.scope || "",
      clientId: payload.client_id || null,
      raw: payload,
    };
  } catch {
    return null;
  }
}

export async function handleTokenRequest(body, authHeader) {
  const grant = String(body?.grant_type || "");
  const client_id = String(body?.client_id || "");
  let client_secret = body?.client_secret != null ? String(body.client_secret) : null;

  if (authHeader?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx >= 0) {
        if (!client_id) body.client_id = decoded.slice(0, idx);
        client_secret = decoded.slice(idx + 1);
      }
    } catch {
      /* ignore */
    }
  }

  const client = await resolveClient(client_id || body?.client_id);
  if (!client) {
    return { status: 401, json: { error: "invalid_client" } };
  }
  if (client.client_secret && client.client_secret !== client_secret) {
    return { status: 401, json: { error: "invalid_client" } };
  }

  if (grant === "authorization_code") {
    const code = String(body?.code || "");
    const redirect_uri = String(body?.redirect_uri || "");
    const code_verifier = String(body?.code_verifier || "");
    const resource = String(body?.resource || RESOURCE());
    const payload = verifyJwt(code, { typ: "oauth-code" });
    if (!payload || payload.typ !== "oauth-code") {
      return { status: 400, json: { error: "invalid_grant", error_description: "code invalid or expired" } };
    }
    if (payload.client_id !== (client_id || body?.client_id)) {
      return { status: 400, json: { error: "invalid_grant", error_description: "client mismatch" } };
    }
    if (payload.redirect_uri !== redirect_uri) {
      return { status: 400, json: { error: "invalid_grant", error_description: "redirect_uri mismatch" } };
    }
    if (!code_verifier || pkceS256(code_verifier) !== payload.code_challenge) {
      return { status: 400, json: { error: "invalid_grant", error_description: "pkce failed" } };
    }
    const tokens = issueTokens({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      client_id: payload.client_id,
      scope: payload.scope,
      resource: resource || payload.resource,
    });
    return { status: 200, json: tokens };
  }

  if (grant === "refresh_token") {
    const refresh = verifyJwt(String(body?.refresh_token || ""), { typ: "refresh" });
    if (!refresh || refresh.typ !== "refresh") {
      return { status: 400, json: { error: "invalid_grant" } };
    }
    if (refresh.client_id !== (client_id || body?.client_id)) {
      return { status: 400, json: { error: "invalid_grant" } };
    }
    const tokens = issueTokens({
      sub: refresh.sub,
      email: refresh.email,
      name: refresh.name,
      client_id: refresh.client_id,
      scope: refresh.scope,
      resource: String(body?.resource || refresh.aud || RESOURCE()),
    });
    return { status: 200, json: tokens };
  }

  return { status: 400, json: { error: "unsupported_grant_type" } };
}

export function oauthConfigured() {
  try {
    signingSecret();
    return true;
  } catch {
    return false;
  }
}

export { SCOPES, RESOURCE, ISSUER, SITE, MCP_PUBLIC, verifyAppwriteJwt };
