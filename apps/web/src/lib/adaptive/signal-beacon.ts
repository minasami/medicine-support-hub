/**
 * Flush privacy-preserving adaptive events to the Appwrite aggregator function.
 * No user ids, emails, or raw device identifiers.
 */

import { recentEvents, type AdaptiveEvent } from "@/lib/adaptive/user-signals";

const BEACON_CURSOR_KEY = "msh:adaptive-beacon-cursor:v1";
const DEFAULT_FN_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_ADAPTIVE_FUNCTION_URL) ||
  "";

function normalizeQuery(q: string): string {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

/** Build anonymized payload from local events since last cursor. */
export function buildAnonBatch(limit = 40): {
  events: Array<Record<string, string | number>>;
  cursor: string;
} {
  const events = recentEvents(120);
  let cursor = "";
  try {
    cursor = localStorage.getItem(BEACON_CURSOR_KEY) || "";
  } catch {
    /* ignore */
  }

  const fresh = cursor
    ? events.filter((e) => e.at > cursor)
    : events.slice(-limit);

  const out: Array<Record<string, string | number>> = [];

  // Detect empty → success reformulations in order
  for (let i = 0; i < fresh.length; i++) {
    const ev = fresh[i];
    out.push(toAnon(ev));

    if (ev.type === "search_empty" && i + 1 < fresh.length) {
      const next = fresh[i + 1];
      if (next.type === "search_success" && ev.query && next.query) {
        const from = normalizeQuery(ev.query);
        const to = normalizeQuery(next.query);
        if (from && to && from !== to) {
          out.push({
            type: "query_reformulated",
            fromQuery: from,
            toQuery: to,
          });
        }
      }
    }
  }

  const newCursor = fresh.length ? fresh[fresh.length - 1].at : cursor;
  return { events: out.slice(0, limit), cursor: newCursor };
}

function toAnon(ev: AdaptiveEvent): Record<string, string | number> {
  const row: Record<string, string | number> = { type: ev.type };
  if (ev.query) row.query = normalizeQuery(ev.query);
  if (typeof ev.rank === "number") {
    // coarse buckets only
    row.rankBucket = ev.rank <= 3 ? 1 : ev.rank <= 10 ? 2 : 3;
  }
  return row;
}

/**
 * POST anonymized batch. No-op if VITE_ADAPTIVE_FUNCTION_URL is unset.
 */
export async function flushAdaptiveBeacon(opts?: {
  functionUrl?: string;
}): Promise<{ ok: boolean; accepted?: number }> {
  const url = opts?.functionUrl || DEFAULT_FN_URL;
  if (!url || typeof fetch === "undefined") return { ok: false };

  const { events, cursor } = buildAnonBatch();
  if (!events.length) return { ok: true, accepted: 0 };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ingest", events }),
      keepalive: true,
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json().catch(() => ({}))) as {
      accepted?: number;
    };
    try {
      localStorage.setItem(BEACON_CURSOR_KEY, cursor);
    } catch {
      /* ignore */
    }
    return { ok: true, accepted: data.accepted || events.length };
  } catch {
    return { ok: false };
  }
}

/** Schedule periodic flush (call once from app shell). */
export function startAdaptiveBeacon(intervalMs = 120_000): () => void {
  if (typeof window === "undefined") return () => {};
  const tick = () => {
    void flushAdaptiveBeacon();
  };
  const id = window.setInterval(tick, intervalMs);
  // initial delayed flush
  const t = window.setTimeout(tick, 15_000);
  return () => {
    window.clearInterval(id);
    window.clearTimeout(t);
  };
}
