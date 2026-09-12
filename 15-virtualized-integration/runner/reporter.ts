import type { IntegrationResult } from './index.ts';
const safe=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','/').replaceAll('\n',' ');
const duration=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(3):'non mesuré';
export function formatIntegrationReport(result:IntegrationResult,artifactId:string){
 const campaign=result.archive?.virtualized;
 const lines=['# 15 — Géométrie virtualisée : rapport', '',
  result.status==='measured'?'Les trois contrôles procéduraux ont été exécutés. Ce résultat valide leur fonctionnement sur la machine testée, sans conclure à un gain général.':'Campagne interrompue ou non exécutée. Les contrôles partiels et erreurs sont conservés.', '',
  'A dessine tous les triangles source. B choisit une représentation complète par région, puis lit les pages disponibles dans un pool GPU borné.', '',
  'Les images sont comparées exactement aux mêmes poses. La profondeur peut différer avec les niveaux de détail : sa différence et la borne géométrique projetée restent dans les données brutes.', '',
  '| Contrôle | État | Poses vérifiées | Évictions de pages |', '|---|---|---:|---:|'];
 for(const scenario of campaign?.scenarios??[]){const quality=Array.isArray(scenario.quality)?scenario.quality:[];
  const streaming=scenario.streaming as {evictions?:number}|undefined;
  const label=({'exact-resident':'Qualité exacte, tout résident','lod-resident':'Niveaux de détail, tout résident','streaming-pressure':'Cache sous pression'} as Record<string,string>)[String(scenario.id)]??safe(scenario.id);
  lines.push(`| ${label} | ${scenario.status==='measured'?'terminé':'non exécuté / partiel'} | ${quality.filter(q=>q.passed).length} | ${streaming?.evictions??'non mesuré'} |`);
 }
 lines.push('', 'Le cas sous pression conserve la surface avec les pages grossières. Il peut dépasser temporairement le budget de détail : ce dépassement est déclaré, pas considéré comme une qualité exacte.', '',
  '| Bloc | Encodage et soumission CPU (ms) | GPU (ms) |','|---|---:|---:|');
 for(const metric of result.records??[])lines.push(`| ${safe(metric.variant)} | ${duration(metric.cpuMs)} | ${duration(metric.gpuMs)} |`);
 lines.push('', 'Ces petits échantillons incluent une instrumentation de contrôle. Les temps GPU absents restent non mesurés. Le temps de frame complet inclut les attentes et les transferts ; il est distinct du temps CPU du tableau.', '',
  'La RAM et la VRAM physiques ne sont pas instrumentées. Les octets du pool sont une comptabilité des allocations. Les pages proviennent ici de la mémoire CPU ; les copies vers le GPU et les évictions sont réelles.', '',
  'Limites : petits reliefs statiques, opaques et sans éclairage. Aucune validation d’Emerald Square, de transparence, de déformation ou de scène urbaine complète.', '',
  `[Télécharger les données brutes et leur provenance](/api/integration-archive?id=${artifactId})`, '');
 for(const error of [...(result.archive?.errors??[]),...(campaign?.errors??[])])lines.push(`Erreur : ${safe(error)}`);
 return lines.join('\n');
}
