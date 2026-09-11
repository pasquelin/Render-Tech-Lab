/**
 * 04-gpu-lod/benchmark/test_lod.ts
 *
 * Script CLI d'exécution automatisée pour 04-gpu-lod.
 * Exécute 04A, 04B, 04C, génère latest.json et archive le rapport Markdown.
 */

import fs from 'node:fs';
import path from 'node:path';
import { LodBenchmarkRunner } from './runner.ts';

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

  const rootDir = process.cwd();

  // 1. Sauvegarde des données brutes latest.json
  const resultsDir = path.resolve(rootDir, '04-gpu-lod', 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'latest.json'), JSON.stringify(latestJson, null, 2), 'utf-8');
  console.log('💾 Sauvegardé : 04-gpu-lod/results/latest.json');

  // 2. Sauvegarde du rapport local
  fs.writeFileSync(path.join(resultsDir, 'REPORT.md'), markdownReport, 'utf-8');
  console.log('💾 Sauvegardé : 04-gpu-lod/results/REPORT.md');

  // 3. Miroir dans reports/04-gpu-lod.md
  const reportsDir = path.resolve(rootDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, '04-gpu-lod.md'), markdownReport, 'utf-8');
  console.log('💾 Synchronisé : reports/04-gpu-lod.md');

  console.log('🏁 Banc 04-gpu-lod complété avec succès !');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
