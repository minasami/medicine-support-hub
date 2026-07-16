import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  AUTH_SCROLL_RESTORE_KEY,
  authHref,
  currentInternalPath,
  rememberAuthDestination,
  safeInternalPath,
} from "@/lib/auth-return";

export function JourneyContinuity() {
  const [location] = useLocation();

  useEffect(() => {
    function preserveJourney(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !target ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      )
        return;
      const url = new URL(target.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        !["/account", "/portal", "/login"].includes(url.pathname) ||
        url.searchParams.has("next")
      )
        return;
      const kind = url.pathname === "/account" ? "patient" : "staff";
      const destination = currentInternalPath();
      rememberAuthDestination(kind, destination);
      target.href = authHref(kind, destination);
    }

    document.addEventListener("click", preserveJourney, true);
    return () => document.removeEventListener("click", preserveJourney, true);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(AUTH_SCROLL_RESTORE_KEY);
    if (!raw) return undefined;
    try {
      const restore = JSON.parse(raw) as { path?: string; y?: number };
      const targetPath = safeInternalPath(restore.path);
      if (!targetPath || targetPath !== currentInternalPath()) return undefined;
      sessionStorage.removeItem(AUTH_SCROLL_RESTORE_KEY);
      const frame = window.requestAnimationFrame(() =>
        window.scrollTo({
          top: Math.max(0, Number(restore.y) || 0),
          behavior: "auto",
        }),
      );
      return () => window.cancelAnimationFrame(frame);
    } catch {
      sessionStorage.removeItem(AUTH_SCROLL_RESTORE_KEY);
      return undefined;
    }
  }, [location]);

  return null;
}
