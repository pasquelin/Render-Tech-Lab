/**
 * 09-gpu-compaction/benchmark/test_compaction.ts
 *
 * Banc d'analyse comparative multi-échelles pour 09-gpu-compaction.
 * Compare les 3 variantes de compaction : one-thread, atomicAdd, parallel-prefix-scan.
 */

import {
  executeCompaction,
  WGSL_COMPACTION_ATOMIC,
} from '../implementation/compaction.ts';
import type {
  CompactionVariant,
  CompactionBenchmarkRow,
} from '../types.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[09-gpu-compaction] Échec d'assertion : ${message}`);
  }
}

export function runCompactionSuite() {
  console.log('🚀 Lancement du banc 09-gpu-compaction (Multi-échelles 1k à 1M)...');

  assert(
    WGSL_COMPACTION_ATOMIC.includes('atomicAdd'),
    'Shader WGSL atomicAdd incomplet'
  );

  const scales = [1_000, 10_000, 100_000, 1_000_000];
  const variants: CompactionVariant[] = [
    'one-thread-per-command',
    'atomicAdd',
    'parallel-prefix-scan',
  ];

  const results: CompactionBenchmarkRow[] = [];

  for (const n of scales) {
    // Génération d'un motif 50% visible déterministe
    const flags = new Uint8Array(n);
    let expectedVisible = 0;
    for (let i = 0; i < n; i++) {
      flags[i] = i % 2 === 0 ? 1 : 0;
      if (flags[i] === 1) expectedVisible++;
    }

    console.log(`  Échelle N = ${n.toLocaleString()} instances (visibles : ${expectedVisible}) :`);

    for (const v of variants) {
      const output = executeCompaction({
        inputCount: n,
        visibleFlags: flags,
        variant: v,
      });

      assert(
        output.compactedCount === expectedVisible,
        `Comptage erroné pour ${v} sous N=${n} : ${output.compactedCount} !== ${expectedVisible}`
      );

      if (v !== 'one-thread-per-command') {
        assert(
          output.compactedIndices.length === expectedVisible,
          `La liste compactée ${v} doit avoir exactement la taille des éléments visibles`
        );
        assert(
          !output.compactedIndices.includes(-1),
          `La liste compactée ${v} ne doit contenir aucun trou`
        );
      }

      console.log(
        `    - [${v.padEnd(23)}] : Temps = ${output.timeMs?.toFixed(2)} ms | Contention = ${output.atomicContention} | Compactés = ${output.compactedCount}`
      );

      results.push({
        variant: v,
        inputCount: n,
        timeMs: output.timeMs ? Number(output.timeMs.toFixed(3)) : null,
        compactedCount: output.compactedCount,
        atomicContention: output.atomicContention ?? 0,
      });
    }
  }

  // Vérification de la contention atomique
  const atomic1M = results.find(
    (r) => r.variant === 'atomicAdd' && r.inputCount === 1_000_000
  )!;
  const scan1M = results.find(
    (r) => r.variant === 'parallel-prefix-scan' && r.inputCount === 1_000_000
  )!;

  assert(
    atomic1M.atomicContention! > 0,
    'atomicAdd doit accumuler de la contention sur 1M de threads'
  );
  assert(
    scan1M.atomicContention === 0,
    'parallel-prefix-scan doit avoir 0 contention atomique globale'
  );

  console.log('Tests CPU 09-gpu-compaction réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCompactionSuite();
}
