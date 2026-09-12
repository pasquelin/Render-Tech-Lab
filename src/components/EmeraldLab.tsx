import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmeraldExplorer, FrameMetrics, CameraPose } from '@web-geometry/sdk/browser';
import type { EmeraldView, IntegrationScene } from '../lab/emeraldView.ts';
import { defaultEmeraldConfig, urbanPath, segmentNames, framesPerSegment, warmupFrames, retainReports, type EmeraldConfig, type EmeraldReport } from '../lab/emeraldCampaign.ts';
import { initialSnapshot, type LabActions } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { LabContext } from './LabContext.tsx';
import { checkEmeraldAvailability, emeraldManifestUrl } from '../lab/emeraldAvailability.ts';
import { LabShell } from './LabShell.tsx';
const historyKey='render-tech-lab:emerald-runs:v1';
function readHistory():EmeraldReport[]{try{const value=JSON.parse(localStorage.getItem(historyKey)??'[]');return Array.isArray(value)?value.filter(r=>r.version===1&&Array.isArray(r.samples)&&r.configuration).slice(0,5):[];}catch{return [];}}
type Display=Pick<EmeraldView,'status'|'message'|'progress'|'metrics'|'frameIntervalMs'|'position'>;
const initialDisplay:Display={status:'idle',message:'Choisissez une exploration libre ou un parcours reproductible. Les mesures décrivent cette navigation, sans verdict A/B.',progress:null,metrics:null,frameIntervalMs:null,position:''};
export function EmeraldLab({onScene}:{onScene:(scene:IntegrationScene)=>void}){
 const webglRef=useRef<HTMLCanvasElement>(null),webgpuRef=useRef<HTMLCanvasElement>(null),chartRef=useRef<HTMLCanvasElement>(null);
 const [config,setConfig]=useState<EmeraldConfig>(defaultEmeraldConfig),[attempt,setAttempt]=useState(0),[enabled,setEnabled]=useState(false);
 const [display,setDisplay]=useState<Display>(initialDisplay),[availability,setAvailability]=useState<EmeraldView['availability']>({status:'checking',message:'Vérification du cache préparé…'}),[availableTriangles,setAvailableTriangles]=useState(0),[availabilityAttempt,setAvailabilityAttempt]=useState(0);
 const [history,setHistory]=useState<EmeraldReport[]>(readHistory),[report,setReport]=useState<EmeraldReport|null>(null);
 const finishRef=useRef<(status:EmeraldReport['status'],error?:string)=>void>(()=>{});
 useEffect(()=>{const abort=new AbortController();setAvailability({status:'checking',message:'Vérification du cache préparé…'});void checkEmeraldAvailability(fetch,abort.signal).then(triangles=>{if(!abort.signal.aborted){setAvailableTriangles(triangles);setAvailability({status:'ready',message:`Cache disponible · ${triangles.toLocaleString('fr-FR')} triangles par ville.`});}}).catch(error=>{if(!abort.signal.aborted)setAvailability({status:'error',message:String(error.message)});});return()=>abort.abort();},[availabilityAttempt]);
 useEffect(()=>{
  if(!enabled||!webglRef.current)return;
  const canvas=webglRef.current,abort=new AbortController(),started=performance.now();let owned:EmeraldExplorer|undefined,controls:ReturnType<EmeraldExplorer['controls']>|ReturnType<EmeraldExplorer['flyControls']>|undefined,frame=0,resize:ResizeObserver|undefined,finished=false;
  const run:EmeraldReport={version:1,id:crypto.randomUUID(),timestamp:new Date().toISOString(),status:'stopped',configuration:{...config},sourceKey:'unavailable',availableTriangles:availableTriangles*config.cities,resolution:[canvas.clientWidth,canvas.clientHeight],firstImageMs:null,preparationMs:null,warmupFrames:0,samples:[],captures:[],error:null,fallbacks:[],retainedSamplesOnly:false,environment:navigator.userAgent,pathVersion:1,comparison:'unavailable'};
  const release=()=>{cancelAnimationFrame(frame);resize?.disconnect();controls?.dispose();controls=undefined;owned?.dispose();};
  const finish=(status:EmeraldReport['status'],error?:string)=>{if(finished||abort.signal.aborted)return;finished=true;run.status=status;run.error=error??null;release();setEnabled(false);setReport(run);setHistory(previous=>{const next=retainReports(previous,run);try{localStorage.setItem(historyKey,JSON.stringify(next));}catch{run.error=[run.error,'Historique conservé en mémoire : stockage local indisponible. Exportez le rapport.'].filter(Boolean).join(' ');}return next;});setDisplay(old=>({...old,status,message:error??(status==='completed'?'Parcours terminé. Le rapport décrit uniquement cette navigation.':'Exploration arrêtée. Les ressources ont été libérées.'),progress:null}));};
  finishRef.current=finish;
  void(async()=>{try{
   const {createEmeraldExplorer,referenceBackend,exactPagesBackend}=await import('@web-geometry/sdk/browser');if(abort.signal.aborted)return;
   const box=canvas.getBoundingClientRect();
   owned=await createEmeraldExplorer(canvas,{manifestUrl:emeraldManifestUrl,scope:'full',signal:abort.signal,width:Math.max(1,Math.round(box.width)),height:Math.max(1,Math.round(box.height)),cityCount:config.cities,detail:config.detail,maxResidentPages:100000,backends:config.diagnostic==='clusters'||config.diagnostic==='pages'?[referenceBackend,exactPagesBackend]:[referenceBackend],onPreparation:progress=>{if(!abort.signal.aborted)setDisplay(old=>({...old,message:progress.message,progress}));}});
   if(abort.signal.aborted){owned.dispose();return;}
   run.preparationMs=owned.preparationMs;run.sourceKey=owned.metadata.key;run.resolution=[canvas.width,canvas.height];
   if(config.diagnostic==='clusters'||config.diagnostic==='pages')owned.select('exact-cluster-pages');owned.setDiagnostic(config.diagnostic);
   if(config.mode==='explore')controls=config.camera==='free'?owned.flyControls():owned.controls();
   const path=urbanPath(owned.bounds);let count=0,previous:number|null=null,published=0,firstPixelsVerified=false;
   const capturePose=():CameraPose=>{const direction=owned!.camera.getWorldDirection(owned!.center.clone()).multiplyScalar(owned!.camera.position.distanceTo(owned!.center)).add(owned!.camera.position);return{position:owned!.camera.position.toArray() as CameraPose['position'],target:direction.toArray() as CameraPose['target'],fov:owned!.camera.fov,near:owned!.camera.near,far:owned!.camera.far};};
   const tick=(time:number)=>{if(abort.signal.aborted||finished)return;try{
    const index=Math.max(0,count-warmupFrames),warming=count<warmupFrames;
    if(config.mode==='path'&&index>=path.length){finish('completed');return;}
    const interval=previous===null?null:time-previous;previous=time;controls?.update(interval===null?0:Math.min(interval/1000,.05));
    const step=path[Math.min(index,path.length-1)];const metrics:FrameMetrics={...owned!.render(config.mode==='path'?step.pose:undefined),rafIntervalMs:interval};
    if(!firstPixelsVerified){const pixels=owned!.capture();let distinct=0;for(let p=4;p<pixels.length;p+=4)if(pixels[p]!==pixels[0]||pixels[p+1]!==pixels[1]||pixels[p+2]!==pixels[2])distinct++;const rect=canvas.getBoundingClientRect();if(distinct<100||rect.width<2||rect.height<2)throw new Error(`Première image invalide : ${distinct} pixels distincts du fond, canvas ${rect.width} × ${rect.height}.`);firstPixelsVerified=true;run.firstImageMs=performance.now()-started;}
    if(warming)run.warmupFrames++;else{
     run.samples.push({...metrics,segment:config.mode==='path'?step.segment:-1,elapsedMs:time-started,pose:config.mode==='path'?step.pose:capturePose(),backend:owned!.backend});
     if(run.samples.length>3600){run.samples.shift();run.retainedSamplesOnly=true;}
     if(config.mode==='path'&&index%framesPerSegment===0){const thumbnail=document.createElement('canvas');thumbnail.width=320;thumbnail.height=Math.round(320*canvas.height/canvas.width);thumbnail.getContext('2d')?.drawImage(canvas,0,0,thumbnail.width,thumbnail.height);run.captures.push({segment:step.segment,pose:step.pose,image:thumbnail.toDataURL('image/jpeg',.65)});}
    }
    if(owned!.fallbackReason&&!run.fallbacks.includes(owned!.fallbackReason))run.fallbacks.push(owned!.fallbackReason);
    if(!published||time-published>=200){published=time;setDisplay({status:'ready',message:warming?`Préchauffage · ${count+1}/${warmupFrames}`:config.mode==='path'?`${step.segment+1}/8 · ${segmentNames[step.segment]}`:'Exploration libre',progress:config.mode==='path'?{completed:index,total:path.length}:null,metrics,frameIntervalMs:interval,position:owned!.camera.position.toArray().map(v=>v.toFixed(1)).join(' · ')});}
    count++;frame=requestAnimationFrame(tick);
   }catch(error){finish('error',`Rendu interrompu : ${error instanceof Error?error.message:String(error)}`);}};
   resize=new ResizeObserver(()=>{const size=canvas.getBoundingClientRect();if(size.width>0&&size.height>0){const width=Math.round(size.width),height=Math.round(size.height);if(config.mode==='path'&&(width!==run.resolution[0]||height!==run.resolution[1])){finish('error','La résolution a changé pendant le parcours. Relancez pour conserver un protocole identique.');return;}owned!.resize(width,height);}});resize.observe(canvas);frame=requestAnimationFrame(tick);
  }catch(error){if(!abort.signal.aborted)finish('error',`Chargement interrompu : ${error instanceof Error?error.message:String(error)}`);}})();
  return()=>{abort.abort();release();};
 // Configuration is frozen from explicit launch until stop/completion.
 },[enabled,attempt]);
 const running=display.status==='loading'||display.status==='ready';
 const restart=useCallback(()=>{if(running||availability.status!=='ready')return;if(report)setConfig({...report.configuration});setReport(null);setDisplay({...initialDisplay,status:'loading',message:'Chargement d’Emerald Square…'});setEnabled(true);setAttempt(v=>v+1);},[running,availability.status,report]);
 const stop=useCallback(()=>finishRef.current('stopped'),[]);
 const showReport=useCallback((id:string)=>{if(running)return;const saved=history.find(r=>r.id===id);if(saved){setConfig({...saved.configuration});setReport(saved);setDisplay(old=>({...old,status:saved.status,message:saved.error??'Rapport de navigation archivé'}));}},[running,history]);
 const exportReport=useCallback(()=>{if(!report||running)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`emerald-${report.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},[report,running]);
 const state=useMemo(()=>{
  const next=initialSnapshot('15-virtualized-integration');
  next.running=running;
  next.execution={status:running?'running':display.status==='idle'?'idle':display.status==='error'?'error':display.status==='completed'?'completed':'stopped',phase:display.message,lastCampaign:null};
  next.benchLabel=config.mode==='path'?'Lancer le parcours urbain':'Explorer Emerald Square';
  if(display.status!=='idle'&&!running)next.benchLabel=config.mode==='path'?'Relancer le parcours urbain':'Relancer Emerald Square';
  return next;
 },[running,display.status,display.message,config.mode]);
 const actions=useMemo<LabActions>(()=>({newExecution:()=>{if(!running){setEnabled(false);setReport(null);setDisplay(initialDisplay);}},switchModule:id=>{if(!running)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},runBenchmark:restart,stopBenchmark:stop,runPain:stop,openReport:()=>{if(history[0])showReport(history[0].id);},closeReport:()=>{},copyReport:()=>{},refreshReport:()=>{},openFinder:()=>{} }),[running,restart,stop,history,showReport]);
 const emerald=useMemo(()=>({...display,availability,retryAvailability:()=>setAvailabilityAttempt(v=>v+1),availableTriangles:availableTriangles*config.cities,config,setConfig:(value:Partial<EmeraldConfig>)=>{if(!running)setConfig(old=>({...old,...value}));},report,history,showReport,exportReport,stop,restart}),[display,availability,availableTriangles,config,running,report,history,showReport,exportReport,stop,restart]);
 const value=useMemo(()=>({state,actions,onIntegrationScene:(scene:IntegrationScene)=>{if(!running)onScene(scene);},emerald}),[state,actions,running,onScene,emerald]);
 return <LabContext.Provider value={value}><LabShell webglRef={webglRef} webgpuRef={webgpuRef} chartRef={chartRef}/></LabContext.Provider>;
}
