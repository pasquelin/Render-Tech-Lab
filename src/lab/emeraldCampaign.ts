import type { CameraPose, FrameMetrics } from '@web-geometry/sdk/browser';
export type EmeraldConfig={cities:1|4|9;detail:'source'|'maximum';mode:'explore'|'path';camera:'orbit'|'free';diagnostic:'beauty'|'wireframe'|'clusters'|'pages';layout:'single'|'comparison'};
export const defaultEmeraldConfig:EmeraldConfig={cities:1,detail:'source',mode:'explore',camera:'orbit',diagnostic:'beauty',layout:'single'};
export const segmentNames=['Vue d’ensemble','Approche urbaine','Passage bas','Changement de visibilité','Gros plan','Déplacement rapide','Arrêt','Reprise et extension'];
export const framesPerSegment=60;
export const warmupFrames=30;
export function urbanPath(bounds:{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}):Array<{pose:CameraPose;segment:number;nominalMs:number}>{
 const min=bounds.min,max=bounds.max,c=[(min.x+max.x)/2,(min.y+max.y)/2,(min.z+max.z)/2],s=[max.x-min.x,max.y-min.y,max.z-min.z],radius=Math.hypot(...s)/2;
 const points=[[.8,.8,1.1],[.25,.16,.35],[.1,.07,.15],[-.15,.09,.1],[-.08,.05,-.02],[-.4,.12,-.4],[.6,.35,-.5],[.6,.35,-.5],[.8,.8,1.1]];
 return segmentNames.flatMap((_,segment)=>Array.from({length:framesPerSegment},(_,frame)=>{
  const t=segment===6?0:frame/(framesPerSegment-1),a=points[segment],b=points[segment+1];
  return {segment,nominalMs:(segment*framesPerSegment+frame)*1000/30,pose:{position:[c[0]+(a[0]+(b[0]-a[0])*t)*s[0],min.y+(a[1]+(b[1]-a[1])*t)*s[1],c[2]+(a[2]+(b[2]-a[2])*t)*s[2]],target:[c[0],min.y+s[1]*.08,c[2]],fov:55,near:Math.max(radius/10000,.01),far:radius*20}};
 }));
}
export type EmeraldSample=FrameMetrics&{segment:number;elapsedMs:number;pose:CameraPose;backend:string};
export type EmeraldReport={version:1;id:string;timestamp:string;status:'completed'|'stopped'|'error';configuration:EmeraldConfig;sourceKey:string;availableTriangles:number;resolution:[number,number];firstImageMs:number|null;preparationMs:number|null;warmupFrames:number;samples:EmeraldSample[];captures:Array<{segment:number;pose:CameraPose;image:string}>;error:string|null;fallbacks:string[];retainedSamplesOnly:boolean;environment:string;pathVersion:1;comparison:'unavailable';};
export function distribution(values:number[]){const sorted=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);if(!sorted.length)return null;const q=(p:number)=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];return {count:sorted.length,p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)!};}
export function summarizeEmerald(samples:EmeraldSample[]){const intervals=samples.flatMap(s=>s.rafIntervalMs!==null&&s.rafIntervalMs>0?[s.rafIntervalMs]:[]);return {cpu:distribution(samples.map(s=>s.cpuFrameMs)),raf:distribution(intervals),minFps:intervals.length?1000/Math.max(...intervals):null,gpu:distribution(samples.flatMap(s=>s.gpuMs===null?[]:[s.gpuMs])),frames:samples.length};}
export function retainReports(previous:EmeraldReport[],report:EmeraldReport){return [report,...previous.filter(r=>r.id!==report.id)].slice(0,5);}
