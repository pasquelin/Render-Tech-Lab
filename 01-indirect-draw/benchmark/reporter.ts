import type { CrossoverReport } from '../types.ts';
export function formatMarkdownReport(report: CrossoverReport, testId = '01-indirect-draw',
  testTitle = 'Comparaison système', gpuInfo = 'Identité non enregistrée'): string {
  const rows = [...report.classicResults, ...report.gpuDrivenResults].map(r =>
    `| ${r.mode} | ${r.objectCount} | ${r.samplesCount} | ${r.avgCpuFrameMs.toFixed(3)} | ${r.avgSubmitMs.toFixed(3)} | ${r.gpuFrameMs?.toFixed(3) ?? 'non mesuré'} | ${r.p95SubmitMs.toFixed(3)} | ${r.p99SubmitMs.toFixed(3)} | ${r.drawCalls} |`).join('\n');
  return `# ${testId} — ${testTitle}

Date : ${report.timestamp}. Matériel : ${gpuInfo}.
Verdict : not-yet-decided.
${report.analysis}

| Mode | Objets | Échantillons | CPU (ms) | Encodage + soumission CPU (ms) | Enveloppe GPU (ms) | P95 CPU | P99 CPU | Draws |
|---|---|---|---|---|---|---|---|---|
${rows}

Le temps GPU couvre reset/culling/raster ; les uploads et la présentation ne sont pas inclus.
Les FPS ne sont pas déduits du temps CPU. Les backends et matériaux diffèrent : aucune parité visuelle ni accélération isolée n'est déduite de cette comparaison.
`;
}
