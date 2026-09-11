/**
 * Capacitor / Appwrite Google OAuth helpers.
 *
 * Web: createOAuth2Session (cookie) works on medicinesupport.app.
 * Native: createOAuth2Token + Custom Tabs + appwrite-callback deep link,
 * then account.createSession(userId, secret) so the JS SDK stores
 * cookieFallback and the app session is real.
 */
import { Capacitor } from "@capacitor/core";

export const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT ||
  "https://appwrite.medicinesupport.app/v1";
export const APPWRITE_PROJECT_ID =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
export const PUBLIC_SITE_URL = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://medicinesupport.app"
).replace(/\/$/, "");

/** Appwrite Android / iOS deep-link scheme for this project. */
export const APPWRITE_OAUTH_SCHEME = `appwrite-callback-${APPWRITE_PROJECT_ID}`;

const OAUTH_PENDING_NEXT_KEY = "medicine_support_oauth_pending_next";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function rememberOAuthNext(nextPath: string | undefined) {
  if (typeof sessionStorage === "undefined") return;
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    sessionStorage.setItem(OAUTH_PENDING_NEXT_KEY, nextPath);
  } else {
    sessionStorage.removeItem(OAUTH_PENDING_NEXT_KEY);
  }
}

export function consumeOAuthNext(fallback = "/account"): string {
  if (typeof sessionStorage === "undefined") return fallback;
  const raw = sessionStorage.getItem(OAUTH_PENDING_NEXT_KEY);
  sessionStorage.removeItem(OAUTH_PENDING_NEXT_KEY);
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

/** Build Appwrite OAuth2 token URL without navigating (for Browser.open). */
export function buildOAuth2TokenUrl(
  provider: string,
  success: string,
  failure: string,
): string {
  const uri = new URL(
    `${APPWRITE_ENDPOINT}/account/tokens/oauth2/${encodeURIComponent(provider)}`,
  );
  uri.searchParams.set("project", APPWRITE_PROJECT_ID);
  uri.searchParams.set("success", success);
  uri.searchParams.set("failure", failure);
  return uri.toString();
}

export function nativeOAuthSuccessUrl(): string {
  return `${APPWRITE_OAUTH_SCHEME}://auth/success`;
}

export function nativeOAuthFailureUrl(): string {
  return `${APPWRITE_OAUTH_SCHEME}://auth/failure`;
}

/**
 * Parse userId + secret from an OAuth success redirect
 * (https URL or appwrite-callback-…:// deep link).
 */
export function parseOAuthCallbackUrl(
  url: string,
): { userId: string; secret: string; failed: boolean } | null {
  try {
    let parsed: URL;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      // Custom scheme: ensure URL parser accepts host/query
      parsed = new URL(url.replace(/^([^:]+:)\/\//, "https://"));
    } else {
      parsed = new URL(url, "https://localhost");
    }
    const failed =
      /failure|failed|error/i.test(parsed.pathname) ||
      parsed.searchParams.has("error") ||
      parsed.searchParams.has("error_description");
    const userId =
      parsed.searchParams.get("userId") ||
      parsed.searchParams.get("user_id") ||
      "";
    const secret = parsed.searchParams.get("secret") || "";
    if (failed && !userId) return { userId: "", secret: "", failed: true };
    if (userId && secret) return { userId, secret, failed: false };
    if (failed) return { userId: "", secret: "", failed: true };
    return null;
  } catch {
    return null;
  }
}

/** Read OAuth token params from the current window location (WebView return). */
export function readOAuthTokenFromLocation(): {
  userId: string;
  secret: string;
} | null {
  if (typeof window === "undefined") return null;
  const fromSearch = parseOAuthCallbackUrl(window.location.href);
  if (fromSearch && !fromSearch.failed && fromSearch.userId && fromSearch.secret) {
    return { userId: fromSearch.userId, secret: fromSearch.secret };
  }
  const hash = window.location.hash?.replace(/^#/, "");
  if (hash) {
    const fromHash = parseOAuthCallbackUrl(`https://localhost/?${hash}`);
    if (fromHash && !fromHash.failed && fromHash.userId && fromHash.secret) {
      return { userId: fromHash.userId, secret: fromHash.secret };
    }
  }
  return null;
}

export function stripOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  ["userId", "user_id", "secret", "error", "error_description", "oauth"].forEach(
    (k) => url.searchParams.delete(k),
  );
  const next = url.pathname + (url.search ? url.search : "") + (url.hash || "");
  window.history.replaceState(null, document.title, next || url.pathname);
}
