/**
 * 04-gpu-lod/tests/test_lod.ts
 *
 * Script CLI d'exécution automatisée pour 04-gpu-lod.
 * Exécute 04A, 04B, 04C et archive un paquet de rapport autonome.
 */

import { LodBenchmarkRunner } from '../runner/index.ts';
import { writeReportArchive } from '../../shared/archive/index.ts';

async function main() {
  console.log('🚀 Lancement du banc 04-gpu-lod (04A/B/C)...');

  const runner = new LodBenchmarkRunner();
  const { summary, markdownReport, latestJson } = await runner.runFullSuite();

  console.log('📊 Résultats de la campagne 04-gpu-lod :');
  console.log(`  - 04A Décimation : ${summary.generation.durationMs.toFixed(1)} ms, −${summary.generation.memorySavedPercent.toFixed(1)}% triangles`);
  console.log(`  - 04B Sélection CPU : ${summary.cpuSelection.latenciesMs[1].toFixed(2)} ms (2k objets)`);
  const gpuTimes = summary.gpuSelection.computeTimesMs;
  console.log(`  - 04C Sélection GPU : ${gpuTimes ? gpuTimes[1].toFixed(2) + ' ms (2k objets)' : 'non instrumenté'}`);
  console.log(`  - Contrôle d'erreur SSE : ${summary.contractualErrorCheck.maxObservedErrorPx.toFixed(2)} px (seuil <= ${summary.contractualErrorCheck.thresholdPx} px) => ${summary.contractualErrorCheck.passed ? 'CONFORME' : 'NON CONFORME'}`);

  const archive = await writeReportArchive(process.cwd(), { testId: '04-gpu-lod', markdown: markdownReport, latest: latestJson });
  console.log(`💾 Paquet de rapport : ${archive.reportPath}`);

  console.log('🏁 Banc 04-gpu-lod complété avec succès !');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
