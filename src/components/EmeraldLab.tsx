import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Explorer, FrameMetrics, CameraPose } from '@web-geometry/sdk/browser';
import * as THREE from 'three';
import type { EmeraldView, IntegrationScene } from '../lab/emeraldView.ts';
import { defaultEmeraldConfig, urbanPath, segmentNames, framesPerSegment, warmupFrames, retainReports, pixelErrorFor, pathVersion, stillFromFrame, type EmeraldConfig, type EmeraldReport } from '../lab/emeraldCampaign.ts';
import { jpegFromRgba } from '../lab/emeraldCapture.ts';
import { BENCH_ENGINES, PATH_CAMPAIGN_ENGINES, benchEngine, factoriesFor, needsResidentPages, selectableBackend, type BenchEngineId } from '../../15-virtualized-integration/implementation/engines.ts';
import { initialSnapshot, type LabActions } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { LabContext } from './LabContext.tsx';
import { checkEmeraldAvailability, emeraldManifestUrl } from '../lab/emeraldAvailability.ts';
import { LabShell } from './LabShell.tsx';
import { formatEmeraldDiagnosticReport } from '../lab/emeraldReportMarkdown.ts';
import { parseMarkdownToHtml } from '../lab/markdown.ts';
const historyKey='render-tech-lab:emerald-runs:v1';
const CLUSTER_VIEWS:ReadonlyArray<EmeraldConfig['diagnostic']>=['clusters','pages','lod','visibility','screen-error'];
const LAUNCH_KEYS:ReadonlyArray<keyof EmeraldConfig>=['cities','detail','lodQuality','mode'];
const PATH_KEYS:ReadonlyArray<keyof EmeraldConfig>=['engine','diagnostic','camera','poi'];
function applyLiveConfig(owned:Explorer,next:EmeraldConfig,previous:EmeraldConfig,controls:{current:ReturnType<Explorer['controls']>|ReturnType<Explorer['flyControls']>|undefined}){
 const cluster=CLUSTER_VIEWS.includes(next.diagnostic);
 let engine=next.engine,diagnostic=next.diagnostic;
 if(cluster&&engine==='three-webgl-reference'){
  if(previous.engine==='three-webgl-reference'&&previous.diagnostic!==next.diagnostic)engine='exact-cluster-pages';
  else diagnostic='beauty';
 }
 const selected=selectableBackend(engine,diagnostic,owned.backends.map(backend=>backend.id));
 if(CLUSTER_VIEWS.includes(diagnostic)){
  if(selected)owned.select(selected);
  owned.setDiagnostic(diagnostic);
 }else{
  owned.setDiagnostic(diagnostic);
  if(selected)owned.select(selected);
 }
 owned.setComparison('single',[engine,engine],0,0);
 if(next.mode==='explore'&&next.camera!==previous.camera){
  controls.current?.dispose();
  controls.current=next.camera==='free'?owned.flyControls():owned.controls();
 }
 if(next.mode!=='path'&&next.poi&&next.poi!==previous.poi){
  const poi=owned.pointsOfInterest().find(item=>item.id===next.poi);
  if(poi)owned.setPose(poi.pose);
 }
 return {...next,engine,diagnostic,layout:'single' as const};
}
function readHistory():EmeraldReport[]{try{const value=JSON.parse(localStorage.getItem(historyKey)??'[]');return Array.isArray(value)?value.filter(r=>r.version===1&&Array.isArray(r.samples)&&r.configuration).slice(0,5):[];}catch{return [];}}
type Display=Pick<EmeraldView,'status'|'message'|'progress'|'metrics'|'frameIntervalMs'|'position'>;
const initialDisplay:Display={status:'idle',message:'Choisissez une exploration libre ou un parcours reproductible. Les mesures décrivent cette navigation, sans verdict A/B.',progress:null,metrics:null,frameIntervalMs:null,position:''};
const engineLabel=(id:string)=>BENCH_ENGINES.find(engine=>engine.id===id)?.label??id;
const emeraldReportPath='reports/15-virtualized-integration.md & 15-virtualized-integration/results/REPORT.md';
async function archiveEmeraldReport(report:EmeraldReport){
 const markdown=formatEmeraldDiagnosticReport(report);
 const latest={...report,captures:report.captures.map(({image,...capture})=>capture),captureArchive:'benchmark-runs/checks/emerald-path/latest.json'};
 const saved=await fetch('/api/save-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:'15-virtualized-integration',markdown,latest})});
 if(!saved.ok)throw new Error(`Archive HTTP ${saved.status}`);
 const evidence=await fetch('/api/emerald-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
 if(!evidence.ok)throw new Error(`Archive des images HTTP ${evidence.status}`);
 return markdown;
}
function retireCanvas(ref:RefObject<HTMLCanvasElement|null>){
 const current=ref.current;
 if(!current?.parentElement)throw new Error('Canvas Emerald absent');
 const next=document.createElement('canvas');
 next.id='canvas-emerald';
 next.className='absolute inset-0 block w-full h-full outline-none';
 next.tabIndex=current.tabIndex;
 const label=current.getAttribute('aria-label');
 if(label)next.setAttribute('aria-label',label);
 current.removeAttribute('id');
 current.style.display='none';
 current.parentElement.appendChild(next);
 ref.current=next;
 return next;
}
function yieldFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
export function EmeraldLab({onScene}:{onScene:(scene:IntegrationScene)=>void}){
 const webglRef=useRef<HTMLCanvasElement>(null),webgpuRef=useRef<HTMLCanvasElement>(null),chartRef=useRef<HTMLCanvasElement>(null);
 const explorerRef=useRef<Explorer|undefined>(undefined),configRef=useRef<EmeraldConfig>(defaultEmeraldConfig);
 const controlsRef=useRef<ReturnType<Explorer['controls']>|ReturnType<Explorer['flyControls']>|undefined>(undefined);
 const campaignRef=useRef<EmeraldReport|null>(null);
 const [config,setConfig]=useState<EmeraldConfig>(defaultEmeraldConfig),[attempt,setAttempt]=useState(0),[enabled,setEnabled]=useState(false);
 configRef.current=config;
 const [display,setDisplay]=useState<Display>(initialDisplay),[availability,setAvailability]=useState<EmeraldView['availability']>({status:'checking',message:'Vérification du cache préparé…'}),[availableTriangles,setAvailableTriangles]=useState(0),[availabilityAttempt,setAvailabilityAttempt]=useState(0);
 const [history,setHistory]=useState<EmeraldReport[]>(readHistory),[report,setReport]=useState<EmeraldReport|null>(null),[liveBackends,setLiveBackends]=useState<string[]>([]);
 const [reportModal,setReportModal]=useState(()=>initialSnapshot('15-virtualized-integration').reportModal);
 const finishRef=useRef<(status:EmeraldReport['status'],error?:string)=>void>(()=>{});
 useEffect(()=>{const abort=new AbortController();setAvailability({status:'checking',message:'Vérification du cache préparé…'});void checkEmeraldAvailability(fetch,abort.signal).then(triangles=>{if(!abort.signal.aborted){setAvailableTriangles(triangles);setAvailability({status:'ready',message:`Cache disponible · ${triangles.toLocaleString('fr-FR')} triangles par ville.`});}}).catch(error=>{if(!abort.signal.aborted)setAvailability({status:'error',message:String(error.message)});});return()=>abort.abort();},[availabilityAttempt]);
 useEffect(()=>{
  if(!enabled||!webglRef.current)return;
  const abort=new AbortController(),started=performance.now();let owned:Explorer|undefined,frame=0,resize:ResizeObserver|undefined,finished=false;
  const pathCampaign=config.mode==='path';
  const queue=pathCampaign?[...PATH_CAMPAIGN_ENGINES]:[config.engine];
  const run:EmeraldReport={version:1,id:crypto.randomUUID(),timestamp:new Date().toISOString(),status:'stopped',configuration:{...config,diagnostic:pathCampaign?'beauty':config.diagnostic},pathEngines:queue,sourceKey:'unavailable',availableTriangles:availableTriangles*config.cities,sharedGeometry:true,multipliedInstances:config.cities,resolution:[webglRef.current.clientWidth,webglRef.current.clientHeight],firstImageMs:null,preparationMs:null,warmupFrames:0,samples:[],captures:[],error:null,fallbacks:[],retainedSamplesOnly:false,environment:navigator.userAgent,pathVersion,comparison:'visual-only',comparisonReason:'Le contrôle A/A de la ville complète reste instable : la comparaison visuelle est synchronisée, le verdict de performance reste bloqué.'};
  campaignRef.current=run;
  const drop=()=>{cancelAnimationFrame(frame);resize?.disconnect();resize=undefined;controlsRef.current?.dispose();controlsRef.current=undefined;if(explorerRef.current===owned)explorerRef.current=undefined;owned?.dispose();owned=undefined;THREE.Cache.clear();};
  const finish=(status:EmeraldReport['status'],error?:string)=>{if(finished)return;finished=true;run.status=status;run.error=error??null;drop();abort.abort();setEnabled(false);setReport(run);setHistory(previous=>{const next=retainReports(previous,run);try{localStorage.setItem(historyKey,JSON.stringify(next));}catch{run.error=[run.error,'Historique conservé en mémoire : stockage local indisponible. Exportez le rapport.'].filter(Boolean).join(' ');}return next;});void archiveEmeraldReport(run).catch(archiveError=>setDisplay(old=>({...old,message:`${old.message} Archivage à réessayer : ${String(archiveError)}`})));setDisplay(old=>({...old,status,message:error??(status==='completed'?'Parcours terminé. Rapport archivé avec les captures et compteurs de diagnostic.':'Exploration arrêtée. Les ressources ont été libérées.'),progress:null,metrics:null,frameIntervalMs:null}));};
  finishRef.current=finish;
  void(async()=>{try{
   const {createExplorer}=await import('@web-geometry/sdk/browser');
   for(let enginePass=0;enginePass<queue.length;enginePass++){
    if(abort.signal.aborted||finished)return;
    const engineId=queue[enginePass];
    setDisplay({status:'loading',message:`${engineLabel(engineId)} · canvas isolé`,progress:pathCampaign?{completed:enginePass,total:queue.length}:null,metrics:null,frameIntervalMs:null,position:''});
    if(enginePass>0){drop();await yieldFrame();if(abort.signal.aborted||finished)return;}
    const canvas=enginePass>0?retireCanvas(webglRef):webglRef.current;
    if(!canvas)throw new Error('Canvas Emerald absent');
    const box=canvas.getBoundingClientRect();
    const width=Math.max(1,Math.round(box.width)),height=Math.max(1,Math.round(box.height));
    if(enginePass===0)run.resolution=[width,height];
    else if(width!==run.resolution[0]||height!==run.resolution[1])throw new Error('La résolution a changé entre les moteurs. Relancez pour conserver un protocole identique.');
    owned=await createExplorer(canvas,{manifestUrl:emeraldManifestUrl,scope:'full',signal:abort.signal,width,height,replicaCount:config.cities,detail:config.detail,pixelError:pixelErrorFor(config),lodAdaptive:config.lodQuality==='adaptive',maxResidentPages:100000,preload:needsResidentPages(engineId,engineId)?'all':'visible',backends:pathCampaign?[benchEngine(engineId).factory]:factoriesFor(config.engine,config.engine,config.diagnostic),comparisonLayout:'single',comparisonPair:[engineId,engineId],onPreparation:progress=>{if(!abort.signal.aborted)setDisplay(old=>({...old,status:'loading',message:pathCampaign?`${engineLabel(engineId)} · canvas isolé · ${progress.message}`:progress.message,progress:pathCampaign?{completed:enginePass,total:queue.length}:progress,metrics:null}));}});
    if(abort.signal.aborted){drop();return;}
    if(!owned)throw new Error('Canvas Emerald absent');
    const session=owned;
    explorerRef.current=session;
    setLiveBackends(owned.backends.map(backend=>backend.id));
    run.preparationMs=(run.preparationMs??0)+owned.preparationMs;run.sourceKey=owned.metadata.key;
    if(!owned.backends.some(backend=>backend.id===engineId))throw new Error(engineId==='webgpu-page-raster'?`Le raster WebGPU n’a pas été créé (adaptateur absent, device perdu ou repli silencieux).`:`Le moteur ${engineLabel(engineId)} n’a pas été créé sur son canvas isolé.`);
    owned.select(engineId);owned.setDiagnostic(pathCampaign?'beauty':config.diagnostic);
    if(!pathCampaign&&config.engine==='webgpu-page-raster'&&owned.backend!=='webgpu-page-raster'&&!run.fallbacks.includes('WebGPU page raster unavailable'))run.fallbacks.push('WebGPU page raster unavailable');
    owned.setComparison('single',[owned.backend,owned.backend],0,0);
    await owned.awaitPages();
    if(abort.signal.aborted){drop();return;}
    if(config.poi&&!pathCampaign){const poi=owned.pointsOfInterest().find(item=>item.id===config.poi);if(poi)owned.setPose(poi.pose);}
    if(!pathCampaign)controlsRef.current=config.camera==='free'?owned.flyControls():owned.controls();
    const path=urbanPath(owned.bounds);
    if(pathCampaign){
     setDisplay({status:'loading',message:`${engineLabel(engineId)} · pages du parcours`,progress:{completed:enginePass,total:queue.length},metrics:null,frameIntervalMs:null,position:''});
     for(let i=0;i<path.length;i+=framesPerSegment){
      if(abort.signal.aborted||finished)return;
      owned.setPose(path[i].pose);
      await owned.awaitPages();
     }
     owned.setPose(path[0].pose);
     await owned.awaitPages();
     await owned.flush();
    }
    const capturePose=():CameraPose=>{const direction=session.camera.getWorldDirection(session.center.clone()).multiplyScalar(session.camera.position.distanceTo(session.center)).add(session.camera.position);return{position:session.camera.position.toArray() as CameraPose['position'],target:direction.toArray() as CameraPose['target'],fov:session.camera.fov,near:session.camera.near,far:session.camera.far};};
    const verifyFirstImage=()=>{const pixels=session.capture();let distinct=0;for(let p=4;p<pixels.length;p+=4)if(pixels[p]!==pixels[0]||pixels[p+1]!==pixels[1]||pixels[p+2]!==pixels[2])distinct++;const rect=canvas.getBoundingClientRect();if(distinct<100||rect.width<2||rect.height<2)throw new Error(`Première image invalide (${engineLabel(engineId)}) : ${distinct} pixels distincts du fond, canvas ${rect.width} × ${rect.height}.`);if(run.firstImageMs===null)run.firstImageMs=performance.now()-started;};
    resize=new ResizeObserver(()=>{const size=canvas.getBoundingClientRect();if(size.width>0&&size.height>0){const nextWidth=Math.round(size.width),nextHeight=Math.round(size.height);if(pathCampaign&&(nextWidth!==run.resolution[0]||nextHeight!==run.resolution[1])){finish('error','La résolution a changé pendant le parcours. Relancez pour conserver un protocole identique.');return;}owned?.resize(nextWidth,nextHeight);}});
    resize.observe(canvas);
    if(pathCampaign){
     owned.render(path[0].pose);
     await owned.flush();
     owned.render(path[0].pose);
     verifyFirstImage();
     const nextRaf=()=>new Promise<number>(resolve=>{frame=requestAnimationFrame(resolve);});
     let previous:number|null=null,published=0;
     for(let w=0;w<warmupFrames;w++){
      if(abort.signal.aborted||finished){resize.disconnect();return;}
      await nextRaf();
      owned.render(path[0].pose);
      run.warmupFrames++;
     }
     for(let i=0;i<path.length;i++){
      if(abort.signal.aborted||finished){resize.disconnect();return;}
      const step=path[i];
      if(i%framesPerSegment===0){owned.setPose(step.pose);await owned.awaitPages();await owned.flush();}
      const time=await nextRaf();
      const interval=previous===null?null:time-previous;previous=time;
      const metrics:FrameMetrics={...owned.render(step.pose),rafIntervalMs:interval};
      run.samples.push({...metrics,segment:step.segment,elapsedMs:time-started,pose:step.pose,backend:owned.backend,measurementKind:'official'});
      if(i%framesPerSegment===0){await owned.flush();const pixels=owned.capture();run.captures.push(stillFromFrame({segment:step.segment,image:jpegFromRgba(pixels,canvas.width,canvas.height),elapsedMs:time-started,pose:step.pose,metrics,backend:owned.backend,engine:owned.backend,configuration:run.configuration,resolution:[canvas.width,canvas.height],sourceKey:run.sourceKey}));}
      if(owned.fallbackReason&&!run.fallbacks.includes(owned.fallbackReason))run.fallbacks.push(owned.fallbackReason);
      if(!published||time-published>=200){
       published=time;
       const total=queue.length*(path.length+warmupFrames);
       setDisplay({status:'ready',message:`${enginePass+1}/${queue.length} · ${engineLabel(engineId)} · ${step.segment+1}/${segmentNames.length} · ${segmentNames[step.segment]}`,progress:{completed:enginePass*(path.length+warmupFrames)+warmupFrames+i,total},metrics,frameIntervalMs:interval,position:owned.camera.position.toArray().map(v=>v.toFixed(1)).join(' · ')});
      }
     }
     resize.disconnect();resize=undefined;cancelAnimationFrame(frame);
     if(abort.signal.aborted||finished)return;
     continue;
    }
    const outcome=await new Promise<'done'|'aborted'>((resolve,reject)=>{
     let count=0,previous:number|null=null,published=0,firstPixelsVerified=false;
     const tick=(time:number)=>{if(abort.signal.aborted||finished||!owned){resolve('aborted');return;}try{
      const interval=previous===null?null:time-previous;previous=time;controlsRef.current?.update(interval===null?0:Math.min(interval/1000,.05));
      const live=configRef.current;const metrics:FrameMetrics={...owned.render(),rafIntervalMs:interval};
      if(!firstPixelsVerified){verifyFirstImage();firstPixelsVerified=true;}
      run.samples.push({...metrics,segment:-1,elapsedMs:time-started,pose:capturePose(),backend:owned.backend,measurementKind:live.diagnostic==='beauty'?'official':'diagnostic'});
      if(run.samples.length>3600){run.samples.shift();run.retainedSamplesOnly=true;}
      if(owned.fallbackReason&&!run.fallbacks.includes(owned.fallbackReason))run.fallbacks.push(owned.fallbackReason);
      if(!published||time-published>=200){published=time;setDisplay({status:'ready',message:'Exploration libre',progress:null,metrics,frameIntervalMs:interval,position:owned.camera.position.toArray().map(v=>v.toFixed(1)).join(' · ')});}
      count++;frame=requestAnimationFrame(tick);
     }catch(error){reject(error);}};
     frame=requestAnimationFrame(tick);
    });
    resize?.disconnect();resize=undefined;cancelAnimationFrame(frame);
    if(outcome!=='done'||abort.signal.aborted||finished)return;
   }
   finish('completed');
  }catch(error){if(!abort.signal.aborted)finish('error',`Chargement interrompu : ${error instanceof Error?error.message:String(error)}`);}})();
  return()=>{abort.abort();drop();};
 },[enabled,attempt]);
 const running=display.status==='loading'||display.status==='ready';
 const restart=useCallback(()=>{if(running||availability.status!=='ready')return;setDisplay({...initialDisplay,status:'loading',message:'Chargement d’Emerald Square…'});setEnabled(true);setAttempt(v=>v+1);},[running,availability.status]);
 const stop=useCallback(()=>finishRef.current('stopped'),[]);
 const availableEngines=useMemo(()=>BENCH_ENGINES.map(engine=>({id:engine.id,label:engine.label,available:!liveBackends.length||liveBackends.includes(engine.id)})),[liveBackends]);
 const commitConfig=useCallback((patch:Partial<EmeraldConfig>)=>{
  const current=configRef.current;
  let next={...current,...patch,layout:'single' as const};
  const owned=explorerRef.current;
  if(owned){
   try{next=applyLiveConfig(owned,next,current,controlsRef);}catch{return;}
  }
  setConfig(next);
 },[]);
 const selectEngine=useCallback((id:BenchEngineId)=>{commitConfig({engine:id});},[commitConfig]);
 const selectDiagnostic=useCallback((mode:EmeraldConfig['diagnostic'])=>{commitConfig({diagnostic:mode});},[commitConfig]);
 const updateConfig=useCallback((value:Partial<EmeraldConfig>)=>{
  const patch=running?Object.fromEntries(Object.entries(value).filter(([key])=>!LAUNCH_KEYS.includes(key as keyof EmeraldConfig)&&!(configRef.current.mode==='path'&&PATH_KEYS.includes(key as keyof EmeraldConfig)))) as Partial<EmeraldConfig>:value;
  if(!Object.keys(patch).length)return;
  commitConfig(patch);
 },[running,commitConfig]);
 const showReport=useCallback((id:string)=>{if(running)return;const saved=history.find(r=>r.id===id);if(saved){setConfig({...defaultEmeraldConfig,...saved.configuration});setReport(saved);setDisplay(old=>({...old,status:saved.status,message:saved.error??'Rapport de navigation archivé'}));}},[running,history]);
 const exportReport=useCallback(()=>{if(!report||running)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`emerald-${report.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},[report,running]);
 const state=useMemo(()=>{
  const next=initialSnapshot('15-virtualized-integration');
  next.running=running;
  next.execution={status:running?'running':display.status==='idle'?'idle':display.status==='error'?'error':display.status==='completed'?'completed':'stopped',phase:display.message,lastCampaign:null};
  next.benchLabel=config.mode==='path'?'Lancer le parcours urbain':'Explorer Emerald Square';
  if(display.status!=='idle'&&!running)next.benchLabel=config.mode==='path'?'Relancer le parcours urbain':'Relancer Emerald Square';
  next.reportModal=reportModal;
  return next;
 },[running,display.status,display.message,config.mode,reportModal]);
 const openReport=useCallback(async()=>{
  if(running)return;
  if(history[0])showReport(history[0].id);
  setReportModal(current=>({...current,open:true,title:'Rapport d’analyse R&D — 15-virtualized-integration',path:emeraldReportPath,raw:'',html:'<p>Chargement du rapport depuis le disque…</p>',feedback:''}));
  try{const response=await fetch('/api/get-report?testId=15-virtualized-integration');const raw=await response.text();setReportModal(current=>({...current,raw:response.ok?raw:'',html:response.ok?parseMarkdownToHtml(raw):`<p>${raw}</p>`}));}catch(error){setReportModal(current=>({...current,html:`<p>Erreur réseau : ${String(error)}</p>`}));}
 },[running,history,showReport]);
 const copyReport=useCallback(()=>{const raw=reportModal.raw;if(!raw)return;void navigator.clipboard.writeText(raw).then(()=>setReportModal(current=>({...current,feedback:'Markdown copié dans le presse-papier.'}))).catch(()=>setReportModal(current=>({...current,feedback:'Copie indisponible.'})));},[reportModal.raw]);
 const openFinder=useCallback(()=>{void fetch('/api/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:'15-virtualized-integration',folder:'reports'})}).then(response=>response.json()).then(data=>setReportModal(current=>({...current,feedback:`Finder ouvert : ${data.targetFile??data.targetDir??'reports/'}`}))).catch(()=>setReportModal(current=>({...current,feedback:'Rapports : ./reports/'})));},[]);
 const actions=useMemo<LabActions>(()=>({newExecution:()=>{if(!running){setEnabled(false);setReport(null);setDisplay(initialDisplay);}},switchModule:id=>{if(!running)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},runBenchmark:restart,stopBenchmark:stop,runPain:stop,openReport,closeReport:()=>setReportModal(current=>({...current,open:false,feedback:''})),copyReport,refreshReport:openReport,openFinder }),[running,restart,stop,openReport,copyReport,openFinder]);
 const emerald=useMemo(()=>({...display,surfaceKey:String(attempt),availability,retryAvailability:()=>setAvailabilityAttempt(v=>v+1),availableTriangles:availableTriangles*config.cities,config,setConfig:updateConfig,availableEngines,selectEngine,selectDiagnostic,report,history,showReport,exportReport,stop,restart}),[display,attempt,availability,availableTriangles,config,updateConfig,availableEngines,selectEngine,selectDiagnostic,report,history,showReport,exportReport,stop,restart]);
 const value=useMemo(()=>({state,actions,onIntegrationScene:(scene:IntegrationScene)=>{if(!running)onScene(scene);},emerald}),[state,actions,running,onScene,emerald]);
 return <LabContext.Provider value={value}><LabShell webglRef={webglRef} webgpuRef={webgpuRef} chartRef={chartRef}/></LabContext.Provider>;
}
