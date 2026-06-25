import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const _envSecret = process.env["SESSION_SECRET"];
if (!_envSecret && process.env["NODE_ENV"] === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}
const SESSION_SECRET = _envSecret ?? "chronicmed-dev-secret-local-only";
const JWT_ALG = "HS256";
const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export const COOKIE_NAME = "cm_session";

// ─── Password helpers ─────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    const hashBuffer = Buffer.from(hash, "hex");
    const derivedBuffer = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

// ─── Minimal JWT (HMAC-SHA256) ────────────────────────────────────────────────

interface JwtPayload {
  sub: number;       // userId
  role: string;
  username: string;
  displayName: string;
  branchId: number | null;
  iat: number;
  exp: number;
}

function b64url(buf: Buffer | string): string {
  const s = typeof buf === "string" ? buf : buf.toString("base64");
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function signJwt(payload: JwtPayload): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: JWT_ALG, typ: "JWT" })).toString("base64"));
  const body = b64url(Buffer.from(JSON.stringify(payload)).toString("base64"));
  const sig = b64url(createHmac("sha256", SESSION_SECRET).update(`${header}.${body}`).digest("base64"));
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = b64url(createHmac("sha256", SESSION_SECRET).update(`${header}.${body}`).digest("base64"));
    if (expected !== sig) return null;
    const payload: JwtPayload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Public session API (same interface as before) ───────────────────────────

export function createSession(
  userId: number,
  role: string,
  username: string,
  displayName: string,
  branchId: number | null,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: userId,
    role,
    username,
    displayName,
    branchId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  return signJwt(payload);
}

export function getSession(token: string): {
  userId: number;
  role: string;
  username: string;
  displayName: string;
  branchId: number | null;
} | null {
  const payload = verifyJwt(token);
  if (!payload) return null;
  return {
    userId: payload.sub,
    role: payload.role,
    username: payload.username,
    displayName: payload.displayName,
    branchId: payload.branchId,
  };
}

export function destroySession(_token: string): void {
  // Stateless JWT — nothing to invalidate server-side.
  // Logout is handled by clearing the cookie on the client.
}
