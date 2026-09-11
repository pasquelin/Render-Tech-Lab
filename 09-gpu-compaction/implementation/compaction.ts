/**
 * 09-gpu-compaction/implementation/compaction.ts
 *
 * Implémentation des 3 variantes de compaction GPU :
 * 1. One-thread-per-command (pas de compaction, drapeaux épars)
 * 2. AtomicAdd global (compaction directe avec contention mémoire)
 * 3. Parallel-prefix-scan (scan parallèle hiérarchique Blelloch sans contention)
 *
 * Réutilise l'oracle exclusiveScan de shared/math/compaction.ts.
 */

import { exclusiveScan, compact } from '../../shared/math/compaction.ts';
import type {
  CompactionVariant,
  CompactionInput,
  CompactionOutput,
  CompactionBenchmarkRow,
} from '../types.ts';

/**
 * Exécute la variante A : 1 thread par commande (sans compaction).
 * Les commandes non visibles subsistent dans le flux de draw.
 */
export function compactOneThreadPerCommand(
  inputCount: number,
  flags: Uint8Array | boolean[]
): CompactionOutput {
  const start = performance.now();
  const indices: number[] = [];
  let visibleCount = 0;

  for (let i = 0; i < inputCount; i++) {
    const isVis = flags[i] === 1 || flags[i] === true;
    if (isVis) {
      indices.push(i);
      visibleCount++;
    } else {
      indices.push(-1); // Trou / slot invalidé
    }
  }

  const duration = performance.now() - start;
  return {
    compactedIndices: indices,
    compactedCount: visibleCount,
    timeMs: duration,
    atomicContention: 0,
    bandwidth: inputCount * 4,
  };
}

/**
 * Exécute la variante B : Compaction atomique via atomicAdd.
 * Simule la contention mémoire sur l'adresse globale atomique.
 */
export function compactAtomicAdd(
  inputCount: number,
  flags: Uint8Array | boolean[]
): CompactionOutput {
  const start = performance.now();
  const compacted: number[] = [];
  let atomicCounter = 0;

  for (let i = 0; i < inputCount; i++) {
    const isVis = flags[i] === 1 || flags[i] === true;
    if (isVis) {
      compacted[atomicCounter++] = i;
    }
  }

  const duration = performance.now() - start;
  // Modèle de contention : proportionnel aux conflits atomiques des threads concurrents
  const contentionEstimate = Math.round(atomicCounter * Math.log2(Math.min(64, inputCount)));

  return {
    compactedIndices: compacted,
    compactedCount: atomicCounter,
    timeMs: duration,
    atomicContention: contentionEstimate,
    bandwidth: (inputCount + atomicCounter) * 4,
  };
}

/**
 * Exécute la variante C : Parallel prefix-scan (Blelloch 2-pass).
 * Zéro contention atomique grâce aux barrières de groupe de travail.
 */
export function compactParallelPrefixScan(
  inputCount: number,
  flags: Uint8Array | boolean[]
): CompactionOutput {
  const start = performance.now();
  const numericFlags = Array.from({ length: inputCount }, (_, i) =>
    flags[i] === 1 || flags[i] === true ? 1 : 0
  );

  const [offsets, total] = exclusiveScan(numericFlags);
  const compacted: number[] = new Array(total);

  for (let i = 0; i < inputCount; i++) {
    if (numericFlags[i] === 1) {
      compacted[offsets[i]] = i;
    }
  }

  const duration = performance.now() - start;

  return {
    compactedIndices: compacted,
    compactedCount: total,
    timeMs: duration,
    atomicContention: 0, // Zéro contention globale
    bandwidth: (inputCount * 2 + total) * 4,
  };
}

/**
 * Dispatch vers la variante demandée.
 */
export function executeCompaction(input: CompactionInput): CompactionOutput {
  switch (input.variant) {
    case 'one-thread-per-command':
      return compactOneThreadPerCommand(input.inputCount, input.visibleFlags);
    case 'atomicAdd':
      return compactAtomicAdd(input.inputCount, input.visibleFlags);
    case 'parallel-prefix-scan':
      return compactParallelPrefixScan(input.inputCount, input.visibleFlags);
  }
}

/**
 * Shaders WGSL pour atomicAdd vs prefix scan local.
 */
export const WGSL_COMPACTION_ATOMIC = /* wgsl */ `
@group(0) @binding(0) var<storage, read> isVisible : array<u32>;
@group(0) @binding(1) var<storage, read_write> outputIndices : array<u32>;
@group(0) @binding(2) var<storage, read_write> counter : atomic<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let idx = id.x;
  if (idx >= arrayLength(&isVisible)) { return; }

  if (isVisible[idx] == 1u) {
    let slot = atomicAdd(&counter, 1u);
    outputIndices[slot] = idx;
  }
}
`;
