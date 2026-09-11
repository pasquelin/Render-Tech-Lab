import type { LodBenchmarkSummary } from '../types.ts';

export function formatLodMarkdownReport(summary: LodBenchmarkSummary,
  envInfo: { gpu: string; browser: string; commit: string }): string {
  const rows = summary.cpuSelection.objectCounts.map((n, i) =>
    `| ${n} | ${summary.cpuSelection.latenciesMs[i].toFixed(4)} | non mesuré |`).join('\n');
  return `# 04 — LOD : mesures CPU/WASM

Environnement : ${envInfo.browser}. GPU : ${envInfo.gpu}.
Verdict : not-yet-decided. Aucun benchmark de rendu GPU n'a été exécuté.

Décimation : ${summary.generation.durationMs.toFixed(3)} ms.
Triangles réellement obtenus : ${summary.generation.originalTriangles} / ${summary.generation.lod1Triangles} / ${summary.generation.lod2Triangles}.
Cet appel ne prouve pas un traitement hors thread UI ni une absence de saccades.

| Objets | Sélection CPU (ms) | Sélection GPU |
|---|---|---|
${rows}

Erreur projetée au point de contrôle : ${summary.contractualErrorCheck.maxObservedErrorPx} px.
Seuil : ${summary.contractualErrorCheck.thresholdPx} px.
Ce contrôle ponctuel ne constitue pas une borne visuelle globale.
`;
}
