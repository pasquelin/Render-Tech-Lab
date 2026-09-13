import type { ModuleDescriptor } from '../../shared/contracts/presentation.ts';
export const VIRTUALIZED_MODULE:ModuleDescriptor={
 id:'15-virtualized-integration',number:'15',name:'Pipeline de géométrie virtualisée',subtitle:'La sélection de clusters et les pages physiques conservent-elles la surface ?',
 badge:'Prototype vérifiable',telemetryMode:'WebGPU natif · clusters et pages',telemetryDetail:'Scène procédurale certifiée · comparaison A/B',
  description:'Fixture procédurale validée : comparaison du rendu source et du module virtualisé avec clusters hiérarchiques, sélection WebGPU, dessin indirect, pages, cache et évictions. L’exploration des modèles préparés propose séparément la navigation dans les scènes réelles, un parcours reproductible et une comparaison visuelle synchronisée. Le verdict de performance reste bloqué par le contrôle A/A.',
  technicalPrinciple:'Hiérarchie → erreur écran → culling GPU → compactage → pages → dessin indirect',
  options:[{val:'procedural-three-cases',label:'Fixture procédurale',selected:true},{val:'models',label:'Modèles préparés'}],
 benchLabel:'Exécuter les 3 contrôles',metricsPills:[],stats:{objects:'64 régions prévues',submit:'non mesuré',cpuFrame:'non mesuré',fps:'non mesuré',drawCalls:'non mesuré'},
};
