import test from 'node:test';import assert from 'node:assert/strict';
import {defaultModelConfig,modelMeasurementKind,urbanPath,urbanCheckpoints,pathPoses,streetLevel,framesPerSegment,segmentNames,pathQueue,retainReports,comparePathReports,stillsInReportComparable,stillFromFrame,pathVersion,compareModelPixels,aaControlFromChecks,applyAaControlResult,runAaControl,truthFromModelReport,type ModelReport} from '../src/lab/modelCampaign.ts';
const aaPose={position:[0,0,0] as [number,number,number],target:[0,0,0] as [number,number,number],fov:55,near:.1,far:100};
test('urban replay is deterministic, has ten named segments and a fast rotation',()=>{const bounds={min:{x:-100,y:0,z:-100},max:{x:100,y:50,z:100}},a=urbanPath(bounds);assert.deepEqual(a,urbanPath(bounds));assert.equal(segmentNames.length,10);assert.equal(a.length,framesPerSegment*segmentNames.length);const rotation=a.filter(p=>p.segment===5);assert.notDeepEqual(rotation[0].pose.position,rotation.at(-1)!.pose.position);assert.deepEqual(a[0].pose.position,a.at(-1)!.pose.position);assert.notDeepEqual(a[0].pose,urbanPath({min:bounds.min,max:{x:400,y:50,z:400}})[0].pose);assert.equal(urbanCheckpoints(bounds).length,10);assert.deepEqual(pathPoses(bounds),a.map(step=>step.pose));});
test('urban path stays above the street when model geometry straddles y=0 with a basement and a height spike',()=>{
 const bounds={min:{x:-115,y:-5,z:-115},max:{x:115,y:108,z:115}};
 const path=urbanPath(bounds);
 for(const step of path){
  assert.ok(step.pose.position[1]>0,`segment ${step.segment} camera y=${step.pose.position[1]}`);
  assert.ok(step.pose.target[1]>0,`segment ${step.segment} target y=${step.pose.target[1]}`);
 }
 const street=path.filter(step=>step.segment===2);
 assert.ok(street.every(step=>step.pose.position[1]<8),'le segment sol reste à hauteur de piéton');
});
test('street level is the origin when the AABB crosses y=0, otherwise the floor',()=>{
 assert.equal(streetLevel({min:{y:-5},max:{y:108}}),0);
 assert.equal(streetLevel({min:{y:10},max:{y:40}}),10);
});
test('history retains two unique runs',()=>{const runs=Array.from({length:6},(_,i)=>({id:String(i)}));assert.deepEqual(retainReports(runs as never,{id:'2'} as never).map(r=>r.id),['2','0']);});
test('campaign reports preserve structured engine events for the report package',()=>{
 const value=report('exact-cluster-pages');
 assert.deepEqual(value.engineEvents,[]);
});
test('A/A control compares complete RGBA pixels and preserves the first failed checkpoint',()=>{
 const comparison=compareModelPixels(new Uint8Array([1,2,3,255,9,8,7,255]),new Uint8Array([1,4,3,255,9,8,7,255]));
 assert.deepEqual(comparison,{differentPixels:1,maxChannelError:2});
 const passed=aaControlFromChecks([{engine:'three-webgl-reference',segment:0,differentPixels:0,maxChannelError:0}]);
 assert.equal(passed.status,'passed');
 assert.equal(aaControlFromChecks([{engine:'three-webgl-reference',segment:0,differentPixels:0,maxChannelError:0}],2).status,'not-run');
 const failed=aaControlFromChecks([{engine:'three-webgl-reference',segment:0,...comparison}]);
 assert.equal(failed.status,'failed');
 assert.equal(aaControlFromChecks([{engine:'three-webgl-reference',segment:0,...comparison}],2).status,'failed');
 assert.match(failed.failure??'',/THREE\.js basic.*Vue générale du modèle.*1 pixel/);
});
test('A/A result synchronizes the machine-readable reason with a completed control',()=>{
 const update=applyAaControlResult({comparisonReason:'A/A non vérifié pour cette campagne. Le verdict de performance reste bloqué sans validation réelle.'},[{engine:'three-webgl-reference',segment:0,differentPixels:0,maxChannelError:0}]);
 assert.equal(update.aaControl.status,'passed');
 assert.equal(update.comparisonReason,'Contrôle A/A réussi pour cette campagne. Le verdict de performance reste bloqué : ce contrôle visuel ne valide pas la performance.');
});
test('A/A sequence waits for residency and flushes each identical capture before returning diagnostics',async()=>{
 const calls:string[]=[];
 const captures=[new Uint8Array([1,2,3,255]),new Uint8Array([1,4,3,255])];
 const checks=await runAaControl({setPose:()=>calls.push('pose'),awaitPages:async()=>{calls.push('pages');},flush:async()=>{calls.push('flush');},render:()=>calls.push('render'),capture:()=>{calls.push('capture');return captures.shift()!;}},'three-webgl-reference',[{segment:0,pose:aaPose}]);
 assert.deepEqual(calls,['pose','pages','render','flush','capture','render','flush','capture']);
 assert.deepEqual(checks,[{engine:'three-webgl-reference',segment:0,differentPixels:1,maxChannelError:2}]);
});
test('A/A sequence records later checkpoints after a divergent checkpoint',async()=>{
 let captures=0;
 const checks=await runAaControl({setPose:()=>{},awaitPages:async()=>{},flush:async()=>{},render:()=>{},capture:()=>new Uint8Array(captures++===0?[1,2,3,255]:[1,4,3,255])},'three-webgl-reference',[{segment:0,pose:aaPose},{segment:1,pose:aaPose}]);
 assert.equal(captures,4);
 assert.deepEqual(checks.map(check=>check.differentPixels),[1,0]);
});
function report(engine:ModelReport['configuration']['engine'],mutator?:(value:ModelReport)=>void):ModelReport{
 const bounds={min:{x:-1,y:0,z:-1},max:{x:1,y:1,z:1}};
 const samples=urbanPath(bounds).map(step=>({segment:step.segment,elapsedMs:0,pose:step.pose,backend:engine,measurementKind:'official' as const,rafIntervalMs:16,cpuFrameMs:1,cpuSubmitMs:null,gpuMs:null,drawCalls:1,triangles:10,clusters:1,selectedTriangles:10,residentPages:1,geometryAllocationBytes:0,vramBytes:null,pageLoads:0,pageBytesRead:0}));
 const value:ModelReport={version:1,id:engine,timestamp:'2026-09-12T00:00:00.000Z',status:'completed',configuration:{cities:1,detail:'source',lodQuality:'high',mode:'path',camera:'orbit',diagnostic:'beauty',layout:'single',engine,compareEngine:'three-webgl-reference',wipe:.5,measureWidth:640,measureHeight:360,pixelRatio:2,campaignName:'verite-test',engineOrder:'direct'},pathEngines:[engine],sourceKey:'k',availableTriangles:1,sharedGeometry:true,multipliedInstances:1,resolution:[640,360],firstImageMs:1,preparationMs:1,warmupFrames:30,samples,captures:[],engineEvents:[],error:null,fallbacks:[],retainedSamplesOnly:false,environment:'test',pathVersion,comparison:'visual-only',comparisonReason:'blocked',truth:null};
 mutator?.(value);return value;
}
test('engine comparison requires the same path, poses and resolution and never invents a verdict',()=>{
 assert.equal(comparePathReports(report('exact-cluster-pages'),report('three-webgl-reference')).status,'comparable');
 assert.equal(comparePathReports(report('exact-cluster-pages'),report('exact-cluster-pages')).status,'blocked');
 assert.equal(comparePathReports(report('exact-cluster-pages'),report('three-webgl-reference',value=>{value.resolution=[1,1];})).status,'blocked');
 assert.equal(comparePathReports(report('exact-cluster-pages'),report('three-webgl-reference',value=>{value.samples[3].pose={...value.samples[3].pose,fov:12};})).status,'blocked');
 assert.equal(comparePathReports(report('exact-cluster-pages',value=>{value.samples[0].gpuMs=1;}),report('three-webgl-reference')).status,'blocked');
 assert.equal(comparePathReports(report('exact-cluster-pages',value=>{value.configuration.modelId='new-york';}),report('three-webgl-reference',value=>{value.configuration.modelId='low-poly-city';})).status,'blocked');
});
test('a path campaign still records engine, pose and counters for each photo',()=>{
 const bounds={min:{x:-1,y:0,z:-1},max:{x:1,y:1,z:1}};
 const pose=urbanPath(bounds)[0].pose;
 const still=stillFromFrame({segment:0,image:'data:image/jpeg;base64,xx',elapsedMs:12,pose,metrics:{rafIntervalMs:16,cpuFrameMs:1.5,cpuSubmitMs:null,gpuMs:null,drawCalls:4,triangles:100,clusters:8,selectedTriangles:90,residentPages:8,geometryAllocationBytes:1,vramBytes:null,pageLoads:2,pageBytesRead:3,pagesRequested:2,cacheEvictions:0,frustumRejected:1},backend:'exact-cluster-pages',engine:'exact-cluster-pages',configuration:{cities:1,detail:'source',lodQuality:'high',mode:'path',camera:'orbit',diagnostic:'beauty',layout:'single',engine:'exact-cluster-pages',compareEngine:'three-webgl-reference',wipe:.5,measureWidth:640,measureHeight:360,pixelRatio:1,campaignName:'verite-test',engineOrder:'direct'},resolution:[640,360],sourceKey:'abc'});
 assert.equal(still.name,'Vue générale du modèle');
 assert.equal(still.engine,'exact-cluster-pages');
 assert.equal(still.gpuMs,null);
 assert.equal(still.triangles,100);
 assert.deepEqual(still.pose,pose);
 const campaign=report('exact-cluster-pages',value=>{
  value.pathEngines=['three-webgl-reference','exact-cluster-pages'];
  value.captures=[still,{...still,engine:'three-webgl-reference',backend:'three-webgl-reference'}];
 });
 const inside=stillsInReportComparable(campaign);
 assert.equal(inside.status,'comparable');
 assert.deepEqual(inside.engines,['exact-cluster-pages','three-webgl-reference']);
});

test('debug is enabled by default and its frame samples cannot be official measurements',()=>{
 assert.equal(defaultModelConfig.debug,true);
 assert.equal(modelMeasurementKind(defaultModelConfig),'diagnostic');
 assert.equal(modelMeasurementKind({...defaultModelConfig,debug:false}),'official');
 assert.equal(modelMeasurementKind({...defaultModelConfig,debug:false,diagnostic:'wireframe'}),'diagnostic');
});

test('la file du parcours suit l’ordre du protocole puis son inverse pour le sens retour',()=>{
 const engines=['three-webgl-reference','three-lod','exact-cluster-pages','webgpu-page-raster'] as const;
 assert.deepEqual(pathQueue(engines,'direct'),[...engines]);
 assert.deepEqual(pathQueue(engines,'reverse'),['webgpu-page-raster','exact-cluster-pages','three-lod','three-webgl-reference']);
});

test('le rapport de campagne de l’interface porte le même schéma que celui des scripts headless',()=>{
 const truth=truthFromModelReport(report('exact-cluster-pages'),{
  campaign:'verite-test',
  sdk:{commit:'a'.repeat(40),dirty:false,checkout:'/c',distPath:'/c/dist',contentHash:'h',generatedAt:null},
  machineLoad:{at:'2026-09-12T00:00:00.000Z',load1:1,load5:1,load15:1,thermal:null,chromeProcesses:1,compilerProcesses:0,viteProcesses:1},
  measurementMode:'summary',deviceWidth:1280,deviceHeight:720,
 });
 assert.equal(truth.schema,'banc15-truth-campaign/v1');
 assert.equal(truth.source,'ui');
 assert.equal(truth.campaign,'verite-test');
 assert.equal(truth.engineOrder,'direct');
 assert.equal(truth.measurementMode,'summary');
 assert.equal(truth.replicaCount,1);
 assert.equal(truth.resolution.cssWidth,640);
 assert.equal(truth.resolution.devicePixelRatio,2);
 assert.equal(truth.resolution.deviceWidth,1280);
 assert.equal(truth.sdk.commit,'a'.repeat(40));
 assert.equal(truth.sdk.dirty,false);
 assert.equal(truth.passes.length,1);
 assert.equal(truth.passes[0].engine,'exact-cluster-pages');
 assert.equal(truth.passes[0].gpuMs,null);
 assert.equal(truth.passes[0].vramBytes,null);
 assert.equal(truth.passes[0].raf?.p50,16);
 assert.equal(truth.aggregates[0].fps,1000/16);
 assert.equal(truth.aggregates[0].deltaPct,null);
 assert.equal(truth.refreshCeiling.hz,60);
});
