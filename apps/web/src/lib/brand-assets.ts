/**
 * Capacitor-safe public asset URLs.
 * With BASE_PATH=./ (native WebView), absolute "/foo.png" resolves against the
 * origin root and breaks; join against Vite's BASE_URL instead.
 */
export const PLATFORM_LOGO_PATH = "medicine-support-hub-logo.png";

export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean) return base;
  // BASE_URL is "/" or "./" or "/subdir/" — always ends with /
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${clean}`;
}

export function platformLogoUrl(): string {
  return publicAssetUrl(PLATFORM_LOGO_PATH);
}
