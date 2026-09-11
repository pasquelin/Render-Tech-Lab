/**
 * 09-gpu-compaction/types.ts
 *
 * Contrats de type du banc de compaction GPU : trois variantes à comparer
 * sans préjuger du meilleur (Master Test Plan §7-09).
 *
 * CAHIER DES CHARGES : aucune implémentation.
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
  /** Liste compactée d'indices (sans trous). */
  compactedIndices: number[];
  /** Taille de la liste compactée. */
  compactedCount: number;
  /** Temps de compaction (ms) — `null` si non mesuré. */
  timeMs?: number | null;
  /** Contention observée (proxy : nombre d'opérations atomiques). */
  atomicContention?: number | null;
  /** Bande passante (proxy : accès mémoire). */
  bandwidth?: number | null;
}

export interface CompactionBenchmarkRow {
  variant: CompactionVariant;
  inputCount: number;
  timeMs: number | null;
  compactedCount: number | null;
  atomicContention: number | null;
}
