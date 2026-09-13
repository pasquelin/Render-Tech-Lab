import * as THREE from 'three';
import { TimestampBatch } from '../../shared/gpu/timing.ts';
import { buildClusterAsset, PAGE_BYTES, selectRegion, regionErrorPx } from './geometryAsset.ts';
import { ClusterGpu } from './clusterGpu.ts';
import { active, bounded, nextFrame, compareImages, cadence, summarize } from '../scenarios/protocol.ts';
import type { IntegratedRunOptions, IntegratedMetric } from '../../shared/benchmark/integratedRunners.ts';

export async function runVirtualizedCampaign(options:IntegratedRunOptions){
 const configurations=[{id:'exact-resident',threshold:0,slots:128},{id:'lod-resident',threshold:2,slots:128},{id:'streaming-pressure',threshold:0,slots:72}];
 const metrics:IntegratedMetric[]=[];
 const archive:{assetPreparationMs:number|null;configuration:Record<string,unknown>;metrics:IntegratedMetric[];schema:number;scope:string;status:string;errors:string[];scenarios:Array<Record<string,unknown>>;certificate:string;provenance:Record<string,string>}= {
  assetPreparationMs:null,configuration:{fixture:'dyadic-tents-v1',regions:64,width:640,height:360,samples:options.samples??4,warmup:0,order:'ABBA',timingScope:'instrumented smoke; no performance verdict',seed:null},metrics,schema:2,scope:'physical two-level dyadic tent hierarchy, opaque static unlit patches; not arbitrary/general meshes',status:'not-run',errors:[],scenarios:[],certificate:'',provenance:{
   gpuMs:'real per-frame timestamp envelope; null without timestamp-query',cpuSubmitMs:'CPU command encoding and queue.submit only',
   frameWallMs:'includes feedback readback, streaming fence wait and real uploads; serialized reference implementation',
   ramBytes:'null; not instrumented',vramBytes:'null; pool allocation bytes are API allocation accounting, not physical VRAM',
   bytesRead:'actual bytes copied from in-memory page source; not disk/network',quality:'exact RGBA8 compared at all poses; depth max error measured separately; projected geometry bound is analytic, not image error',
  }};
 if(!options.device||!options.canvas)return archive;
 const samples=options.samples??4;if(!Number.isInteger(samples)||samples<2||samples>16)throw new Error('samples must be 2..16');
 const controller=new AbortController(),relay=()=>controller.abort(options.signal?.reason);options.signal?.addEventListener('abort',relay,{once:true});if(options.signal?.aborted)relay();
 const deadline=setTimeout(()=>controller.abort(new DOMException('Virtualized campaign deadline','TimeoutError')),90_000),signal=controller.signal;
 const device=options.device,canvas=options.canvas,size=[canvas.width,canvas.height];let renderer:ClusterGpu|undefined,timer:TimestampBatch|undefined;
 const gpuErrors:string[]=[],listener=(e:GPUUncapturedErrorEvent)=>gpuErrors.push(e.error.message);device.addEventListener('uncapturederror',listener);
 const weak=new WeakRef(controller);void device.lost.then(info=>weak.deref()?.abort(new Error(`Device lost: ${info.message||info.reason}`)));
 const check=()=>{active(signal);if(gpuErrors.length)throw new Error(gpuErrors.join('\n'));};
 const assetStart=performance.now();const asset=buildClusterAsset();archive.assetPreparationMs=performance.now()-assetStart;archive.certificate=asset.certificate;
 const trajectory=Array.from({length:samples},(_,i)=>[4,24,6,20][i%4]);
 const phase=(name:'prepare'|'verify'|'measure'|'complete',variant:string,completed:number,total:number)=>{
  const event={test:'15-virtualized-integration' as const,phase:name,variant,completed,total,message:`${name}: ${variant}`};options.onPhase?.(event);options.onProgress?.(event);check();
 };
 try{
  for(const config of configurations){
   phase('prepare',config.id,0,configurations.length);const prepareStart=performance.now();
   renderer=new ClusterGpu(device,canvas,asset,config.slots,640,360);
   const roots=asset.regions.map(r=>r.rootPage);await renderer.pool.request(roots,signal);
   if(config.slots===128)await renderer.pool.request(asset.regions.map(r=>r.finePage),signal);
   const report={...config,status:'running',conclusion:config.id==='streaming-pressure'?'Complete fallback; geometric quality budget may be exceeded while fine pages are missing':'Equivalence on this certified fixture only',trajectory,quality:[] as Record<string,unknown>[],blocks:[] as Record<string,unknown>[],preparationMs:performance.now()-prepareStart,
    poolAllocatedBytes:config.slots*PAGE_BYTES,ramBytes:null,vramBytes:null,streaming:{...renderer.pool.stats}};
   archive.scenarios.push(report);
   // Quality replay. Missing pages deliberately use complete pinned roots.
   for(let frame=0;frame<samples;frame++){
    phase('verify',config.id,frame,samples);const eye=trajectory[frame];renderer.update(eye,config.threshold);
    renderer.render('A');const a=await renderer.capture(signal),depthA=new Float32Array((await renderer.capture(signal,true)).buffer);
    renderer.render('A');const aa=await renderer.capture(signal);
    renderer.render('B');const b=await renderer.capture(signal),depthB=new Float32Array((await renderer.capture(signal,true)).buffer),selection=await renderer.readSelection(signal);
    const focal=360/(2*Math.tan(Math.PI/6)),frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(renderer.camera.projectionMatrix,renderer.camera.matrixWorldInverse),THREE.WebGPUCoordinateSystem);
    const expected=asset.regions.filter(r=>frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(r.x,r.y,r.height/2),Math.sqrt(.5+r.height*r.height/4)))).map(r=>{
     const s=selectRegion(r,eye,focal,config.threshold,renderer!.pool.slots.has(r.finePage));return [renderer!.pool.slots.get(s.page)!,s.page===r.finePage?4:2,r.id,s.fallback?1:0];
    });
    const actual=selection.clusters.sort((a,b)=>a[2]-b[2]);const repeat=compareImages(a,aa),image=compareImages(a,b);
    let maxDepthError=0,foreground=0;for(let i=0;i<depthA.length;i++){if(depthA[i]<1)foreground++;maxDepthError=Math.max(maxDepthError,Math.abs(depthA[i]-depthB[i]));}
    const passed=foreground>0&&image.differentPixels===0&&repeat.differentPixels===0&&JSON.stringify(actual)===JSON.stringify(expected);
    report.quality.push({frame,passed,repeat,image,maxDepthError,foreground,actual,expected,requests:selection.requests,
     maxProjectedGeometryBound:Math.max(...actual.map(c=>c[1]===4?0:regionErrorPx(asset.regions[c[2]],eye,focal)))});
    if(!passed)throw new Error(`${config.id}: image or selection gate failed`);
    if(config.id==='streaming-pressure')await renderer.pool.request(selection.requests.slice(frame%2?8:0,frame%2?16:8),signal);
    await nextFrame(signal);
   }
   // Timing has no image capture. Feedback waits are included in frameWallMs and RAF cadence.
   for(const [block,mode] of (['A','B','B','A'] as const).entries()){
    phase('measure',`${config.id}:${mode}`,block,4);const raw:Record<string,number|null>[]=[];const intervals:number[]=[];let previous:number|null=null;
    const blockReport={mode,raw,summary:{} as Record<string,unknown>};report.blocks.push(blockReport);
    for(let frame=0;frame<samples;frame++){
     const raf=await nextFrame(signal);if(previous!==null)intervals.push(raf-previous);previous=raf;const start=performance.now();check();
     const before={...renderer.pool.stats};renderer.update(trajectory[frame],config.threshold);
     timer=device.features.has('timestamp-query')?new TimestampBatch(device,1,mode==='A'?1:2):undefined;timer?.begin(1);
     const sample=renderer.render(mode,timer);let gpuMs:number|null=null;
     if(timer){await bounded(timer.collect(),signal);gpuMs=timer.frameSpanMs[0];if(!Number.isFinite(gpuMs)||gpuMs<0||gpuMs>performance.now()-start)throw new Error('Invalid GPU timestamps');}
     else await bounded(device.queue.onSubmittedWorkDone(),signal);
     const selection=mode==='B'?await renderer.readSelection(signal):null;
     if(selection&&config.id==='streaming-pressure')await renderer.pool.request(selection.requests.slice(frame%2?8:0,frame%2?16:8),signal);
     const current=renderer.pool.stats;
     raw.push({frame,gpuZeroDeltaPasses:timer?Array.from(timer.quality).filter(q=>q===1).length:null,cpuSubmitMs:sample.submitMs,gpuMs,frameWallMs:performance.now()-start,drawCalls:sample.drawCalls,
      submittedClusters:selection?selection.clusters.length:asset.regions.length,
      submittedTriangles:selection?selection.clusters.reduce((sum,c)=>sum+c[1],0):asset.regions.length*4,
      vertexInvocations:selection?selection.clusters.length*12:asset.regions.length*12,
      fallbackClusters:selection?selection.clusters.filter(c=>c[3]).length:0,
      cacheHits:selection?current.hits-before.hits:null,cacheMisses:selection?current.misses-before.misses:null,
      bytesRead:selection?current.bytesRead-before.bytesRead:null,uploadedBytes:selection?current.uploadedBytes-before.uploadedBytes:null,evictions:selection?current.evictions-before.evictions:null});
     timer?.destroy();timer=undefined;check();
    }
    blockReport.summary={cadence:cadence(intervals),cpuSubmitMs:summarize(raw.map(r=>r.cpuSubmitMs!)),gpuMs:raw.every(r=>r.gpuMs!==null)?summarize(raw.map(r=>r.gpuMs!)):null};
    const metric:IntegratedMetric={test:'15-virtualized-integration',variant:`${config.id}:${mode}:${block}`,cpuMs:summarize(raw.map(r=>r.cpuSubmitMs!))?.mean??null,gpuMs:raw.every(r=>r.gpuMs!==null)?summarize(raw.map(r=>r.gpuMs!))?.mean??null:null,custom:{scope:'virtualized-dyadic-patches',fps:cadence(intervals).fps,ramBytes:null,vramBytes:null}};metrics.push(metric);options.onMetrics?.(metric);
   }
   report.streaming={...renderer.pool.stats};report.status='measured';renderer.dispose();renderer=undefined;
  }
  archive.status='measured';phase('complete','virtualized-procedural',3,3);
 }catch(error){archive.errors.push(String(error));archive.status='not-run';for(const s of archive.scenarios)if(s.status==='running'){s.status='not-run';s.error=String(error);if(renderer)s.streaming={...renderer.pool.stats};}}
 finally{timer?.destroy();renderer?.dispose();canvas.width=size[0];canvas.height=size[1];clearTimeout(deadline);options.signal?.removeEventListener('abort',relay);device.removeEventListener('uncapturederror',listener);}
 return archive;
}
