import { BENCH_ENGINES } from '../../15-virtualized-integration/index.ts';
import { segmentNames, type EmeraldReport, type EmeraldStill } from './emeraldCampaign.ts';

const engineLabel = (id: string) => BENCH_ENGINES.find(engine => engine.id === id)?.label ?? id;
const value = (number: number | null, digits = 0) => number === null || !Number.isFinite(number) ? 'Non mesuré' : number.toFixed(digits);
const cell = (value: string | number) => String(value).replaceAll('|', '\\|');

function rowsFor(stills: EmeraldStill[]) {
  return [
    ['Moteur / backend', ...stills.map(still => `${engineLabel(still.engine)} / ${still.backend}`)],
    ['CPU frame (ms)', ...stills.map(still => value(still.cpuFrameMs, 2))],
    ['rAF (ms)', ...stills.map(still => value(still.rafIntervalMs, 2))],
    ['Draw calls', ...stills.map(still => value(still.drawCalls))],
    ['Triangles soumis', ...stills.map(still => value(still.triangles))],
    ['Triangles sélectionnés', ...stills.map(still => value(still.selectedTriangles))],
    ['Clusters', ...stills.map(still => value(still.clusters))],
    ['Pages résidentes', ...stills.map(still => value(still.residentPages))],
    ['Demandes de pages', ...stills.map(still => value(still.pagesRequested))],
    ['Chargements de pages', ...stills.map(still => value(still.pageLoads))],
    ['Évictions de pages', ...stills.map(still => value(still.pageEvictions))],
    ['Rejets frustum', ...stills.map(still => value(still.frustumRejected))],
  ];
}

function table(rows: Array<Array<string | number>>) {
  const columns = rows[0]?.length ?? 2;
  return [
    `| ${Array.from({ length: columns }, (_, index) => index === 0 ? 'Mesure' : `Moteur ${index}`).join(' | ')} |`,
    `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

/** Markdown archive for the common report reader. Raw JPEG captures remain in the Emerald evidence archive. */
export function formatEmeraldDiagnosticReport(report: EmeraldReport) {
  const engines = report.pathEngines.length ? report.pathEngines : [...new Set(report.captures.map(still => still.engine))];
  const capturePath = 'benchmark-runs/checks/emerald-path/latest.json';
  const sections = [
    '# 15-virtualized-integration — rapport de diagnostic',
    '',
    `Date : ${report.timestamp}. Statut : ${report.status}.`,
    '',
    '## Configuration reproductible',
    '',
    `- Trajet v${report.pathVersion} ; ${report.configuration.cities} ville(s) ; ${report.configuration.detail} ; LOD ${report.configuration.lodQuality}.`,
    `- Résolution : ${report.resolution.join(' × ')} px ; diagnostic : ${report.configuration.diagnostic} ; géométrie partagée : oui.`,
    `- Moteurs enchaînés : ${engines.map(engineLabel).join(', ') || 'Non renseigné'}.`,
    `- Source : ${report.sourceKey} ; environnement : ${report.environment}.`,
    '',
    '## Limites de preuve',
    '',
    `- ${report.comparisonReason || 'Pas un verdict de performance.'}`,
    '- CPU frame correspond à l’appel complet de rendu ; CPU submit, GPU et VRAM : non mesurés.',
    `- Les JPEG, poses exactes et données brutes de chaque image sont archivés dans \`${capturePath}\`.`,
    '',
    '## Comparaison par point de parcours',
  ];
  const segments = [...new Set(report.captures.map(still => still.segment))].sort((a, b) => a - b);
  if (!segments.length) sections.push('', 'Aucune image de contrôle n’a été capturée.');
  for (const segment of segments) {
    const stills = report.captures.filter(still => still.segment === segment);
    const representative = stills[0];
    if (!representative) continue;
    sections.push('', `### ${segmentNames[segment] ?? representative.name}`, '', `Pose : ${representative.pose.position.join(' / ')} vers ${representative.pose.target.join(' / ')} ; FOV ${representative.fov} ; near/far ${representative.near} / ${representative.far}.`, '', table(rowsFor(stills)));
  }
  sections.push('', '## Pistes de diagnostic', '', '- Un écart de draw calls, triangles, clusters ou rejets frustum indique où vérifier sélection, culling et découpage des pages.', '- Des demandes, chargements ou évictions de pages divergents signalent une résidence ou un streaming différent.', '- Un écart visuel doit être confronté aux JPEG et à la pose ci-dessus avant toute conclusion. Pas un verdict de performance.');
  return `${sections.join('\n')}\n`;
}
