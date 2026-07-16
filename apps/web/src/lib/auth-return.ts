export const PATIENT_AUTH_NEXT_KEY = "medicine_support_auth_next";
export const STAFF_AUTH_NEXT_KEY = "medicine_support_staff_auth_next";
export const AUTH_SCROLL_RESTORE_KEY = "medicine_support_auth_scroll_restore";

const SAFE_INTERNAL_PATH = /^\/[a-zA-Z0-9][a-zA-Z0-9/_?&=#.%~-]*$/;

export function currentInternalPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function safeInternalPath(candidate: string | null | undefined) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//"))
    return null;
  return SAFE_INTERNAL_PATH.test(candidate) ? candidate : null;
}

export function requestedAuthDestination(kind: "patient" | "staff") {
  const key = kind === "patient" ? PATIENT_AUTH_NEXT_KEY : STAFF_AUTH_NEXT_KEY;
  const fromQuery = new URLSearchParams(window.location.search).get("next");
  return (
    safeInternalPath(fromQuery) ?? safeInternalPath(sessionStorage.getItem(key))
  );
}

export function rememberAuthDestination(
  kind: "patient" | "staff",
  destination = currentInternalPath(),
) {
  const safeDestination = safeInternalPath(destination);
  if (!safeDestination) return null;
  const key = kind === "patient" ? PATIENT_AUTH_NEXT_KEY : STAFF_AUTH_NEXT_KEY;
  sessionStorage.setItem(key, safeDestination);
  sessionStorage.setItem(
    AUTH_SCROLL_RESTORE_KEY,
    JSON.stringify({ path: safeDestination, y: window.scrollY }),
  );
  return safeDestination;
}

export function clearAuthDestination(kind: "patient" | "staff") {
  sessionStorage.removeItem(
    kind === "patient" ? PATIENT_AUTH_NEXT_KEY : STAFF_AUTH_NEXT_KEY,
  );
}

export function authHref(
  kind: "patient" | "staff",
  destination = currentInternalPath(),
) {
  const safeDestination = safeInternalPath(destination);
  const authPath = kind === "patient" ? "/account" : "/portal";
  return safeDestination
    ? `${authPath}?next=${encodeURIComponent(safeDestination)}`
    : authPath;
}
