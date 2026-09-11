/**
 * shared/benchmark/reporter.ts
 *
 * Sérialise et rend lisibles les résultats d'un banc.
 *
 * Règle absolue : ne jamais réécrire ni compléter une valeur non mesurée.
 * Si un champ est `null`, il est conservé tel quel dans la sortie (JSON) et
 * affiché comme « — » (dash) dans le Markdown.
 */

import type { BenchResultRecord } from './types.ts';

export interface ReporterOptions {
  /** Chemin relatif attendu pour `latest.json` (information, non écrit ici). */
  outputPath?: string;
}

/**
 * Convertit la liste de résultats en JSON conforme au schéma `latest.json`
 * du Master Test Plan (une entrée par palier).
 */
export function toLatestJson(records: BenchResultRecord[]): string {
  return JSON.stringify(records, null, 2) + '\n';
}

function fmt(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${value}${suffix}`;
}

function fmtMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value < 0.05) return '< 0.05 ms';
  return `${value.toFixed(2)} ms`;
}

function fmtBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Rend le rapport Markdown lisible. Aucune valeur est inventée : les nulls
 * sont rendus comme des tirets. Si le banc n'a pas été exécuté, le rapport
 * le signale explicitement.
 */
export function toMarkdownReport(records: BenchResultRecord[]): string {
  if (records.length === 0) {
    return `# Rapport de banc\n\n_Aucun résultat à consigner._\n`;
  }

  const test = records[0].test;
  const commit = records[0].commit ?? 'unknown';
  const allNotRun = records.every((r) => r.status === 'not-run');

  const lines: string[] = [];
  lines.push(`# Rapport de banc — ${test}`);
  lines.push('');
  lines.push(`- Commit : \`${commit}\``);
  lines.push(`- Paliers : ${records.length}`);
  lines.push(`- Statut global : **${allNotRun ? 'NOT-RUN (aucune mesure)' : 'MESURÉ'}**`);
  lines.push('');

  const environment = records[0].environment;
  lines.push('## Environnement');
  lines.push('');
  lines.push(`- GPU : ${environment.gpu ?? '—'}`);
  lines.push(`- Browser : ${environment.browser ?? '—'}`);
  lines.push(`- Three.js : ${environment.threeVersion ?? '—'}`);
  lines.push('');

  lines.push('## Résultats par palier');
  lines.push('');
  lines.push('| Palier | Statut | Objets | Triangles | CPU frame | Submit | P95 | FPS | Draw (sub/vis) | GPU bytes | Verdict |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');

  for (const r of records) {
    const tierLabel = r.scene?.objects ?? '—';
    const status = r.status === 'not-run' ? 'not-run' : 'measured';
    const draw = `${r.draw?.submitted ?? '—'} / ${r.draw?.visible ?? '—'}`;
    const verdict = r.verdict ?? '—';

    lines.push(
      `| ${tierLabel} | ${status} | ${fmt(r.scene.objects)} | ${fmt(r.scene.triangles)} | ` +
      `${fmtMs(r.cpu?.frameMs)} | ${fmtMs(r.cpu?.submitMs)} | ${fmtMs(r.cpu?.p95Ms)} | ${fmt(r.cpu?.fps)} | ` +
      `${draw} | ${fmtBytes(r.memory?.gpuBytes)} | ${verdict} |`
    );
  }

  lines.push('');
  lines.push('## Métriques spécifiques');
  lines.push('');

  for (const r of records) {
    const custom = (r.customMetrics ?? {}) as Record<string, unknown>;
    const entries = Object.entries(custom).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) continue;
    lines.push(`- **Palier ${r.scene?.objects ?? '?'}** : ` + entries.map(([k, v]) => `${k}=${String(v)}`).join(', '));
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Rapport généré par `shared/benchmark/reporter.ts`. Aucune valeur n\'est inventée : les champs `—` sont des métriques non mesurées._');

  return lines.join('\n');
}
