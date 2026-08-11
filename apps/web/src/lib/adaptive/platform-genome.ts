/**
 * Platform "genome": tunable parameters that evolve from user signals.
 * Safe for a regulated medicine catalog — evolves ranking/healing policy,
 * never mutates production source code autonomously.
 */

const STORAGE_KEY = "msh:platform-genome:v1";
const HISTORY_KEY = "msh:platform-genome-history:v1";

export type RankWeightGene = {
  exact: number;
  barcode: number;
  prefix: number;
  token: number;
  fuzzy: number;
  contains: number;
  manufacturer: number;
  /** Prefer shorter trade names among equal tier */
  shorterNameBonus: number;
};

export type HealingGene = {
  /** Max Appwrite retries before static fallback */
  maxRetries: number;
  /** Base backoff ms */
  retryBackoffMs: number;
  /** Prefer sticky searchAttr when set */
  preferStickySearchAttr: boolean;
  /** Enable typo expansion waterfall */
  enableQueryExpansion: boolean;
  /** Drop weak fuzzy when query length >= this */
  weakFuzzyMinQueryLen: number;
};

export type PlatformGenome = {
  generation: number;
  updatedAt: string;
  rank: RankWeightGene;
  healing: HealingGene;
  /** Learned query → successful reformulation */
  queryAliases: Record<string, string>;
  /** company soft-label → canonical id boosts */
  companyAffinity: Record<string, number>;
};

export const DEFAULT_GENOME: PlatformGenome = {
  generation: 0,
  updatedAt: new Date(0).toISOString(),
  rank: {
    exact: 1,
    barcode: 0.95,
    prefix: 0.85,
    token: 0.7,
    fuzzy: 0.55,
    contains: 0.4,
    manufacturer: 0.3,
    shorterNameBonus: 0.08,
  },
  healing: {
    maxRetries: 2,
    retryBackoffMs: 280,
    preferStickySearchAttr: true,
    enableQueryExpansion: true,
    weakFuzzyMinQueryLen: 4,
  },
  queryAliases: {},
  companyAffinity: {},
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function loadGenome(): PlatformGenome {
  if (typeof window === "undefined") return { ...DEFAULT_GENOME, rank: { ...DEFAULT_GENOME.rank }, healing: { ...DEFAULT_GENOME.healing }, queryAliases: {}, companyAffinity: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_GENOME);
    const parsed = JSON.parse(raw) as PlatformGenome;
    return {
      ...DEFAULT_GENOME,
      ...parsed,
      rank: { ...DEFAULT_GENOME.rank, ...(parsed.rank || {}) },
      healing: { ...DEFAULT_GENOME.healing, ...(parsed.healing || {}) },
      queryAliases: parsed.queryAliases || {},
      companyAffinity: parsed.companyAffinity || {},
    };
  } catch {
    return structuredClone(DEFAULT_GENOME);
  }
}

export function saveGenome(g: PlatformGenome): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
    const histRaw = localStorage.getItem(HISTORY_KEY);
    const hist: Array<{ generation: number; at: string }> = histRaw
      ? JSON.parse(histRaw)
      : [];
    hist.push({ generation: g.generation, at: g.updatedAt });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-40)));
  } catch {
    /* quota */
  }
}

/** Mutate a copy of the genome slightly (evolutionary step). */
export function mutateGenome(parent: PlatformGenome, intensity = 0.06): PlatformGenome {
  const jitter = (v: number, lo: number, hi: number) =>
    clamp(v + (Math.random() * 2 - 1) * intensity * v, lo, hi);

  const rank: RankWeightGene = {
    exact: jitter(parent.rank.exact, 0.7, 1.2),
    barcode: jitter(parent.rank.barcode, 0.6, 1.1),
    prefix: jitter(parent.rank.prefix, 0.5, 1),
    token: jitter(parent.rank.token, 0.35, 0.9),
    fuzzy: jitter(parent.rank.fuzzy, 0.25, 0.75),
    contains: jitter(parent.rank.contains, 0.15, 0.6),
    manufacturer: jitter(parent.rank.manufacturer, 0.1, 0.5),
    shorterNameBonus: jitter(parent.rank.shorterNameBonus, 0.02, 0.15),
  };

  // Keep ordinal sense: exact >= prefix >= fuzzy
  rank.prefix = Math.min(rank.prefix, rank.exact * 0.95);
  rank.fuzzy = Math.min(rank.fuzzy, rank.prefix * 0.9);

  const healing: HealingGene = {
    ...parent.healing,
    maxRetries: Math.round(clamp(parent.healing.maxRetries + (Math.random() > 0.7 ? 1 : 0), 1, 4)),
    retryBackoffMs: Math.round(jitter(parent.healing.retryBackoffMs, 150, 800)),
    weakFuzzyMinQueryLen: Math.round(
      clamp(parent.healing.weakFuzzyMinQueryLen + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0), 3, 7),
    ),
  };

  return {
    ...parent,
    generation: parent.generation + 1,
    updatedAt: new Date().toISOString(),
    rank,
    healing,
    queryAliases: { ...parent.queryAliases },
    companyAffinity: { ...parent.companyAffinity },
  };
}

export type FitnessSignals = {
  searchSuccess: number;
  searchEmpty: number;
  resultClickTop3: number;
  resultClickOther: number;
  healingRecoveries: number;
  healingFailures: number;
};

export function scoreFitness(s: FitnessSignals): number {
  const successRate =
    s.searchSuccess + s.searchEmpty > 0
      ? s.searchSuccess / (s.searchSuccess + s.searchEmpty)
      : 0.5;
  const clickQuality =
    s.resultClickTop3 + s.resultClickOther > 0
      ? s.resultClickTop3 / (s.resultClickTop3 + s.resultClickOther)
      : 0.5;
  const healRate =
    s.healingRecoveries + s.healingFailures > 0
      ? s.healingRecoveries / (s.healingRecoveries + s.healingFailures)
      : 0.5;
  return successRate * 0.45 + clickQuality * 0.4 + healRate * 0.15;
}
