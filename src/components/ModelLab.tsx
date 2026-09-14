import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Explorer, FrameMetrics, CameraPose } from '@web-geometry/sdk/browser';
import * as THREE from 'three';
import type { ModelView, IntegrationScene } from '../lab/modelView.ts';
import { applyAaControlResult, aaControlReason, defaultModelConfig, modelMeasurementKind, runAaControl, urbanPath, segmentNames, framesPerSegment, warmupFrames, retainReports, pixelErrorFor, pathVersion, stillFromFrame, type ModelConfig, type ModelReport } from '../lab/modelCampaign.ts';
import { jpegFromRgba } from '../lab/modelCapture.ts';
import { BENCH_ENGINES, PATH_CAMPAIGN_ENGINES, engineFactories, needsResidentPages, selectableBackend, type BenchEngineId } from '../../15-virtualized-integration/implementation/engines.ts';
import { initialSnapshot, type LabActions } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { LabContext } from './LabContext.tsx';
import { checkModelAvailability, modelManifestUrl, defaultModelId } from '../lab/modelAvailability.ts';
import { LabShell } from './LabShell.tsx';
import { archiveModelReport, modelReportBlob } from '../lab/modelReportTransport.ts';
import { loadMarkdownReport } from '../lab/reportReader.ts';
import { clearColorFromSurface } from '../lab/renderSurface.ts';
const historyKey='render-tech-lab:model-runs:v1';
const CLUSTER_VIEWS:ReadonlyArray<ModelConfig['diagnostic']>=['clusters','pages','lod','visibility','screen-error'];
const LAUNCH_KEYS:ReadonlyArray<keyof ModelConfig>=['modelId','cities','detail','lodQuality','mode','debug'];
const PATH_KEYS:ReadonlyArray<keyof ModelConfig>=['engine','diagnostic','camera'];
function applyLiveConfig(owned:Explorer,next:ModelConfig,previous:ModelConfig,controls:{current:ReturnType<Explorer['controls']>|ReturnType<Explorer['flyControls']>|undefined}){
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
 return {...next,engine,diagnostic,layout:'single' as const};
}
function readHistory():ModelReport[]{try{const value=JSON.parse(localStorage.getItem(historyKey)??'[]');return Array.isArray(value)?value.filter(r=>r.version===1&&Array.isArray(r.samples)&&r.configuration).slice(0,2):[];}catch{return [];}}
type Display=Pick<ModelView,'status'|'message'|'progress'|'metrics'|'frameIntervalMs'|'position'|'cameraPose'>;
const initialDisplay:Display={status:'idle',message:'Choisissez une exploration libre ou un parcours reproductible. Les mesures décrivent cette navigation, sans verdict A/B.',progress:null,metrics:null,frameIntervalMs:null,position:'',cameraPose:null};
const engineLabel=(id:string)=>BENCH_ENGINES.find(engine=>engine.id===id)?.label??id;
const modelReportPath='reports/15-virtualized-integration/campaign-<id>/';
function replaceRenderCanvas(ref:RefObject<HTMLCanvasElement|null>){
 const current=ref.current;
 if(!current?.parentElement)throw new Error('Canvas absent');
 const next=document.createElement('canvas');
 next.id='canvas-model';
 next.className='absolute inset-0 block w-full h-full outline-none bg-base-100';
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
export function ModelLab({onScene}:{onScene:(scene:IntegrationScene)=>void}){
 const webglRef=useRef<HTMLCanvasElement>(null),webgpuRef=useRef<HTMLCanvasElement>(null),chartRef=useRef<HTMLCanvasElement>(null);
 const explorerRef=useRef<Explorer|undefined>(undefined),configRef=useRef<ModelConfig>(defaultModelConfig);
 const controlsRef=useRef<ReturnType<Explorer['controls']>|ReturnType<Explorer['flyControls']>|undefined>(undefined);
 const campaignRef=useRef<ModelReport|null>(null);
 const [config,setConfig]=useState<ModelConfig>(defaultModelConfig),[attempt,setAttempt]=useState(0),[enabled,setEnabled]=useState(false);
 configRef.current=config;
 const [display,setDisplay]=useState<Display>(initialDisplay),[availability,setAvailability]=useState<ModelView['availability']>({status:'checking',message:'Vérification du cache préparé…'}),[availableTriangles,setAvailableTriangles]=useState(0),[availabilityAttempt,setAvailabilityAttempt]=useState(0);
 const [history,setHistory]=useState<ModelReport[]>(readHistory),[report,setReport]=useState<ModelReport|null>(null),[liveBackends,setLiveBackends]=useState<string[]>([]);
 const [reportModal,setReportModal]=useState(()=>initialSnapshot('15-virtualized-integration').reportModal);
 const finishRef=useRef<(status:ModelReport['status'],error?:string)=>void>(()=>{});
 // Disk archives hold the full traces. Session history keeps the original objects
 // without serializing hundreds of megabytes into localStorage.
 const saveArchive=(saved:ModelReport)=>{
  setDisplay(old=>({...old,message:'Sauvegarde du rapport et des logs en cours…'}));
  void archiveModelReport(saved).then(()=>setDisplay(old=>({...old,message:saved.status==='completed'
   ? (saved.aaControl?.status==='failed'?`Rapport archivé. A/A divergent : diagnostic uniquement. ${aaControlReason(saved)}`:'Rapport archivé avec les captures et les logs de diagnostic.')
   : `Rapport archivé. ${saved.error??'Exploration arrêtée.'}`})))
   .catch(error=>setDisplay(old=>({...old,message:`Archivage échoué : ${String(error)}. Le rapport reste en mémoire ; utilisez « Enregistrer le rapport » pour réessayer.`})));
 };

 useEffect(()=>{const abort=new AbortController(),modelId=config.modelId||defaultModelId();setAvailability({status:'checking',message:'Vérification du cache préparé…'});void checkModelAvailability(modelId,fetch,abort.signal).then(triangles=>{if(!abort.signal.aborted){setAvailableTriangles(triangles);setAvailability({status:'ready',message:`Cache disponible · ${triangles.toLocaleString('fr-FR')} triangles par modèle.`});}}).catch(error=>{if(!abort.signal.aborted)setAvailability({status:'error',message:String(error.message)});});return()=>abort.abort();},[availabilityAttempt,config.modelId]);
 useEffect(()=>{
  if(!enabled||!webglRef.current)return;
  const abort=new AbortController(),started=performance.now();let owned:Explorer|undefined,frame=0,resize:ResizeObserver|undefined,finished=false;
  const pathCampaign=config.mode==='path';
  const queue=pathCampaign?[...PATH_CAMPAIGN_ENGINES]:[config.engine];
 const run:ModelReport={version:1,id:crypto.randomUUID(),timestamp:new Date().toISOString(),status:'stopped',configuration:{...config,diagnostic:pathCampaign?'beauty':config.diagnostic},pathEngines:queue,sourceKey:'unavailable',availableTriangles:availableTriangles*config.cities,sharedGeometry:true,multipliedInstances:config.cities,resolution:[webglRef.current.clientWidth,webglRef.current.clientHeight],firstImageMs:null,preparationMs:null,warmupFrames:0,samples:[],captures:[],engineEvents:[],error:null,fallbacks:[],retainedSamplesOnly:false,environment:navigator.userAgent,pathVersion,comparison:'visual-only',comparisonReason:'A/A non vérifié pour cette campagne. Le verdict de performance reste bloqué sans validation réelle.',aaControl:{status:'not-run'}};
 const log=(level:ModelReport['engineEvents'][number]['level'],phase:string,message:string,context:Record<string,unknown>={})=>run.engineEvents.push({timestamp:new Date().toISOString(),level,phase,message,context});
 log('info','created','Campagne créée',{modelId:config.modelId||defaultModelId(),engines:queue,resolution:run.resolution,instances:config.cities,debug:!!config.debug,measurementKind:modelMeasurementKind(run.configuration)});
  campaignRef.current=run;
  const drop=()=>{cancelAnimationFrame(frame);resize?.disconnect();resize=undefined;controlsRef.current?.dispose();controlsRef.current=undefined;if(explorerRef.current===owned)explorerRef.current=undefined;owned?.dispose();owned=undefined;THREE.Cache.clear();};
  const finish=(status:ModelReport['status'],error?:string)=>{
   if(finished)return;finished=true;run.status=status;run.error=error??null;
   log(status==='error'?'error':'info','finished',error??`Campagne ${status}`,{samples:run.samples.length,captures:run.captures.length,fallbacks:run.fallbacks});
   drop();abort.abort();setEnabled(false);setReport(run);
   setHistory(previous=>retainReports(previous,run));
   setDisplay(old=>({...old,status,message:'Parcours terminé. Sauvegarde du rapport en cours…',progress:null,metrics:null,frameIntervalMs:null}));
   saveArchive(run);
  };
  finishRef.current=finish;
  void(async()=>{try{
   const {createExplorer}=await import('@web-geometry/sdk/browser');
   for(let enginePass=0;enginePass<queue.length;enginePass++){
    if(abort.signal.aborted||finished)return;
    const engineId=queue[enginePass];
    log('info','engine-start','Initialisation du moteur',{engine:engineId,index:enginePass,total:queue.length});
    setDisplay({status:'loading',message:`${engineLabel(engineId)} · canvas isolé`,progress:pathCampaign?{completed:enginePass,total:queue.length}:null,metrics:null,frameIntervalMs:null,position:'',cameraPose:null});
    if(enginePass>0){drop();await yieldFrame();if(abort.signal.aborted||finished)return;}
    const canvas=enginePass>0?replaceRenderCanvas(webglRef):webglRef.current;
    if(!canvas)throw new Error('Canvas absent');
    const box=canvas.getBoundingClientRect();
    const width=Math.max(1,Math.round(box.width)),height=Math.max(1,Math.round(box.height));
    const surfaceColor=clearColorFromSurface(canvas);
    const clearColor=surfaceColor.value;
    const colorContext={engine:engineId,source:surfaceColor.source,themeColor:surfaceColor.themeColor,computedBackground:surfaceColor.computedBackground,clearColor:surfaceColor.hex};
    log('info','surface-color','Couleur de fond transmise au moteur',colorContext);
    console.info('[render-tech-lab] couleur de fond transmise au moteur',colorContext);
    if(enginePass===0)run.resolution=[width,height];
    else if(width!==run.resolution[0]||height!==run.resolution[1])throw new Error('La résolution a changé entre les moteurs. Relancez pour conserver un protocole identique.');
    owned=await createExplorer(canvas,{manifestUrl:modelManifestUrl(config.modelId||defaultModelId()),scope:'full',signal:abort.signal,width,height,clearColor,replicaCount:config.cities,detail:config.detail,pixelError:pixelErrorFor(config),lodAdaptive:config.lodQuality==='adaptive',maxResidentPages:100000,preload:pathCampaign&&needsResidentPages(engineId,engineId)?'all':'visible',backends:engineFactories([engineId]),comparisonLayout:'single',comparisonPair:[engineId,engineId],diagnosticDetail:config.debug?'trace':'summary',onDiagnostic:diagnostic=>run.engineEvents.push({timestamp:new Date(diagnostic.createdAt??Date.now()).toISOString(),level:diagnostic.phase==='diagnostic-loss'?'warn':'info',phase:`engine:${diagnostic.phase}`,message:diagnostic.message,context:{engine:engineId,...diagnostic.context,diagnosticSequence:diagnostic.sequence,diagnosticSession:diagnostic.sessionId,diagnosticCreatedAt:diagnostic.createdAt}}),onPreparation:progress=>{log('debug','preparation',progress.message,{engine:engineId,completed:progress.completed,total:queue.length});if(!abort.signal.aborted)setDisplay(old=>({...old,status:'loading',message:pathCampaign?`${engineLabel(engineId)} · canvas isolé · ${progress.message}`:progress.message,progress:pathCampaign?{completed:enginePass,total:queue.length}:progress,metrics:null}));}});
    if(abort.signal.aborted){drop();return;}
    if(!owned)throw new Error('Canvas absent');
    const session=owned;
    explorerRef.current=session;
    setLiveBackends(owned.backends.map(backend=>backend.id));
    run.preparationMs=(run.preparationMs??0)+owned.preparationMs;run.sourceKey=owned.metadata.key;
    log('info','engine-ready','Moteur prêt',{engine:engineId,backend:owned.backend,preparationMs:owned.preparationMs,sourceKey:run.sourceKey});
    if(!owned.backends.some(backend=>backend.id===engineId))throw new Error(engineId==='webgpu-page-raster'?`Le raster WebGPU n’a pas été créé (adaptateur absent, device perdu ou repli silencieux).`:`Le moteur ${engineLabel(engineId)} n’a pas été créé sur son canvas isolé.`);
    owned.select(engineId);owned.setDiagnostic(pathCampaign?'beauty':config.diagnostic);
    if(!pathCampaign&&config.engine==='webgpu-page-raster'&&owned.backend!=='webgpu-page-raster'&&!run.fallbacks.includes('WebGPU page raster unavailable'))run.fallbacks.push('WebGPU page raster unavailable');
    owned.setComparison('single',[owned.backend,owned.backend],0,0);
    await owned.awaitPages();
    log('info','pages-ready','Pages requises prêtes',{engine:engineId});
    if(abort.signal.aborted){drop();return;}
    if(!pathCampaign)controlsRef.current=config.camera==='free'?owned.flyControls():owned.controls();
    const path=urbanPath(owned.bounds);
    if(pathCampaign){
     setDisplay({status:'loading',message:`${engineLabel(engineId)} · pages du parcours`,progress:{completed:enginePass,total:queue.length},metrics:null,frameIntervalMs:null,position:'',cameraPose:null});
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
     setDisplay({status:'loading',message:`${engineLabel(engineId)} · contrôle A/A`,progress:{completed:enginePass,total:queue.length},metrics:null,frameIntervalMs:null,position:'',cameraPose:null});
     const aaChecks=await runAaControl(owned,owned.backend,path.filter((_,index)=>index%framesPerSegment===0));
     const checks=[...(run.aaControl?.checks??[]),...aaChecks];
     const aaResult=applyAaControlResult(run,checks,queue.length*segmentNames.length);
     Object.assign(run,aaResult);
     const aaFailure=aaResult.aaControl.status==='failed'?aaResult.aaControl.failure:undefined;
     log(aaFailure?'warn':'info','aa-control',aaFailure??`Contrôle A/A réussi : ${aaChecks.length} point(s) pour ${engineLabel(engineId)}.`,{engine:owned.backend,checks:aaChecks});
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
      run.samples.push({...metrics,segment:step.segment,elapsedMs:time-started,pose:step.pose,backend:owned.backend,measurementKind:modelMeasurementKind(run.configuration)});
      if(i%framesPerSegment===0){await owned.flush();const pixels=owned.capture();run.captures.push(stillFromFrame({segment:step.segment,image:jpegFromRgba(pixels,canvas.width,canvas.height),elapsedMs:time-started,pose:step.pose,metrics,backend:owned.backend,engine:owned.backend,configuration:run.configuration,resolution:[canvas.width,canvas.height],sourceKey:run.sourceKey}));}
      if(owned.fallbackReason&&!run.fallbacks.includes(owned.fallbackReason))run.fallbacks.push(owned.fallbackReason);
      if(!published||time-published>=200){
       published=time;
       const total=queue.length*(path.length+warmupFrames);
       setDisplay({status:'ready',message:`${enginePass+1}/${queue.length} · ${engineLabel(engineId)} · ${step.segment+1}/${segmentNames.length} · ${segmentNames[step.segment]}`,progress:{completed:enginePass*(path.length+warmupFrames)+warmupFrames+i,total},metrics,frameIntervalMs:interval,position:owned.camera.position.toArray().map(v=>v.toFixed(1)).join(' · '),cameraPose:capturePose()});
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
      run.samples.push({...metrics,segment:-1,elapsedMs:time-started,pose:capturePose(),backend:owned.backend,measurementKind:modelMeasurementKind({...live,debug:config.debug})});
      if(run.samples.length>3600){run.samples.shift();run.retainedSamplesOnly=true;}
      if(owned.fallbackReason&&!run.fallbacks.includes(owned.fallbackReason))run.fallbacks.push(owned.fallbackReason);
      if(!published||time-published>=200){published=time;setDisplay({status:'ready',message:'Exploration libre',progress:null,metrics,frameIntervalMs:interval,position:owned.camera.position.toArray().map(v=>v.toFixed(1)).join(' · '),cameraPose:capturePose()});}
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
 const restart=useCallback(()=>{if(running||availability.status!=='ready')return;setDisplay({...initialDisplay,status:'loading',message:'Chargement du modèle…'});setEnabled(true);setAttempt(v=>v+1);},[running,availability.status]);
 const stop=useCallback(()=>finishRef.current('stopped'),[]);
 const availableEngines=useMemo(()=>BENCH_ENGINES.map(engine=>({id:engine.id,label:engine.label,available:!liveBackends.length||liveBackends.includes(engine.id)})),[liveBackends]);
 const commitConfig=useCallback((patch:Partial<ModelConfig>)=>{
  const current=configRef.current;
  let next={...current,...patch,layout:'single' as const};
  const owned=explorerRef.current;
  if(owned){
   try{next=applyLiveConfig(owned,next,current,controlsRef);}catch{return;}
  }
  setConfig(next);
 },[]);
 const selectEngine=useCallback((id:BenchEngineId)=>{
  const current=configRef.current;
  if(id===current.engine)return;
  if(running&&current.mode==='explore'&&explorerRef.current){
   replaceRenderCanvas(webglRef);
   setLiveBackends([]);
   setConfig({...current,engine:id,layout:'single'});
   setDisplay({...initialDisplay,status:'loading',message:`Changement vers ${engineLabel(id)} · nouveau canvas isolé`});
   setAttempt(value=>value+1);
   return;
  }
  commitConfig({engine:id});
 },[running,commitConfig]);
 const selectDiagnostic=useCallback((mode:ModelConfig['diagnostic'])=>{commitConfig({diagnostic:mode});},[commitConfig]);
 const updateConfig=useCallback((value:Partial<ModelConfig>)=>{
  if(value.engine!==undefined&&value.engine!==configRef.current.engine){selectEngine(value.engine);return;}
  const patch=running?Object.fromEntries(Object.entries(value).filter(([key])=>!LAUNCH_KEYS.includes(key as keyof ModelConfig)&&!(configRef.current.mode==='path'&&PATH_KEYS.includes(key as keyof ModelConfig)))) as Partial<ModelConfig>:value;
  if(!Object.keys(patch).length)return;
  commitConfig(patch);
 },[running,commitConfig,selectEngine]);
 const showReport=useCallback((id:string)=>{if(running)return;const saved=history.find(r=>r.id===id);if(saved){setConfig({...defaultModelConfig,...saved.configuration});setReport(saved);setDisplay(old=>({...old,status:saved.status,message:saved.error??'Rapport de navigation archivé'}));}},[running,history]);
 const exportReport=useCallback(()=>{
  if(!report||running)return;
  void modelReportBlob(report).then(blob=>{
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`model-${report.id}.json`;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }).catch(error=>setDisplay(old=>({...old,message:`Export échoué : ${String(error)}. Le rapport reste en mémoire.`})));
 },[report,running]);
 const state=useMemo(()=>{
  const next=initialSnapshot('15-virtualized-integration');
  next.running=running;
  next.execution={status:running?'running':display.status==='idle'?'idle':display.status==='error'?'error':display.status==='completed'?'completed':'stopped',phase:display.message,lastCampaign:null};
  next.benchLabel=config.mode==='path'?'Lancer le parcours du modèle':'Explorer le modèle';
  if(display.status!=='idle'&&!running)next.benchLabel=config.mode==='path'?'Relancer le parcours du modèle':'Relancer l’exploration';
  next.reportModal=reportModal;
  return next;
 },[running,display.status,display.message,config.mode,reportModal]);
 const openReport=useCallback(async()=>{
  if(running)return;
  setReportModal(current=>({...current,open:true,title:'Rapport d’analyse R&D — 15-virtualized-integration',path:modelReportPath,raw:'',html:'<p>Chargement du rapport depuis le disque…</p>',feedback:''}));
  try{
   const report=await loadMarkdownReport(fetch,'15-virtualized-integration');
   setReportModal(current=>({...current,raw:report.ok?report.raw:'',html:report.ok?'':`<p>${report.raw}</p>`,feedback:report.feedback}));
  }catch(error){setReportModal(current=>({...current,html:`<p>Erreur réseau : ${String(error)}</p>`}));}
 },[running]);
 const copyReport=useCallback(()=>{const raw=reportModal.raw;if(!raw)return;void navigator.clipboard.writeText(raw).then(()=>setReportModal(current=>({...current,feedback:'Markdown copié dans le presse-papier.'}))).catch(()=>setReportModal(current=>({...current,feedback:'Copie indisponible.'})));},[reportModal.raw]);
 const openFinder=useCallback(()=>{void fetch('/api/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:'15-virtualized-integration',folder:'reports'})}).then(response=>response.json()).then(data=>setReportModal(current=>({...current,feedback:`Finder ouvert : ${data.targetFile??data.targetDir??'reports/'}`}))).catch(()=>setReportModal(current=>({...current,feedback:'Rapports : ./reports/'})));},[]);
 const actions=useMemo<LabActions>(()=>({newExecution:()=>{if(!running){setEnabled(false);setReport(null);setDisplay(initialDisplay);}},switchModule:id=>{if(!running)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},runBenchmark:restart,stopBenchmark:stop,runPain:stop,openReport,closeReport:()=>setReportModal(current=>({...current,open:false,feedback:''})),copyReport,refreshReport:openReport,openFinder }),[running,restart,stop,openReport,copyReport,openFinder]);
 const model=useMemo(()=>({...display,surfaceKey:String(attempt),availability,retryAvailability:()=>setAvailabilityAttempt(v=>v+1),availableTriangles:availableTriangles*config.cities,config,setConfig:updateConfig,availableEngines,selectEngine,selectDiagnostic,report,history,showReport,exportReport,archiveReport:report?()=>saveArchive(report):undefined,stop,restart}),[display,attempt,availability,availableTriangles,config,updateConfig,availableEngines,selectEngine,selectDiagnostic,report,history,showReport,exportReport,stop,restart]);
 const value=useMemo(()=>({state,actions,onIntegrationScene:(scene:IntegrationScene)=>{if(!running)onScene(scene);},model}),[state,actions,running,onScene,model]);
 return <LabContext.Provider value={value}><LabShell webglRef={webglRef} webgpuRef={webgpuRef} chartRef={chartRef}/></LabContext.Provider>;
}
