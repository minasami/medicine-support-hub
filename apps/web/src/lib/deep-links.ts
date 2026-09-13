/**
 * App Links / universal links → in-app navigation.
 * Replaces Firebase Dynamic Links with Appwrite Sites / medicinesupport.app URLs.
 *
 * Routes:
 *   /drug/:canonicalId  → medicine detail (canonical)
 *   /rx/:prescriptionId → prescription / request view
 *   /invite?ref=        → invite / referral landing
 */
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

const SITE =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_PUBLIC_SITE_URL) ||
  "https://medicinesupport.app";

export function publicSiteOrigin(): string {
  return String(SITE).replace(/\/$/, "");
}

export function drugDeepLink(canonicalId: string | number): string {
  return `${publicSiteOrigin()}/drug/${encodeURIComponent(String(canonicalId))}`;
}

export function rxDeepLink(prescriptionId: string): string {
  return `${publicSiteOrigin()}/rx/${encodeURIComponent(prescriptionId)}`;
}

export function inviteDeepLink(ref: string): string {
  const q = new URLSearchParams({ ref });
  return `${publicSiteOrigin()}/invite?${q.toString()}`;
}

/**
 * Map an absolute or path URL to an in-app wouter path.
 */
export function mapDeepLinkToPath(url: string): string | null {
  try {
    const u = new URL(url, publicSiteOrigin());
    const hostOk =
      u.hostname === "medicinesupport.app" ||
      u.hostname.endsWith(".medicinesupport.app") ||
      u.hostname.includes("appwrite") ||
      u.hostname === "localhost";
    if (!hostOk && Capacitor.isNativePlatform()) {
      // Still allow path-shaped app links if scheme is https and path matches
      if (!/^\/(drug|rx|invite|medicines|medicine|catalog)\b/.test(u.pathname)) {
        return null;
      }
    }

    const path = u.pathname.replace(/\/+$/, "") || "/";
    const drug = path.match(/^\/drug\/([^/]+)$/i);
    if (drug) return `/medicines/${decodeURIComponent(drug[1])}`;

    const rx = path.match(/^\/rx\/([^/]+)$/i);
    if (rx) return `/requests/${decodeURIComponent(rx[1])}`;

    if (path === "/invite" || path.startsWith("/invite")) {
      const ref = u.searchParams.get("ref") || "";
      return ref ? `/invite?ref=${encodeURIComponent(ref)}` : "/invite";
    }

    // Pass through known app paths
    if (
      path.startsWith("/medicines") ||
      path.startsWith("/medicine/") ||
      path.startsWith("/catalog/") ||
      path.startsWith("/requests/") ||
      path === "/"
    ) {
      return `${path}${u.search}${u.hash}`;
    }

    return null;
  } catch {
    return null;
  }
}

type NavigateFn = (path: string) => void;

/**
 * Register Capacitor appUrlOpen + cold-start getLaunchUrl handlers.
 * Returns cleanup.
 */
export function startDeepLinkListener(navigate: NavigateFn): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handle = (url: string) => {
    const path = mapDeepLinkToPath(url);
    if (path) navigate(path);
  };

  // Web: path already in location; /drug/:id handled by routes.
  if (!Capacitor.isNativePlatform()) {
    return () => undefined;
  }

  let removed = false;
  let sub: { remove: () => Promise<void> } | null = null;

  void (async () => {
    try {
      const launch = await CapApp.getLaunchUrl();
      if (!removed && launch?.url) handle(launch.url);
    } catch {
      /* ignore */
    }
    try {
      sub = await CapApp.addListener("appUrlOpen", (event) => {
        if (event?.url) handle(event.url);
      });
    } catch {
      /* ignore */
    }
  })();

  return () => {
    removed = true;
    void sub?.remove?.();
  };
}
