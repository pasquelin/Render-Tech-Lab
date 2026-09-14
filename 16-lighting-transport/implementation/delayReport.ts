import type { LightingDelayEventId, LightingDelayReport } from '../contracts.ts';

const display = (value: number | null) => (value === null ? 'Non mesuré' : value.toFixed(1));
const provenanceValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'Non mesuré';
  if (typeof value === 'object') return `\`${JSON.stringify(value)}\``;
  return `\`${String(value)}\``;
};

function eventLabel(id: LightingDelayEventId): string {
  return { 'door-closes': 'Porte ouverte → fermée', 'door-opens': 'Porte fermée → ouverte', 'lamp-off': 'Extinction de la lampe chaude' }[id];
}

export function formatLightingDelayReport(report: LightingDelayReport): string {
  const events: LightingDelayEventId[] = [...new Set(report.sequences.map(sequence => sequence.event))];
  const incomplete = report.status !== 'measured';
  const lines: string[] = [
    '# Banc 16 · Lumière — Retard de réponse lumineuse',
    '',
    `Campagne ${report.id} · ${report.timestamp}. Statut : ${report.status}.`,
    ...(report.error ? [`Motif : ${report.error}`] : []),
    ...(incomplete ? ['Campagne incomplète : seules les séquences ci-dessous ont été calculées et archivées.'] : []),
    '',
    '## Ce que ce scénario montre',
    '',
    ...report.scope.shows.map(item => `- ${item}`),
    '',
    '## Ce que ce scénario ne montre pas',
    '',
    ...report.scope.doesNotShow.map(item => `- ${item}`),
    '',
    '## Verdict à renseigner',
    '',
    'Pour chaque événement, ouvrir sa vidéo par retard croissant et indiquer à partir de quel retard le décalage devient perceptible ou gênant.',
    '',
    '| Événement | Retard D (ms) | τ95 mesuré · indirect (ms) | τ95 mesuré · radiance (ms) | Acceptable (oui / non) | Commentaire |',
    '|---|---:|---:|---:|---|---|',
    ...report.sequences.map(sequence => `| ${eventLabel(sequence.event)} | ${sequence.delayMs} | ${display(sequence.tau95IndirectMs)} | ${display(sequence.tau95RadianceMs)} | à renseigner | |`),
    '',
    'τ95 est mesuré directement sur les tableaux mélangés (temps où l’erreur maximale face à l’état B tombe sous 5 % de l’amplitude du saut) ; il doit être proche du retard D demandé si le mélange fait ce qu’il annonce.',
    '',
    '## Vidéos par événement',
    '',
  ];
  for (const event of events) {
    lines.push(`### ${eventLabel(event)}`, '');
    const sheet = report.contactSheets.find(item => item.event === event);
    if (sheet) lines.push(`[Planche contact](${sheet.url})`, '');
    for (const sequence of report.sequences.filter(item => item.event === event)) {
      lines.push(`- Retard ${sequence.delayMs} ms · ${sequence.frameCount} images · [vidéo](${sequence.videoUrl}) (${sequence.videoBytes === null ? 'taille non mesurée' : `${Math.round(sequence.videoBytes / 1024)} kio`})`);
    }
    lines.push('');
  }
  lines.push(
    '## Protocole',
    '',
    `Résolution ${report.protocol.width} × ${report.protocol.height}, DPR ${report.protocol.pixelRatio}, ${report.protocol.raysPerPatch} rayons par patch, ${report.protocol.directLightSamples} échantillons directs, ${report.protocol.reflectionSamples} échantillons GGX. États A et B indépendants (\`warmStart:false\`), même qualité pour les deux.`,
    `Caméra fixe · pose « ${report.delayProtocol.cameraLabel} ». Pas de temps simulé 1/${report.delayProtocol.fps} s, ${report.delayProtocol.preRollFrames} images avant t0, ${report.delayProtocol.postRollFrames} images après. Mélange exponentiel visant ${Math.round(report.delayProtocol.targetConvergence * 100)} % du saut à t0 + D ; seuil de vérification τ95 : ${Math.round(report.delayProtocol.errorThreshold * 100)} % de l’amplitude.`,
    '',
    '## Provenance',
    '',
    `- Commit SDK : ${provenanceValue(report.provenance.sdkCommit)}`,
    `- Commit Lab : ${provenanceValue(report.provenance.labCommit)}`,
    `- Clé de fixture : ${provenanceValue(report.provenance.fixtureKey)}`,
    `- Préparation SDK : ${provenanceValue(report.provenance.preparationMs)} ms`,
    `- Géométrie : ${provenanceValue(report.provenance.geometry)}`,
    `- Matériel : ${provenanceValue(report.provenance.hardware)}`,
    `- Navigateur/GPU : ${provenanceValue(report.environment.renderer)} · ${provenanceValue(report.environment.vendor)} · ${provenanceValue(report.environment.webglVersion)}`,
    `- DPR déclaré : ${provenanceValue(report.environment.devicePixelRatio)}`,
    '',
    '## Portée',
    '',
    ...report.limitations.map(item => `- ${item}`),
  );
  return lines.join('\n');
}
