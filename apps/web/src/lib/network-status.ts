/**
 * Lightweight online/offline helpers for consumer empty states.
 * Prefer navigator.onLine + window events; never block the UI on this alone.
 */

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function looksLikeNetworkError(message: string | null | undefined): boolean {
  if (!message) return !isBrowserOnline();
  return /failed to fetch|network|offline|unreachable|load failed|ERR_INTERNET|timeout|timed out|catalog unavailable|connection/i.test(
    message,
  );
}

export function subscribeOnlineStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fire = () => onChange(isBrowserOnline());
  window.addEventListener("online", fire);
  window.addEventListener("offline", fire);
  return () => {
    window.removeEventListener("online", fire);
    window.removeEventListener("offline", fire);
  };
}
