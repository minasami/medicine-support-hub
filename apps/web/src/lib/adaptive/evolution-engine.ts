/**
 * Evolutionary loop: evaluate fitness → keep or mutate genome.
 * Runs client-side on meaningful signal thresholds (not every keystroke).
 */

import {
  loadGenome,
  mutateGenome,
  saveGenome,
  scoreFitness,
  type PlatformGenome,
} from "@/lib/adaptive/platform-genome";
import { loadSignals, recentEvents } from "@/lib/adaptive/user-signals";

const LAST_EVOLVE_KEY = "msh:last-evolve-at:v1";
const MIN_EVENTS_BEFORE_EVOLVE = 12;
const MIN_MS_BETWEEN_EVOLVE = 6 * 60 * 60 * 1000; // 6h

/**
 * Learn query aliases when user searches A (empty) then B (success) quickly.
 */
export function harvestQueryAliases(genome: PlatformGenome): PlatformGenome {
  const events = recentEvents(80);
  const next = { ...genome, queryAliases: { ...genome.queryAliases } };

  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (a.type !== "search_empty" || b.type !== "search_success") continue;
    const qa = (a.query || "").trim().toLowerCase();
    const qb = (b.query || "").trim().toLowerCase();
    if (!qa || !qb || qa === qb) continue;
    // only short→longer or typo-like pairs
    if (qa.length < 3 || qb.length < 3) continue;
    const dt =
      new Date(b.at).getTime() - new Date(a.at).getTime();
    if (dt < 0 || dt > 90_000) continue;
    next.queryAliases[qa] = qb;
  }

  // Cap aliases
  const keys = Object.keys(next.queryAliases);
  if (keys.length > 80) {
    for (const k of keys.slice(0, keys.length - 80)) {
      delete next.queryAliases[k];
    }
  }
  return next;
}

/**
 * Attempt one evolutionary generation if enough new signal has accumulated.
 */
export function maybeEvolveGenome(): PlatformGenome {
  const current = loadGenome();
  if (typeof window === "undefined") return current;

  try {
    const last = Number(localStorage.getItem(LAST_EVOLVE_KEY) || 0);
    if (Date.now() - last < MIN_MS_BETWEEN_EVOLVE) {
      return harvestQueryAliases(current);
    }
  } catch {
    /* ignore */
  }

  const signals = loadSignals();
  const volume =
    signals.searchSuccess +
    signals.searchEmpty +
    signals.resultClickTop3 +
    signals.resultClickOther +
    signals.healingRecoveries +
    signals.healingFailures;

  if (volume < MIN_EVENTS_BEFORE_EVOLVE) {
    return harvestQueryAliases(current);
  }

  const fitness = scoreFitness(signals);
  let next = harvestQueryAliases(current);

  // If fitness is mediocre, mutate ranking/healing genes
  if (fitness < 0.72) {
    const candidate = mutateGenome(next, fitness < 0.45 ? 0.12 : 0.06);
    // Accept mutation (online learning without held-out set — conservative)
    next = candidate;
  } else {
    // Still bump generation timestamp when harvesting aliases
    next = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
  }

  saveGenome(next);
  try {
    localStorage.setItem(LAST_EVOLVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  return next;
}

export function getActiveGenome(): PlatformGenome {
  return maybeEvolveGenome();
}
