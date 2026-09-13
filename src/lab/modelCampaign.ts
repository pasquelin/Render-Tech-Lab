import type { CameraPose, FrameMetrics } from '@web-geometry/sdk/browser';
import {LOD_QUALITY, type LodQualityId} from '@web-geometry/sdk';
import {BENCH_ENGINES, benchmarkModels, type BenchEngineId} from '../../15-virtualized-integration/index.ts';
export type ModelLayout='single'|'comparison'|'wipe'|'toggle'|'difference';
export type ModelConfig={debug?:boolean;modelId?:string;cities:1|4|9|12;detail:'source'|'maximum';lodQuality:LodQualityId;mode:'explore'|'path';camera:'orbit'|'free';diagnostic:'beauty'|'wireframe'|'clusters'|'pages'|'lod'|'visibility'|'screen-error';layout:ModelLayout;engine:BenchEngineId;compareEngine:BenchEngineId;wipe:number};
export const defaultModelConfig:ModelConfig={debug:true,modelId:benchmarkModels[0]?.id??'',cities:1,detail:'source',lodQuality:'high',mode:'explore',camera:'orbit',diagnostic:'beauty',layout:'single',engine:'exact-cluster-pages',compareEngine:'three-webgl-reference',wipe:.5};
export function modelMeasurementKind(config:Pick<ModelConfig,'debug'|'diagnostic'>):'official'|'diagnostic'{return config.debug||config.diagnostic!=='beauty'?'diagnostic':'official';}
export const segmentNames=['Vue générale du modèle','Approche de la géométrie','Déplacement au niveau de référence','Matériaux et transparences','Gros plan sur une géométrie détaillée','Rotation rapide de caméra','Révélation d’une zone cachée','Déplacement rapide et chargement','Forte pression de pages','Retour vers une zone visitée'];
export const framesPerSegment=60;
export const warmupFrames=30;
export const pathVersion=5;
/** Origin plane if the geometry straddles y=0; otherwise the AABB floor. */
export function streetLevel(bounds:{min:{y:number};max:{y:number}}){
 return bounds.min.y<0&&bounds.max.y>0?0:bounds.min.y;
}
export function urbanPath(bounds:{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}):Array<{pose:CameraPose;segment:number;nominalMs:number;fov:number;warmup:number;measured:number}>{
 const min=bounds.min,max=bounds.max,cx=(min.x+max.x)/2,cz=(min.z+max.z)/2,sx=max.x-min.x,sy=max.y-min.y,sz=max.z-min.z,radius=Math.hypot(sx,sy,sz)/2;
 const ground=streetLevel(bounds),block=Math.max(sx,sz),eye=Math.max(block*0.008,sy>0?Math.min(2,sy*0.03):1.6);
 const points=[[.72,28,.78],[.2,8,.26],[.05,1.2,.08],[-.08,1.7,.12],[-.03,1.5,.04],[-.03,1.5,.04],[.3,10,-.26],[-.38,8,-.36],[-.48,12,.46],[.72,28,.78]];
 const positionAt=(p:[number,number,number]):CameraPose['position']=>[cx+p[0]*sx,Math.max(ground+eye,ground+p[1]*eye),cz+p[2]*sz];
 const target:CameraPose['target']=[cx,ground+eye*2,cz];
 return segmentNames.flatMap((_,segment)=>Array.from({length:framesPerSegment},(_,frame)=>{
  const t=frame/(framesPerSegment-1),a=points[segment],b=points[segment+1]??points[0];
  const pose:CameraPose={position:positionAt(a.map((v,i)=>v+(b[i]-v)*t) as [number,number,number]),target,fov:55,near:Math.max(radius/10000,.01),far:radius*20};
  if(segment===5){
   const angle=t*Math.PI*1.5,radiusXZ=Math.hypot(a[0],a[2]);
   pose.position=positionAt([Math.cos(angle)*radiusXZ,a[1],Math.sin(angle)*radiusXZ]);
  }
  return {segment,nominalMs:(segment*framesPerSegment+frame)*1000/30,fov:pose.fov,warmup:warmupFrames,measured:framesPerSegment,pose};
 }));
}
export function pixelErrorFor(config:ModelConfig,speed=0,radius=1){
 const preset=LOD_QUALITY[config.lodQuality];
 const base=config.lodQuality==='source'&&config.detail==='maximum'?0:preset.pixelError;
 if(!preset.adaptive)return base;
 return base*(1+Math.min(4,speed/Math.max(radius/8,1e-6)));
}
export type ModelSample=FrameMetrics&{segment:number;elapsedMs:number;pose:CameraPose;backend:string;measurementKind:'official'|'diagnostic'};
export type ModelStill={
 segment:number;name:string;image:string;takenAt:string;elapsedMs:number;pose:CameraPose;
 resolution:[number,number];engine:string;backend:string;diagnostic:ModelConfig['diagnostic'];
 lodQuality:LodQualityId;cities:1|4|9|12;detail:'source'|'maximum';sourceKey:string;pathVersion:typeof pathVersion;
 fov:number;near:number;far:number;
 cpuFrameMs:number|null;cpuSubmitMs:number|null;rafIntervalMs:number|null;drawCalls:number|null;
 triangles:number|null;selectedTriangles:number|null;clusters:number|null;residentPages:number|null;
 pageEvictions:number|null;frustumRejected:number|null;pagesRequested:number|null;pageLoads:number|null;
 gpuMs:null;vramBytes:null;
};
export type ModelEngineEvent={timestamp:string;level:'debug'|'info'|'warn'|'error';phase:string;message:string;context:Record<string,unknown>};
export type ModelAaCheck={engine:string;segment:number;differentPixels:number;maxChannelError:number};
export type ModelAaControl={status:'passed'|'failed'|'not-run';checks?:ModelAaCheck[];failure?:string};
export type ModelReport={version:1;id:string;timestamp:string;status:'completed'|'stopped'|'error';configuration:ModelConfig;pathEngines:string[];sourceKey:string;availableTriangles:number;sharedGeometry:true;multipliedInstances:1|4|9|12;resolution:[number,number];firstImageMs:number|null;preparationMs:number|null;warmupFrames:number;samples:ModelSample[];captures:ModelStill[];engineEvents:ModelEngineEvent[];error:string|null;fallbacks:string[];retainedSamplesOnly:boolean;environment:string;pathVersion:typeof pathVersion;comparison:'visual-only'|'measured'|'unavailable'|'blocked';comparisonReason:string;aaControl?:ModelAaControl;};

export function compareModelPixels(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)throw new Error(`Captures A/A de tailles différentes : ${a.length} et ${b.length} octets.`);
 let differentPixels=0,maxChannelError=0;
 for(let offset=0;offset<a.length;offset+=4){let different=false;for(let channel=0;channel<4;channel++){
  const delta=Math.abs(a[offset+channel]-b[offset+channel]);
  if(delta)different=true;
  if(delta>maxChannelError)maxChannelError=delta;
 }if(different)differentPixels++;}
 return {differentPixels,maxChannelError};
}

export type ModelAaRenderer={setPose:(pose:CameraPose)=>void;awaitPages:()=>Promise<void>;render:(pose:CameraPose)=>unknown;flush:()=>Promise<void>;capture:()=>Uint8Array};
export async function runAaControl(renderer:ModelAaRenderer,engine:string,checkpoints:Array<{segment:number;pose:CameraPose}>):Promise<ModelAaCheck[]>{
 const checks:ModelAaCheck[]=[];
 for(const checkpoint of checkpoints){
  renderer.setPose(checkpoint.pose);
  await renderer.awaitPages();
  renderer.render(checkpoint.pose);
  await renderer.flush();
  const first=renderer.capture();
  renderer.render(checkpoint.pose);
  await renderer.flush();
  const repeat=renderer.capture();
  const check={engine,segment:checkpoint.segment,...compareModelPixels(first,repeat)};
  checks.push(check);
 }
 return checks;
}

export function aaControlFromChecks(checks:ModelAaCheck[],expectedChecks=checks.length):ModelAaControl{
 const failed=checks.find(check=>check.differentPixels>0);
 if(!checks.length)return {status:'not-run',checks};
 if(!failed&&checks.length<expectedChecks)return {status:'not-run',checks};
 if(!failed)return {status:'passed',checks};
 const engine=BENCH_ENGINES.find(candidate=>candidate.id===failed.engine)?.label??failed.engine;
 const segment=segmentNames[failed.segment]??`Point ${failed.segment+1}`;
 return {status:'failed',checks,failure:`${engine} · ${segment} : ${failed.differentPixels} pixel${failed.differentPixels>1?'s':''} différent${failed.differentPixels>1?'s':''}, écart de canal maximal ${failed.maxChannelError}.`};
}

export function aaControlReason(report:Pick<ModelReport,'aaControl'|'comparisonReason'>){
 if(report.aaControl?.status==='passed')return 'Contrôle A/A réussi pour cette campagne. Le verdict de performance reste bloqué : ce contrôle visuel ne valide pas la performance.';
 if(report.aaControl?.status==='failed')return `Contrôle A/A échoué pour cette campagne${report.aaControl.failure?` : ${report.aaControl.failure}`:''}. Le verdict de performance reste bloqué sans validation réelle.`;
 if(report.aaControl?.status==='not-run')return 'A/A non vérifié pour cette campagne. Le verdict de performance reste bloqué sans validation réelle.';
 return report.comparisonReason||'A/A non vérifié pour cette campagne. Le verdict de performance reste bloqué sans validation réelle.';
}
export function applyAaControlResult(report:Pick<ModelReport,'comparisonReason'>,checks:ModelAaCheck[],expectedChecks=checks.length):{aaControl:ModelAaControl;comparisonReason:string}{
 const aaControl=aaControlFromChecks(checks,expectedChecks);
 return {aaControl,comparisonReason:aaControlReason({aaControl,comparisonReason:report.comparisonReason})};
}
export function distribution(values:number[]){const sorted=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);if(!sorted.length)return null;const q=(p:number)=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];return {count:sorted.length,p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)!};}
export function summarizeModel(samples:ModelSample[]){const intervals=samples.flatMap(s=>s.rafIntervalMs!==null&&s.rafIntervalMs>0?[s.rafIntervalMs]:[]);return {cpuSubmit:distribution(samples.flatMap(s=>typeof s.cpuSubmitMs==='number'?[s.cpuSubmitMs]:[])),cpu:distribution(samples.map(s=>s.cpuFrameMs)),raf:distribution(intervals),minFps:intervals.length?1000/Math.max(...intervals):null,gpu:distribution(samples.flatMap(s=>s.gpuMs===null?[]:[s.gpuMs])),frames:samples.length};}
export function retainReports(previous:ModelReport[],report:ModelReport){return [report,...previous.filter(r=>r.id!==report.id)].slice(0,2);}
export function pathPoses(bounds:{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}){return urbanPath(bounds).map(step=>step.pose);}
export function urbanCheckpoints(bounds:{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}){return urbanPath(bounds).filter((_,index)=>index%framesPerSegment===0);}
function poseEqual(a:CameraPose,b:CameraPose){return a.fov===b.fov&&a.near===b.near&&a.far===b.far&&a.position.every((v,i)=>v===b.position[i])&&a.target.every((v,i)=>v===b.target[i]);}
/** Same trajectory for every engine. Never invents a performance verdict. */
export function comparePathReports(a:ModelReport,b:ModelReport){
 if(a.pathVersion!==b.pathVersion)return {status:'blocked' as const,reason:'Versions de parcours différentes.'};
 if((a.configuration.modelId??(benchmarkModels[0]?.id??''))!==(b.configuration.modelId??(benchmarkModels[0]?.id??'')))return {status:'blocked' as const,reason:'Modèles différents.'};
 if(a.resolution[0]!==b.resolution[0]||a.resolution[1]!==b.resolution[1])return {status:'blocked' as const,reason:'Résolutions différentes.'};
 if(a.configuration.cities!==b.configuration.cities||a.configuration.lodQuality!==b.configuration.lodQuality||a.configuration.detail!==b.configuration.detail)return {status:'blocked' as const,reason:'Configuration de scène différente.'};
 if(a.configuration.engine===b.configuration.engine)return {status:'blocked' as const,reason:'Les deux campagnes utilisent le même moteur.'};
 if(a.samples.length!==b.samples.length||!a.samples.length)return {status:'blocked' as const,reason:'Nombre d’échantillons différent ou vide.'};
 if(!a.samples.every((sample,index)=>sample.segment===b.samples[index].segment&&poseEqual(sample.pose,b.samples[index].pose)))return {status:'blocked' as const,reason:'Poses ou segments différents.'};
 const gpuClaimed=a.samples.some(sample=>sample.gpuMs!==null)||b.samples.some(sample=>sample.gpuMs!==null);
 if(gpuClaimed)return {status:'blocked' as const,reason:'Un temps GPU est présent alors que le parcours du modèle ne l’instrumente pas.'};
 return {status:'comparable' as const,reason:'Même parcours, mêmes poses et même résolution. Pas un verdict de performance : le contrôle A/A du modèle complet reste instable.'};
}
export function stillFromFrame(input:{
 segment:number;image:string;elapsedMs:number;pose:CameraPose;metrics:FrameMetrics;backend:string;engine:string;
 configuration:ModelConfig;resolution:[number,number];sourceKey:string;
}):ModelStill{
 const {configuration,pose,metrics}=input;
 return {
  segment:input.segment,name:segmentNames[input.segment]??`Point ${input.segment+1}`,image:input.image,takenAt:new Date().toISOString(),elapsedMs:input.elapsedMs,pose,
  resolution:input.resolution,engine:input.engine,backend:input.backend,diagnostic:configuration.diagnostic,
  lodQuality:configuration.lodQuality,cities:configuration.cities,detail:configuration.detail,sourceKey:input.sourceKey,pathVersion,
  fov:pose.fov,near:pose.near,far:pose.far,
  cpuFrameMs:metrics.cpuFrameMs,cpuSubmitMs:metrics.cpuSubmitMs??null,rafIntervalMs:metrics.rafIntervalMs,drawCalls:metrics.drawCalls,
  triangles:metrics.triangles,selectedTriangles:metrics.selectedTriangles??null,clusters:metrics.clusters,residentPages:metrics.residentPages??null,
  pageEvictions:metrics.pageEvictions??null,frustumRejected:metrics.frustumRejected??null,pagesRequested:metrics.pagesRequested??null,pageLoads:metrics.pageLoads,
  gpuMs:null,vramBytes:null,
 };
}
export function stillsComparable(a:ModelReport,b:ModelReport){
 if(a.pathVersion!==b.pathVersion)return {status:'blocked' as const,reason:'Versions de parcours différentes.',segments:[] as number[]};
 if((a.configuration.modelId??(benchmarkModels[0]?.id??''))!==(b.configuration.modelId??(benchmarkModels[0]?.id??'')))return {status:'blocked' as const,reason:'Modèles différents.',segments:[] as number[]};
 if(a.resolution[0]!==b.resolution[0]||a.resolution[1]!==b.resolution[1])return {status:'blocked' as const,reason:'Résolutions différentes.',segments:[] as number[]};
 if(a.configuration.cities!==b.configuration.cities||a.configuration.lodQuality!==b.configuration.lodQuality||a.configuration.detail!==b.configuration.detail||a.configuration.diagnostic!==b.configuration.diagnostic)return {status:'blocked' as const,reason:'Configuration ou vue de diagnostic différente.',segments:[] as number[]};
 if(a.configuration.engine===b.configuration.engine)return {status:'blocked' as const,reason:'Les deux campagnes utilisent le même moteur.',segments:[] as number[]};
 const segments=a.captures.flatMap(still=>{
  const other=b.captures.find(item=>item.segment===still.segment);
  return other&&poseEqual(still.pose,other.pose)?[still.segment]:[];
 });
 if(!segments.length)return {status:'blocked' as const,reason:'Aucune capture au même point de parcours.',segments:[] as number[]};
 return {status:'comparable' as const,reason:'Mêmes points de parcours et même résolution. Comparaison visuelle uniquement, pas un verdict de performance.',segments};
}
export function enginesInStills(report:ModelReport){return [...new Set(report.captures.map(still=>still.engine))];}
export function stillsInReportComparable(report:ModelReport){
 const engines=enginesInStills(report);
 if(engines.length<2)return {status:'blocked' as const,reason:'Un seul moteur capturé.',engines,segments:[] as number[]};
 const segments=[...new Set(report.captures.map(still=>still.segment))].filter(segment=>engines.every(engine=>report.captures.some(still=>still.segment===segment&&still.engine===engine)));
 if(!segments.length)return {status:'blocked' as const,reason:'Aucune capture commune à tous les moteurs.',engines,segments:[] as number[]};
 return {status:'comparable' as const,reason:'Parcours unique, un passage par moteur, mêmes poses. Comparaison visuelle uniquement, pas un verdict de performance.',engines,segments};
}
