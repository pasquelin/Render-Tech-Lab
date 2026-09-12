/**
 * 09-gpu-compaction/contracts.ts
 *
 * Contrats de type du banc de compaction GPU : trois variantes à comparer
 * sans préjuger du meilleur (Master Test Plan §7-09).
 *
 * Les implémentations TypeScript sont des oracles CPU de justesse. Les temps
 * qu'elles retournent ne sont jamais des mesures GPU.
 */

export type CompactionVariant = 'one-thread-per-command' | 'atomicAdd' | 'parallel-prefix-scan';

export interface CompactionInput {
  /** Nombre de commandes initiales (N). */
  inputCount: number;
  /** Liste des indices visibles (bool[] ou Uint8Array). */
  visibleFlags: Uint8Array | boolean[];
  /** Variante testée. */
  variant: CompactionVariant;
}

export interface CompactionOutput {
  /** Nature de l'exécution, afin d'interdire toute confusion avec une mesure GPU. */
  execution: 'cpu-reference';
  /** Liste compactée d'indices (sans trous). */
  compactedIndices: number[];
  /** Taille de la liste compactée. */
  compactedCount: number;
  /** Temps de compaction (ms) — `null` si non mesuré. */
  timeMs?: number | null;
  /** Nombre logique d'opérations atomiques; ce n'est pas une mesure de contention matérielle. */
  atomicOperations?: number | null;
  /** Bande passante (proxy : accès mémoire). */
  bandwidth?: number | null;
}

export interface CompactionBenchmarkRow {
  variant: CompactionVariant;
  inputCount: number;
  timeMs: number | null;
  compactedCount: number | null;
  atomicOperations: number | null;
}

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
