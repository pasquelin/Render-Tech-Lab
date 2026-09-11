import type { GpuSceneBenchResult, SceneStressConfig } from '../types.ts';

/**
 * Rapport Markdown du module 03, généré à partir des mesures réelles.
 *
 * Règle de gouvernance : chaque cellule provient d'un échantillon mesuré. Une
 * grandeur non instrumentée s'écrit « n/a » — jamais une estimation, qui
 * deviendrait indiscernable d'une mesure une fois publiée.
 */

function fmtMs(v: number | null): string {
  return v === null ? 'n/a' : `${v.toFixed(3)} ms`;
}

function fmtInt(v: number | null): string {
  return v === null ? 'n/a' : v.toLocaleString('fr-FR');
}

function fmtMB(v: number | null): string {
  return v === null ? 'n/a' : `${(v / (1024 * 1024)).toFixed(2)} Mo`;
}

function scenarioKey(c: SceneStressConfig): string {
  return `${c.objectCount}|${c.geometryCount}|${c.materialCount}|${c.dynamicRatio}`;
}

export function formatGpuSceneReport(
  results: GpuSceneBenchResult[],
  gpuInfo: string = 'WebGPU'
): string {
  // Appariement Test A / Test B par scénario, dans l'ordre de la campagne.
  const pairs: { config: SceneStressConfig; classic?: GpuSceneBenchResult; gpu?: GpuSceneBenchResult }[] = [];
  const byKey = new Map<string, (typeof pairs)[number]>();

  for (const r of results) {
    const key = scenarioKey(r.config);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { config: r.config };
      byKey.set(key, entry);
      pairs.push(entry);
    }
    if (r.mode === 'classic') entry.classic = r;
    else entry.gpu = r;
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const lines: string[] = [];
  lines.push('# Bench Report: 03-gpu-scene');
  lines.push('');
  lines.push(
    '**Technique under test:** Heterogeneous GPU Scene (`ObjectBuffer`, `GeometryBuffer`, `MaterialBuffer`, Multi-Draw Indirect)  '
  );
  lines.push(`**Bench last updated:** ${now} UTC  `);
  lines.push(`**Environment:** ${gpuInfo}`);
  lines.push('');
  lines.push(
    '> **Governing rule:** every figure below is produced by the in-app harness. Cells marked `n/a` are not instrumented and are deliberately left unmeasured rather than estimated.'
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  if (pairs.length === 0) {
    lines.push('## Aucune mesure enregistrée');
    lines.push('');
    lines.push(
      "Lancez la campagne depuis le banc (« Matrice 4D Complète » ou « Stress Topologies ») pour générer ce rapport."
    );
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## 1. Matrice de stress — mesures A/B');
  lines.push('');
  lines.push(
    '| Scénario | Objets | Topologies | Matériaux | Submit Test A | Submit Test B | Speed-up | Frame A | Frame B | Draw calls A | Draw calls B |'
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  for (const p of pairs) {
    const a = p.classic;
    const b = p.gpu;
    const speedup =
      a && b && b.avgCpuSubmitMs > 0 ? `${(a.avgCpuSubmitMs / b.avgCpuSubmitMs).toFixed(1)}×` : 'n/a';
    lines.push(
      `| ${p.config.name} | ${p.config.objectCount} | ${p.config.geometryCount} | ${p.config.materialCount} ` +
        `| ${fmtMs(a ? a.avgCpuSubmitMs : null)} | ${fmtMs(b ? b.avgCpuSubmitMs : null)} | ${speedup} ` +
        `| ${fmtMs(a ? a.avgCpuFrameMs : null)} | ${fmtMs(b ? b.avgCpuFrameMs : null)} ` +
        `| ${fmtInt(a ? a.drawCalls : null)} | ${fmtInt(b ? b.drawCalls : null)} |`
    );
  }

  lines.push('');
  lines.push('## 2. Culling GPU et empreinte VRAM (Test B)');
  lines.push('');
  lines.push('| Scénario | Objets visibles | Objets culled | VRAM tampons de scène | GPU Test B | GPU Test B |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const p of pairs) {
    const b = p.gpu;
    lines.push(
      `| ${p.config.name} | ${fmtInt(b ? b.visibleObjects : null)} | ${fmtInt(b ? b.culledObjects : null)} | ${fmtMB(
        b ? b.gpuMemoryBytes : null
      )} | ${fmtMs(b?.gpuFrameMs ?? null)} |`
    );
  }

  lines.push('');
  lines.push('## 3. Protocole');
  lines.push('');
  lines.push('- 10 frames de warmup puis 30 frames échantillonnées par mode et par scénario.');
  lines.push('- Test A et Test B suivent le même protocole, sur la même instance de navigateur, le même GPU et la même résolution de canvas.');
  lines.push('- La boucle d\'animation est neutralisée pendant la campagne pour ne pas soumettre de frames non mesurées.');
  lines.push('- Disposition de scène déterministe (générateur à graine fixe), donc rejouable à l\'identique.');
  lines.push('- GPU Test B mesure par timestamp-query l’enveloppe compute/raster quand disponible ; les autres colonnes de temps mesurent le CPU. Les moteurs WebGL et WebGPU diffèrent : aucun gain algorithmique isolé n’est déduit.');
  lines.push('');

  return lines.join('\n');
}
