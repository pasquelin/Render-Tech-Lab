import { BENCH_ENGINES } from '../../15-virtualized-integration/index.ts';
import { aaControlReason, segmentNames, type ModelReport, type ModelStill } from './modelCampaign.ts';

const engineLabel = (id: string) => BENCH_ENGINES.find(engine => engine.id === id)?.label ?? id;
const value = (number: number | null, digits = 0) => number === null || !Number.isFinite(number) ? 'Non mesuré' : number.toFixed(digits);
const cell = (value: string | number) => String(value).replaceAll('|', '\\|');

function rowsFor(stills: ModelStill[]) {
  return [
    ['Moteur / backend', ...stills.map(still => `${engineLabel(still.engine)} / ${still.backend}`)],
    ['CPU frame (ms)', ...stills.map(still => value(still.cpuFrameMs, 2))],
    ['CPU submit (ms)', ...stills.map(still => value(still.cpuSubmitMs ?? null, 2))],
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

/** Human view; the archive adds links to raw data, the complete journal and capture galleries. */
export function formatModelDiagnosticReport(report: ModelReport) {
  const engines = report.pathEngines.length ? report.pathEngines : [...new Set(report.captures.map(still => still.engine))];
  const sections = [
    '# 15-virtualized-integration — rapport de diagnostic',
    '',
    `Date : ${report.timestamp}. Statut : ${report.status}.`,
    '',
    '## Configuration reproductible',
    '',
    `- Trajet v${report.pathVersion} ; ${report.configuration.cities} instance(s) du modèle ; ${report.configuration.detail} ; LOD ${report.configuration.lodQuality}.`,
    `- Résolution : ${report.resolution.join(' × ')} px ; diagnostic : ${report.configuration.diagnostic} ; géométrie partagée : oui.`,
    `- Moteurs enchaînés : ${engines.map(engineLabel).join(', ') || 'Non renseigné'}.`,
    `- Source : ${report.sourceKey} ; environnement : ${report.environment}.`,
    '',
    `- Debug : ${report.configuration.debug ? 'actif ; instrumentation détaillée, temps de diagnostic' : 'désactivé ou non enregistré dans cette ancienne campagne'}.`,
    '',
    '## Limites de preuve',
    '',
    `- ${aaControlReason(report)}`,
    '- CPU frame correspond à l’appel synchrone de rendu. Les tâches différées sont journalisées séparément ; leurs durées ne doivent pas être additionnées sans tenir compte des chevauchements.',
    `- CPU submit : ${report.samples.filter(sample => typeof sample.cpuSubmitMs === 'number' && Number.isFinite(sample.cpuSubmitMs)).length} / ${report.samples.length} images renseignées.`,
    report.engineEvents.some(event => event.phase === 'engine:gpu-timing') ? '- GPU : durées par passe dans le journal ; aucune durée GPU complète par image. VRAM physique : non mesurée.' : '- GPU et VRAM : non mesurés.',
    ...(report.configuration.debug ? ['- Mode debug actif : le coût de l’instrumentation affecte ces mesures ; elles ne constituent pas un verdict de performance.'] : []),
    '- Évictions WebGL : sorties de la liste affichée. Les évictions des caches CPU/GPU et les octets transférés sont journalisés séparément.',
    `- Enregistrements : ${report.samples.length} images mesurées, ${report.captures.length} captures, ${report.engineEvents.length} événements moteur.`,
    '- Les données brutes et poses exactes sont conservées dans le fichier compressé. Le journal complet et les captures sont accessibles par les liens et la galerie de ce rapport.',
    '',
    '## Comparaison par point de parcours',
  ];
  const segments = [...new Set(report.captures.map(still => still.segment))].sort((a, b) => a - b);
  if (!segments.length) sections.push('', 'Aucune image de contrôle n’a été capturée.');
  for (const segment of segments) {
    const stills = report.captures.filter(still => still.segment === segment);
    const representative = stills[0];
    if (!representative) continue;
    sections.push('', `### ${segmentNames[segment] ?? representative.name}`, '', `Position X/Y/Z : ${representative.pose.position.join(' / ')} ; Cible X/Y/Z : ${representative.pose.target.join(' / ')} ; FOV ${representative.fov}° ; plans ${representative.near} / ${representative.far}.`, '', table(rowsFor(stills)));
  }
  sections.push('', '## Pistes de diagnostic', '', '- Un écart de draw calls, triangles, clusters ou rejets frustum indique où vérifier sélection, culling et découpage des pages.', '- Des demandes, chargements ou évictions de pages divergents signalent une résidence ou un streaming différent.', '- Un écart visuel doit être confronté aux JPEG et à la pose ci-dessus avant toute conclusion. Pas un verdict de performance.');
  return `${sections.join('\n')}\n`;
}
