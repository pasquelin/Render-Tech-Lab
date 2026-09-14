import type {LightingReport,LightingVariant} from '../contracts.ts';

const median=(values:Array<number|null>)=>{
  const sorted=values.filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);
  return sorted.length?sorted[Math.floor(sorted.length/2)]:null;
};
const display=(value:number|null)=>value===null?'Non mesuré':value.toFixed(2);
export function formatLightingReport(report:LightingReport):string{
  const variants:LightingVariant[]=['brute','bvh'];
  const incomplete=report.provenance.initialization==='failed'||report.provenance.initialization==='stopped';
  return [
    '# Banc 16 · Lumière','',`Campagne ${report.id} · ${report.timestamp}.`,
    `Équivalence A/A et A/B : ${report.quality.passed===null?'non testée':report.quality.passed?'réussie':'refusée'}. Statut : ${report.status}.`,
    ...(report.error?[`Motif : ${report.error}`]:[]),
    ...(incomplete?['Initialisation non achevée : aucun rendu ni mesure collectés ; les paramètres ci-dessous sont ceux demandés.']:[]),
    `Résolution ${report.protocol.width} × ${report.protocol.height}, DPR ${report.protocol.pixelRatio}, ${report.protocol.directLightSamples} échantillons par source, ${report.protocol.reflectionSamples} échantillons de reflet.`,
    `Plafond rAF observé au repos : ${display(report.observedRafCeilingHz??null)} Hz. Fréquence physique de l’écran non mesurée.`,
    '', '| Variante | CPU soumission médiane (ms) | GPU isolé médian (ms) | Intervalle rAF médian (ms) | FPS médians |',
    '|---|---:|---:|---:|---:|',
    ...variants.map(variant=>{
      const cadence=report.blocks.filter(b=>b.variant===variant&&b.kind==='cadence').flatMap(b=>b.frames);
      const isolated=report.blocks.filter(b=>b.variant===variant&&b.kind==='gpu-isolated').flatMap(b=>b.frames);
      return `| ${variant==='brute'?'Recherche exhaustive':'Arbre d’obstacles'} | ${display(median(cadence.map(f=>f.cpuSubmitMs)))} | ${display(median(isolated.map(f=>f.gpuMs)))} | ${display(median(cadence.map(f=>f.rafDeltaMs)))} | ${display(median(cadence.map(f=>f.fps)))} |`;
    }),
    '', 'Les passes de cadence réutilisent le même éclairage CPU. Leur temps CPU ne représente pas une scène dont la porte et les lampes changent à chaque image.',
    'CPU et GPU ne sont jamais additionnés. Captures, vérifications et archivage sont exclus des passes chronométrées.',
    '', '## Images', '',
    ...report.quality.captures.map(c=>`- ${c.scenario} : ${c.candidateDifferentPixels} pixels différents, écart maximal ${c.maxCandidateChannelError}/255 ; A/A ${c.repeatDifferentPixels} pixels différents.`),
    '', '## Portée', '', ...report.limitations.map(item=>`- ${item}`),
    '', incomplete?'Le rapport JSON conserve la tentative et son motif. Les informations de provenance non obtenues restent null ; aucune capture ni mesure n’est annoncée.':'Le rapport JSON contient les échantillons bruts, les captures PNG, les empreintes des sources, le matériel et les révisions des deux dépôts. Les copies des sources restent dans l’archive locale indiquée par provenance.sourceArchive.',
  ].join('\n');
}
