/**
 * Collect privacy-preserving interaction signals that drive evolution.
 * Stored locally; optional future beacon to analytics endpoint.
 */

import type { FitnessSignals } from "@/lib/adaptive/platform-genome";

const SIGNALS_KEY = "msh:adaptive-signals:v1";
const EVENTS_KEY = "msh:adaptive-events:v1";

export type AdaptiveEventType =
  | "search_success"
  | "search_empty"
  | "result_click"
  | "query_reformulated"
  | "healing_recovery"
  | "healing_failure"
  | "portfolio_edit"
  | "voice_search";

export type AdaptiveEvent = {
  type: AdaptiveEventType;
  at: string;
  query?: string;
  rank?: number;
  canonicalId?: number;
  meta?: Record<string, string | number | boolean | null>;
};

function emptySignals(): FitnessSignals {
  return {
    searchSuccess: 0,
    searchEmpty: 0,
    resultClickTop3: 0,
    resultClickOther: 0,
    healingRecoveries: 0,
    healingFailures: 0,
  };
}

export function loadSignals(): FitnessSignals {
  if (typeof window === "undefined") return emptySignals();
  try {
    const raw = localStorage.getItem(SIGNALS_KEY);
    return raw ? { ...emptySignals(), ...JSON.parse(raw) } : emptySignals();
  } catch {
    return emptySignals();
  }
}

function saveSignals(s: FitnessSignals): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIGNALS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function recordAdaptiveEvent(event: Omit<AdaptiveEvent, "at"> & { at?: string }): void {
  if (typeof window === "undefined") return;
  const full: AdaptiveEvent = { ...event, at: event.at || new Date().toISOString() };

  const signals = loadSignals();
  switch (full.type) {
    case "search_success":
      signals.searchSuccess += 1;
      break;
    case "search_empty":
      signals.searchEmpty += 1;
      break;
    case "result_click": {
      const rank = typeof full.rank === "number" ? full.rank : 99;
      if (rank <= 3) signals.resultClickTop3 += 1;
      else signals.resultClickOther += 1;
      break;
    }
    case "healing_recovery":
      signals.healingRecoveries += 1;
      break;
    case "healing_failure":
      signals.healingFailures += 1;
      break;
    default:
      break;
  }
  saveSignals(signals);

  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list: AdaptiveEvent[] = raw ? JSON.parse(raw) : [];
    list.push(full);
    // Cap memory
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore */
  }
}

export function recentEvents(limit = 50): AdaptiveEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list: AdaptiveEvent[] = raw ? JSON.parse(raw) : [];
    return list.slice(-limit);
  } catch {
    return [];
  }
}
