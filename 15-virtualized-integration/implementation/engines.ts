import {COMPARISON_LIBRARIES, type CompetitorRecord} from '@web-geometry/sdk';
import {referenceBackend,exactPagesBackend,threeLodBackend,webgpuPagesBackend,type BackendFactory} from '@web-geometry/sdk/browser';

export type BenchEngineId='three-webgl-reference'|'exact-cluster-pages'|'three-lod'|'webgpu-page-raster';

export interface BenchEngine {
 id:BenchEngineId;
 label:string;
 factory:BackendFactory;
 comparable:boolean;
 note:string;
}

export const BENCH_ENGINES:readonly BenchEngine[]=[
 {id:'three-webgl-reference',label:'THREE.js basic',factory:referenceBackend,comparable:true,note:'Rendu Three.js standard, sans géométrie virtualisée : point de départ de la comparaison.'},
 {id:'three-lod',label:'THREE.js LOD',factory:threeLodBackend,comparable:true,note:'Niveaux de détail classiques avec toute la géométrie chargée. Disponible en exploration libre, pas dans le parcours automatique.'},
 {id:'exact-cluster-pages',label:'WebGeometry WebGL',factory:exactPagesBackend,comparable:true,note:'Clusters hiérarchiques, culling CPU, pages et résidence : moteur WebGeometry virtualisé.'},
 {id:'webgpu-page-raster',label:'WebGeometry WebGPU',factory:webgpuPagesBackend,comparable:false,note:'Raster de pages WebGPU : sélection compute, visbuffer et Hi-Z. Matériaux PBR non équivalents, donc hors verdict visuel.'},
];
/** Parcours urbain : référence, LOD classique, virtualisation WebGL, virtualisation WebGPU. */
export const PATH_CAMPAIGN_ENGINES:readonly BenchEngineId[]=['three-webgl-reference','three-lod','exact-cluster-pages','webgpu-page-raster'];
/** Transforme une sélection de moteurs en factories, commune au libre et au parcours. */
export function engineFactories(ids:readonly BenchEngineId[]){return ids.map(id=>benchEngine(id).factory);}
export function pathCampaignFactories(){return engineFactories(PATH_CAMPAIGN_ENGINES);}

export function benchEngine(id:string){
 const engine=BENCH_ENGINES.find(item=>item.id===id);
 if(!engine)throw new Error(`Unknown bench engine: ${id}`);
 return engine;
}

export function competitorMatrix():readonly CompetitorRecord[]{
 return COMPARISON_LIBRARIES;
}

export function factoriesFor(engine:BenchEngineId,compare:BenchEngineId,diagnostic:string):BackendFactory[]{
 const needed=new Set<BenchEngineId>(['three-webgl-reference',engine,compare]);
 if(diagnostic==='clusters'||diagnostic==='pages'||diagnostic==='lod'||diagnostic==='visibility'||diagnostic==='screen-error')needed.add('exact-cluster-pages');
 return [...needed].map(id=>benchEngine(id).factory);
}

/** THREE.LOD distances need every mesh resident; the WebGPU page raster streams the visible cut. */
export function needsResidentPages(engine:BenchEngineId,compare:BenchEngineId){
 return engine==='three-lod'||compare==='three-lod';
}

export function selectableBackend(engine:BenchEngineId,diagnostic:string,available:readonly string[]){
 const want=(diagnostic==='beauty'||diagnostic==='wireframe')?engine:engine==='webgpu-page-raster'?'webgpu-page-raster':'exact-cluster-pages';
 return available.includes(want)?want:available.includes('three-webgl-reference')?'three-webgl-reference':available[0];
}
