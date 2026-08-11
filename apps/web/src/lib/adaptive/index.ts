export {
  DEFAULT_GENOME,
  loadGenome,
  saveGenome,
  mutateGenome,
  scoreFitness,
  type PlatformGenome,
  type RankWeightGene,
  type HealingGene,
  type FitnessSignals,
} from "@/lib/adaptive/platform-genome";

export {
  recordAdaptiveEvent,
  loadSignals,
  recentEvents,
  type AdaptiveEvent,
  type AdaptiveEventType,
} from "@/lib/adaptive/user-signals";

export {
  maybeEvolveGenome,
  getActiveGenome,
  harvestQueryAliases,
} from "@/lib/adaptive/evolution-engine";

export {
  withSelfHealing,
  type HealableResult,
} from "@/lib/adaptive/self-healing";

export {
  resolveAdaptiveQuery,
  adaptiveMedicineScore,
  adaptiveRankMedicineResults,
} from "@/lib/adaptive/adaptive-rank";

export {
  buildAnonBatch,
  flushAdaptiveBeacon,
  startAdaptiveBeacon,
} from "@/lib/adaptive/signal-beacon";
