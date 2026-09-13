import test from 'node:test';import assert from 'node:assert/strict';
import {urbanPath,urbanCheckpoints,pathPoses,streetLevel,framesPerSegment,segmentNames,distribution,retainReports,comparePathReports,stillsInReportComparable,stillFromFrame,pathVersion,type EmeraldReport} from '../src/lab/emeraldCampaign.ts';
test('urban replay is deterministic, has ten named segments and a fast rotation',()=>{const bounds={min:{x:-100,y:0,z:-100},max:{x:100,y:50,z:100}},a=urbanPath(bounds);assert.deepEqual(a,urbanPath(bounds));assert.equal(segmentNames.length,10);assert.equal(a.length,framesPerSegment*segmentNames.length);const rotation=a.filter(p=>p.segment===5);assert.notDeepEqual(rotation[0].pose.position,rotation.at(-1)!.pose.position);assert.deepEqual(a[0].pose.position,a.at(-1)!.pose.position);assert.notDeepEqual(a[0].pose,urbanPath({min:bounds.min,max:{x:400,y:50,z:400}})[0].pose);assert.equal(urbanCheckpoints(bounds).length,10);assert.deepEqual(pathPoses(bounds),a.map(step=>step.pose));});
test('urban path stays above the street when Emerald straddles y=0 with a basement and a height spike',()=>{
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
test('summaries contain actual percentiles and history retains two unique runs',()=>{assert.equal(distribution([]),null);assert.deepEqual(distribution([1,2,3,4,5,NaN]),{count:5,p50:3,p95:5,p99:5,max:5});const runs=Array.from({length:6},(_,i)=>({id:String(i)}));assert.deepEqual(retainReports(runs as never,{id:'2'} as never).map(r=>r.id),['2','0']);});
test('campaign reports preserve structured engine events for the report package',()=>{
 const value=report('exact-cluster-pages');
 assert.deepEqual(value.engineEvents,[]);
});
function report(engine:EmeraldReport['configuration']['engine'],mutator?:(value:EmeraldReport)=>void):EmeraldReport{
 const bounds={min:{x:-1,y:0,z:-1},max:{x:1,y:1,z:1}};
 const samples=urbanPath(bounds).map(step=>({segment:step.segment,elapsedMs:0,pose:step.pose,backend:engine,measurementKind:'official' as const,rafIntervalMs:16,cpuFrameMs:1,cpuSubmitMs:null,gpuMs:null,drawCalls:1,triangles:10,clusters:1,selectedTriangles:10,residentPages:1,geometryAllocationBytes:0,vramBytes:null,pageLoads:0,pageBytesRead:0}));
 const value:EmeraldReport={version:1,id:engine,timestamp:'2026-09-12T00:00:00.000Z',status:'completed',configuration:{cities:1,detail:'source',lodQuality:'high',mode:'path',camera:'orbit',diagnostic:'beauty',layout:'single',engine,compareEngine:'three-webgl-reference',poi:null,wipe:.5},pathEngines:[engine],sourceKey:'k',availableTriangles:1,sharedGeometry:true,multipliedInstances:1,resolution:[640,360],firstImageMs:1,preparationMs:1,warmupFrames:30,samples,captures:[],engineEvents:[],error:null,fallbacks:[],retainedSamplesOnly:false,environment:'test',pathVersion,comparison:'visual-only',comparisonReason:'blocked'};
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
 const still=stillFromFrame({segment:0,image:'data:image/jpeg;base64,xx',elapsedMs:12,pose,metrics:{rafIntervalMs:16,cpuFrameMs:1.5,cpuSubmitMs:null,gpuMs:null,drawCalls:4,triangles:100,clusters:8,selectedTriangles:90,residentPages:8,geometryAllocationBytes:1,vramBytes:null,pageLoads:2,pageBytesRead:3,pagesRequested:2,pageEvictions:0,frustumRejected:1},backend:'exact-cluster-pages',engine:'exact-cluster-pages',configuration:{cities:1,detail:'source',lodQuality:'high',mode:'path',camera:'orbit',diagnostic:'beauty',layout:'single',engine:'exact-cluster-pages',compareEngine:'three-webgl-reference',poi:null,wipe:.5},resolution:[640,360],sourceKey:'abc'});
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
