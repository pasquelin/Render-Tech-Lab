import type { SceneComparisonResult } from './comparisonTypes.ts';

export type SavedComparison = SceneComparisonResult & {
  test: '04-gpu-lod-comparison';
  provenance: unknown;
};

export const VARIANT_LABELS: Record<string, string> = {
  reference: 'Référence 04B',
  prepared: 'Tangente partagée',
  guarded: 'Distance carrée avec repli (expérimental)',
};

function quantile(values: (number | null)[], probability: number): number | null {
  const sorted = values.filter((n): n is number => n !== null && Number.isFinite(n)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * probability)] : null;
}

export function comparisonRows(report: SceneComparisonResult) {
  return report.blocks.map(block => ({
    variant: VARIANT_LABELS[block.variant] ?? block.variant,
    frames: block.samples.length,
    select: quantile(block.samples.map(s => s.cpuSelectMs), 0.5),
    cpu: quantile(block.samples.map(s => s.cpuFrameWorkMs), 0.5),
    cpuP95: quantile(block.samples.map(s => s.cpuFrameWorkMs), 0.95),
    raf: quantile(block.samples.map(s => s.rafDeltaMs), 0.5),
    rafP95: quantile(block.samples.map(s => s.rafDeltaMs), 0.95),
    gpu: quantile(block.samples.map(s => s.gpuMs), 0.5),
  }));
}

export function milliseconds(value: number | null): string {
  return value === null ? 'non mesuré' : value.toFixed(3);
}

export function formatSceneComparison(report: SavedComparison): string {
  const rows = comparisonRows(report);
  return `# 04 · Comparaison des calculs sur une scène détaillée

Date : ${report.timestamp}

**Statut : mesures comparatives, aucune certification globale automatique.**

## Configuration réellement exécutée

\`\`\`json
${JSON.stringify(report.config, null, 2)}
\`\`\`

## Environnement et provenance

\`\`\`json
${JSON.stringify({ runtime: report.environment, sources: report.provenance }, null, 2)}
\`\`\`

## Comparaison par bloc

Durées en millisecondes. Chaque ligne correspond à un bloc après échauffement ; l'ordre des lignes est l'ordre réel d'exécution. Les quantiles utilisent l'indice zéro floor((N−1)×p). Les échantillons consécutifs sont corrélés ; ce tableau ne constitue pas à lui seul un test de significativité.

| Variante | Images | Sélection p50 | Travail CPU p50 | Travail CPU p95 | Intervalle rAF p50 | Intervalle rAF p95 | GPU p50 |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows.map(r => `| ${r.variant} | ${r.frames} | ${[r.select, r.cpu, r.cpuP95, r.raf, r.rafP95, r.gpu].map(milliseconds).join(' | ')} |`).join('\n')}

La sélection CPU est une partie du travail de frame. L'intervalle rAF mesure la cadence des callbacks et non la présentation physique. Un temps GPU absent reste non mesuré. Les éventuels échantillons à zéro reflètent la résolution du compteur ; ils ne signifient pas un travail gratuit. Les comparaisons de qualité et le contrôle exhaustif de la trajectoire sont effectués hors de la fenêtre de chronométrage.

## Géométrie et préparation

\`\`\`json
${JSON.stringify({ scene: report.scene, preparationMs: report.preparation }, null, 2)}
\`\`\`

Triangles réellement soumis, minimum–maximum des images mesurées. La passe principale et les ombres sont séparées ; leur somme ne représente pas des triangles uniques supplémentaires dans le modèle.

| Bloc | Passe principale | Ombres | Dessins au total |
|---|---:|---:|---:|
${report.blocks.map((b, i) => {
  const range = (key: 'mainPassTriangles' | 'shadowPassTriangles' | 'drawCalls') => {
    const values = b.samples.map(s => s[key]);
    return values.length ? `${Math.min(...values)}–${Math.max(...values)}` : 'non mesuré';
  };
  return `| ${i + 1} · ${VARIANT_LABELS[b.variant]} | ${range('mainPassTriangles')} | ${range('shadowPassTriangles')} | ${range('drawCalls')} |`;
}).join('\n')}

## Contrôle des résultats et de l'image

\`\`\`json
${JSON.stringify(report.quality, null, 2)}
\`\`\`

## Portée du résultat

Il s'agit d'une scène de stress procédurale rendue par le banc du projet. Elle ne représente pas tous les assets et toutes les fonctionnalités possibles. Les dimensions physiques, charge, options et versions ci-dessus définissent la portée de cette campagne. Une répétition à configuration identique et les cas de la matrice documentaire restent nécessaires pour conclure à un gain reproductible.

La tangente partagée conserve l'expression numérique de la référence. La variante de distances carrées reste expérimentale : sa démonstration est conditionnelle aux hypothèses numériques documentées dans variants.ts ; la réussite de cette scène ne certifie pas tous les moteurs JavaScript.

Les données brutes compressées, les compteurs de géométrie, les journaux et les comparaisons visuelles sont conservés dans le paquet de rapport associé. Les campagnes précédentes sont archivées dans reports/04-gpu-lod-comparison/. Aucun résultat de ce rapport ne remplace implicitement les conclusions des autres bancs.

Limites enregistrées par le moteur de mesure :

${report.limitations.map(limit => `- ${limit}`).join('\n')}
`;
}
