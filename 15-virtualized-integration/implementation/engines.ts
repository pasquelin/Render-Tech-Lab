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
 {id:'three-webgl-reference',label:'Three.js',factory:referenceBackend,comparable:true,note:'Référence sans géométrie virtualisée.'},
 {id:'exact-cluster-pages',label:'WebGeometry',factory:exactPagesBackend,comparable:true,note:'Clusters, hiérarchie, culling CPU, pages et résidence.'},
 {id:'three-lod',label:'THREE.LOD',factory:threeLodBackend,comparable:true,note:'Niveaux de détail Three.js, distances dérivées du rayon ; unités différentes du pixelError WebGeometry.'},
 {id:'webgpu-page-raster',label:'WebGPU',factory:webgpuPagesBackend,comparable:false,note:'Raster de pages WebGPU ; PBR texturé non équivalent, exclu du verdict visuel.'},
];
export const PATH_CAMPAIGN_ENGINES:readonly BenchEngineId[]=BENCH_ENGINES.filter(engine=>engine.comparable).map(engine=>engine.id);
export function pathCampaignFactories(){return PATH_CAMPAIGN_ENGINES.map(id=>benchEngine(id).factory);}

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
