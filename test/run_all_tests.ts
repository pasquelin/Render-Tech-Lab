/**
 * test/run_all_tests.ts
 *
 * Exécuteur maître consolidé de tous les bancs de test du laboratoire :
 * Exécute successivement et valide sans exception les 14 modules (00 à 13)
 * ainsi que les suites de validation mathématiques et d'oracles.
 */

import { runBaselineSuite } from '../00-baseline/benchmark/test_baseline.ts';
import { runIndirectSuite } from '../01-indirect-draw/benchmark/test_crossover.ts';
import { runCullingSuite } from '../02-gpu-frustum-culling/benchmark/test_culling.ts';
import { runSceneSuite } from '../03-gpu-scene/benchmark/test_scene.ts';
import { LodBenchmarkRunner } from '../04-gpu-lod/benchmark/runner.ts';
import { runMeshletsSuite } from '../05-meshlets/benchmark/test_meshlets.ts';
import { runMeshletCullingSuite } from '../06-meshlet-culling/benchmark/test_meshlet_culling.ts';
import { runHiZSuite } from '../07-hiz/benchmark/test_hiz.ts';
import { runOcclusionSuite } from '../08-occlusion-culling/benchmark/test_occlusion.ts';
import { runCompactionSuite } from '../09-gpu-compaction/benchmark/test_compaction.ts';
import { runMaterialBatchingSuite } from '../10-material-batching/benchmark/test_material_batching.ts';
import { runStreamingSuite } from '../11-geometry-streaming/benchmark/test_streaming.ts';
import { runVisibilityBufferSuite } from '../12-visibility-buffer/benchmark/test_visibility_buffer.ts';
import { runFullPipelineSuite } from '../13-full-gpu-driven/benchmark/test_full_pipeline.ts';

interface SuiteResult {
  name: string;
  durationMs: number;
  status: 'PASSED' | 'FAILED';
  error?: string;
}

async function runAllSuites() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       RENDER-TECH-LAB — CAMPAGNE DE VALIDATION COMPLÈTE (00 à 13)       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const suiteResults: SuiteResult[] = [];
  const globalStart = performance.now();

  const suites: { name: string; run: () => Promise<unknown> | unknown }[] = [
    { name: '00-baseline', run: runBaselineSuite },
    { name: '01-indirect-draw', run: runIndirectSuite },
    { name: '02-gpu-frustum-culling', run: runCullingSuite },
    { name: '03-gpu-scene', run: runSceneSuite },
    {
      name: '04-gpu-lod',
      run: async () => {
        const runner = new LodBenchmarkRunner();
        await runner.runFullSuite();
      },
    },
    { name: '05-meshlets', run: runMeshletsSuite },
    { name: '06-meshlet-culling', run: runMeshletCullingSuite },
    { name: '07-hiz', run: runHiZSuite },
    { name: '08-occlusion-culling', run: runOcclusionSuite },
    { name: '09-gpu-compaction', run: runCompactionSuite },
    { name: '10-material-batching', run: runMaterialBatchingSuite },
    { name: '11-geometry-streaming', run: runStreamingSuite },
    { name: '12-visibility-buffer', run: runVisibilityBufferSuite },
    { name: '13-full-gpu-driven', run: runFullPipelineSuite },
  ];

  for (const suite of suites) {
    console.log(`\n======================================================================`);
    console.log(`▶ BANC EN COURS : ${suite.name}`);
    console.log(`======================================================================`);
    const start = performance.now();
    try {
      await suite.run();
      const duration = performance.now() - start;
      suiteResults.push({
        name: suite.name,
        durationMs: duration,
        status: 'PASSED',
      });
    } catch (err: any) {
      const duration = performance.now() - start;
      console.error(`❌ ÉCHEC DU BANC ${suite.name} :`, err);
      suiteResults.push({
        name: suite.name,
        durationMs: duration,
        status: 'FAILED',
        error: err?.message || String(err),
      });
    }
  }

  const globalDuration = performance.now() - globalStart;

  console.log('\n\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   TABLEAU RÉCAPITULATIF DE CONFORMITÉ                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  let allPassed = true;
  for (const res of suiteResults) {
    const mark = res.status === 'PASSED' ? '✅' : '❌';
    console.log(
      `  ${mark} ${res.name.padEnd(26)} : ${res.status} (${res.durationMs.toFixed(1)} ms)`
    );
    if (res.status === 'FAILED') {
      allPassed = false;
      if (res.error) console.log(`     Erreur: ${res.error}`);
    }
  }

  console.log('──────────────────────────────────────────────────────────────────────────');
  console.log(`Durée totale de la campagne : ${(globalDuration / 1000).toFixed(2)} s`);

  if (!allPassed) {
    console.error('\n💥 La campagne de tests a échoué sur au moins un module.');
    process.exit(1);
  }

  console.log('\n🎉 TESTS CPU (00 à 13) RÉUSSIS — PERFORMANCE GPU NON ÉVALUÉE');
}

runAllSuites().catch((err) => {
  console.error('Erreur fatale lors de l exécution des tests :', err);
  process.exit(1);
});
