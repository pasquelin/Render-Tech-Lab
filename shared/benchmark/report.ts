import type { ComparisonResult } from './comparison.ts';

export function distribution(values: readonly (number | null)[]) {
  const sorted = values.filter((n): n is number => n !== null && Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  const quantile = (q: number) => sorted.length ? sorted[Math.ceil(q * sorted.length) - 1] : null;
  return { samples: sorted.length, median: quantile(0.5), p95: quantile(0.95), p99: quantile(0.99) };
}
export interface ComparisonRow { scene: { objects: number }; customMetrics: ComparisonResult }
const fmt = (value: number | null) => value === null ? 'n/a' : value.toFixed(4);
export function comparisonReport(records: readonly ComparisonRow[]): string {
  const lines = ['# Comparaison WebGPU', '', 'Mesures physiques. Aucun verdict de gain net déduit automatiquement. Les percentiles portent sur les échantillons de cette campagne ; ils ne constituent pas un intervalle de confiance.', '',
    '| Objets | Variante | Méthode | Échantillons | CPU médian (ms) | GPU médian (ms) | GPU P95 (ms) | GPU P99 (ms) | Latence complète médiane (ms) | GPU nuls (résolution) |',
    '|---:|---|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const { scene, customMetrics: r } of records) {
    const cpu = distribution(r.cpuMs), gpu = distribution(r.gpuMs), completion = distribution(r.completionMs);
    lines.push(`| ${scene.objects} | ${r.variant} | ${r.method} | ${r.validSamples} | ${fmt(cpu.median)} | ${fmt(gpu.median)} | ${fmt(gpu.p95)} | ${fmt(gpu.p99)} | ${fmt(completion.median)} | ${r.resolutionLimitedSamples} |`);
  }
  lines.push('', 'GPU : enveloppe des deux passes instrumentées, hors transferts initiaux et présentation. Le fallback queue-completion inclut CPU, queue et synchronisation ; il ne remplit jamais les colonnes GPU.');
  return lines.join('\n');
}

/** Standalone SVG, one series per injected strategy. Null observations are omitted. */
export function comparisonChart(records: readonly ComparisonRow[]): string {
  const variants = [...new Set(records.map(r => r.customMetrics.variant))];
  const counts = [...new Set(records.map(r => r.scene.objects))].sort((a, b) => a - b);
  const values = records.map(r => distribution(r.customMetrics.gpuMs).median);
  const max = Math.max(0.001, ...values.filter((v): v is number => v !== null));
  const colors = ['#2563eb', '#dc2626', '#059669', '#9333ea'];
  const x = (n: number) => 85 + counts.indexOf(n) * (700 / Math.max(1, counts.length - 1));
  const y = (n: number) => 320 - 240 * n / max;
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 430" role="img" aria-label="Durée GPU médiane par variante et nombre d’objets">', '<rect width="880" height="430" fill="white"/>', '<g font-family="system-ui" font-size="14" fill="#172033">', '<text x="30" y="30">Enveloppe GPU médiane (ms) — valeurs physiques uniquement</text>', '<path d="M85 65 V320 H810" fill="none" stroke="#64748b"/>'];
  for (let tick = 0; tick <= 4; tick++) parts.push(`<text x="15" y="${y(max * tick / 4) + 5}">${fmt(max * tick / 4)}</text>`);
  for (const count of counts) parts.push(`<text x="${x(count)}" y="345" text-anchor="middle">${count}</text>`);
  variants.forEach((variant, i) => {
    const color = colors[i % colors.length];
    const points = records.filter(r => r.customMetrics.variant === variant).sort((a, b) => a.scene.objects - b.scene.objects)
      .map(r => ({ count: r.scene.objects, value: distribution(r.customMetrics.gpuMs).median })).filter(p => p.value !== null);
    parts.push(`<polyline points="${points.map(p => `${x(p.count)},${y(p.value!)}`).join(' ')}" stroke="${color}" stroke-width="2" fill="none"/>`);
    for (const p of points) parts.push(`<circle cx="${x(p.count)}" cy="${y(p.value!)}" r="4" fill="${color}"/>`);
    parts.push(`<text x="${85 + i * 190}" y="390" fill="${color}">${escape(variant)}</text>`);
  });
  if (values.every(v => v === null)) parts.push('<text x="130" y="190">Temps GPU indisponible : consulter les latences dans le rapport.</text>');
  parts.push('</g></svg>');
  return parts.join('');
}
