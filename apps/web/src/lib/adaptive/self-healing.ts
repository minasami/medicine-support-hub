/**
 * Self-healing execution wrapper for catalog / portfolio data paths.
 * Retries transient failures, records recovery, falls back to alternate providers.
 */

import { getActiveGenome } from "@/lib/adaptive/evolution-engine";
import { recordAdaptiveEvent } from "@/lib/adaptive/user-signals";

export type HealableResult<T> = {
  data: T;
  source: "primary" | "retry" | "fallback";
  attempts: number;
  healed: boolean;
  errorMessage?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run primary operation with genome-configured retries, then optional fallback.
 */
export async function withSelfHealing<T>(opts: {
  primary: () => Promise<T>;
  fallback?: () => Promise<T>;
  /** Treat result as failure (e.g. empty when query expected hits) */
  isFailure?: (value: T) => boolean;
  label?: string;
}): Promise<HealableResult<T>> {
  const genome = getActiveGenome();
  const maxRetries = genome.healing.maxRetries;
  const backoff = genome.healing.retryBackoffMs;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const data = await opts.primary();
      if (opts.isFailure && opts.isFailure(data)) {
        lastErr = new Error("primary returned failure sentinel");
        if (attempt <= maxRetries) {
          await sleep(backoff * attempt);
          continue;
        }
        break;
      }
      if (attempt > 1) {
        recordAdaptiveEvent({
          type: "healing_recovery",
          meta: { label: opts.label || "primary", attempt },
        });
        return {
          data,
          source: "retry",
          attempts: attempt,
          healed: true,
        };
      }
      return {
        data,
        source: "primary",
        attempts: attempt,
        healed: false,
      };
    } catch (e) {
      lastErr = e;
      if (attempt <= maxRetries) {
        await sleep(backoff * attempt);
        continue;
      }
    }
  }

  if (opts.fallback) {
    try {
      const data = await opts.fallback();
      recordAdaptiveEvent({
        type: "healing_recovery",
        meta: {
          label: opts.label || "fallback",
          via: "fallback",
        },
      });
      return {
        data,
        source: "fallback",
        attempts: maxRetries + 1,
        healed: true,
      };
    } catch (e) {
      lastErr = e;
    }
  }

  recordAdaptiveEvent({
    type: "healing_failure",
    meta: {
      label: opts.label || "unknown",
      error: String((lastErr as Error)?.message || lastErr || "unknown"),
    },
  });

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr || "self-healing exhausted"));
}
