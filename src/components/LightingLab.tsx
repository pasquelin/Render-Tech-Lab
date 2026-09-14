import {useEffect,useMemo,useRef,useState} from 'react';
import {LIGHTING_LIGHT_CONTROLS,LIGHTING_MODULE} from '../../16-lighting-transport/index.ts';
import type {LightingConfig,LightingController,LightingFrame,LightingLight,LightingReport,LightingVector} from '../../16-lighting-transport/index.ts';
import {initialSnapshot,type LabActions} from '../lab/labState.ts';
import {campaignSummary} from '../lab/campaignSummary.ts';
import {navigateLabRoute} from '../lab/navigation.ts';
import {parseMarkdownToHtml} from '../lab/markdown.ts';
import {loadMarkdownReport} from '../lab/reportReader.ts';
import {LabContext} from './LabContext.tsx';
import {LabShell} from './LabShell.tsx';
import {Input} from './ui/Input.tsx';
import {Select} from './ui/Select.tsx';
import {MetricGrid} from './ui/MetricGrid.tsx';

type Status='idle'|'loading'|'running'|'completed'|'stopped'|'error';
type RunKind='interactive'|'comparison';
const moduleId='16-lighting-transport';
const number=(value:number|null|undefined,unit='')=>value==null||!Number.isFinite(value)?'Non mesuré':value.toFixed(unit===' ms'?2:0)+unit;
const copyConfig=(config:LightingConfig):LightingConfig=>({...config,lights:config.lights.map(light=>({...light,color:[...light.color],position:[...light.position]}))});
const displayColor=(color:LightingVector)=>'#'+color.map(value=>{
  const x=Math.min(1,Math.max(0,value));
  return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055)).toString(16).padStart(2,'0');
}).join('');
const linearColor=(hex:string):LightingVector=>[1,3,5].map(offset=>{
  const x=parseInt(hex.slice(offset,offset+2),16)/255;
  return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
}) as LightingVector;

declare global {
  interface Window {
    lightingBench16?: {snapshot:()=>{status:'running';config:LightingConfig;frame:LightingFrame|null}};
    __lightingBench16Report?: LightingReport;
  }
}

function LightFields({light,disabled,onChange}:{light:LightingLight;disabled:boolean;onChange:(patch:Partial<LightingLight>)=>void}) {
  const prefix='lighting-'+light.id;
  const controls=LIGHTING_LIGHT_CONTROLS[light.id];
  if(!controls)return <p className="text-xs text-base-content/60">Réglages indisponibles pour {light.id}.</p>;
  const move=(axis:0|2,value:number)=>{const position:LightingVector=[...light.position];position[axis]=value;onChange({position});};
  return <div className="space-y-2" data-light-id={light.id}>
    <h3 className="text-xs font-semibold">{controls.label}</h3>
    <div className="grid grid-cols-2 gap-2">
      <Input id={prefix+'-color'} label="Couleur" type="color" value={displayColor(light.color)} disabled={disabled} onChange={event=>onChange({color:linearColor(event.target.value)})}/>
      <Input id={prefix+'-intensity'} label={'Intensité · '+light.intensity.toFixed(2)} type="range" min={0} max={controls.maxIntensity} step={.01} value={light.intensity} disabled={disabled} onChange={event=>onChange({intensity:Number(event.target.value)})}/>
      <Input id={prefix+'-x'} label="Gauche / droite" type="range" min={controls.minX} max={controls.maxX} step={.02} value={light.position[0]} disabled={disabled} onChange={event=>move(0,Number(event.target.value))}/>
      <Input id={prefix+'-z'} label="Avant / arrière" type="range" min={controls.minZ} max={controls.maxZ} step={.02} value={light.position[2]} disabled={disabled} onChange={event=>move(2,Number(event.target.value))}/>
    </div>
  </div>;
}

/** React owns lifecycle and controls; all scene, transport and measurement work stays in the public runner. */
export function LightingLab() {
  const canvasRef=useRef<HTMLCanvasElement>(null),unusedGpu=useRef<HTMLCanvasElement>(null),unusedChart=useRef<HTMLCanvasElement>(null);
  const controllerRef=useRef<LightingController|null>(null),abortRef=useRef<AbortController|null>(null);
  const frameRef=useRef<LightingFrame|null>(null),configRef=useRef<LightingConfig|null>(null);
  const generation=useRef(0),raf=useRef(0),busy=useRef(false),updating=useRef(false);
  const previousRaf=useRef<number|null>(null),resizeRef=useRef<ResizeObserver|null>(null);
  const pending=useRef<LightingConfig|null>(null),failRef=useRef<(error:unknown)=>void>(()=>{});
  const [status,setStatus]=useState<Status>('idle'),[kind,setKind]=useState<RunKind>('interactive');
  const [request,setRequest]=useState<{id:number;kind:RunKind}|null>(null);
  const [message,setMessage]=useState('Prêt à lancer la scène.');
  const [config,setConfig]=useState<LightingConfig|null>(null),[frame,setFrame]=useState<LightingFrame|null>(null);
  const [report,setReport]=useState<LightingReport|null>(null);
  const reportRequest=useRef<AbortController|null>(null);
  const [modal,setModal]=useState(()=>initialSnapshot(moduleId).reportModal);
  const active=status==='loading'||status==='running';
  const liveControls=status==='running'&&kind==='interactive';
  const launchLabel=kind==='comparison'?'Comparer brut / BVH':LIGHTING_MODULE.benchLabel;

  const release=()=>{
    cancelAnimationFrame(raf.current);
    resizeRef.current?.disconnect();resizeRef.current=null;
    controllerRef.current?.dispose();controllerRef.current=null;
    pending.current=null;updating.current=false;previousRaf.current=null;
    delete window.lightingBench16;
  };
  const stop=()=>{
    if(!busy.current)return;
    abortRef.current?.abort();release();busy.current=false;
    setStatus('stopped');setMessage(request?.kind==='interactive'?'Exploration arrêtée.':'Comparaison arrêtée.');
  };
  const launch=()=>{
    if(busy.current)return;
    busy.current=true;frameRef.current=null;setFrame(null);setReport(null);setStatus('loading');setMessage('Chargement du banc Lumière…');
    setModal(old=>({...old,open:false}));
    if(kind==='comparison')delete window.__lightingBench16Report;
    setRequest({id:++generation.current,kind});
  };

  useEffect(()=>{
    document.title='16 · Lumière — render-tech-lab';
    return()=>{generation.current++;abortRef.current?.abort();reportRequest.current?.abort();release();};
  },[]);

  useEffect(()=>{
    if(!request)return;
    const abort=new AbortController();abortRef.current=abort;
    const current=()=>generation.current===request.id&&!abort.signal.aborted;
    const fail=(error:unknown)=>{
      if(!current())return;
      generation.current++;abort.abort();
      release();busy.current=false;setStatus('error');setMessage(error instanceof Error?error.message:String(error));
    };
    failRef.current=fail;
    void(async()=>{
      try {
        const runner=await import('../../16-lighting-transport/index.ts');
        if(!current())return;
        const canvas=canvasRef.current;
        if(!canvas)throw new Error('La surface de rendu est indisponible.');
        const options={signal:abort.signal,onProgress:(value:string)=>{if(current()){setMessage(value);if(request.kind==='comparison'&&value.startsWith('Images identiques'))setStatus('running');}}};
        if(request.kind==='comparison') {
          const result=await runner.runLightingComparison(canvas,options);
          if(generation.current!==request.id)return;
          setReport(result);window.__lightingBench16Report=result;
          const stopped=abort.signal.aborted||result.status==='stopped';
          setStatus(stopped?'stopped':result.status==='error'?'error':'completed');
          setMessage(stopped?'Comparaison arrêtée.':result.status==='error'?result.error??'La comparaison a rencontré une erreur.':result.status==='measured'?'Comparaison terminée. Consultez ses mesures et ses limites.':'Comparaison rejetée par le contrôle des images.');
          release();busy.current=false;
          return;
        }
        const controller=await runner.createLightingBench(canvas,options);
        if(!current()){controller.dispose();return;}
        controllerRef.current=controller;
        const resize=()=>{const box=canvas.getBoundingClientRect();if(box.width>0&&box.height>0){controller.resize(Math.round(box.width),Math.round(box.height));previousRaf.current=null;}};
        resize();resizeRef.current=new ResizeObserver(resize);resizeRef.current.observe(canvas);
        const initial=copyConfig(controller.getConfig());configRef.current=initial;setConfig(initial);
        setStatus('running');setMessage('Scène active. Déplacez la porte ou modifiez les lampes.');
        const hook={snapshot:()=>({status:'running' as const,config:copyConfig(controller.getConfig()),frame:frameRef.current?{...frameRef.current}:null})};
        window.lightingBench16=hook;
        let published=-Infinity;
        const tick=(time:number)=>{
          if(!current())return;
          try {
            if(!updating.current) {
              const interval=previousRaf.current===null?null:time-previousRaf.current;
              const next={...controller.render(),rafDeltaMs:interval,fps:interval!==null&&interval>0?1000/interval:null};
              previousRaf.current=time;frameRef.current=next;
              if(time-published>=200){setFrame({...next});published=time;}
            }else previousRaf.current=null;
            raf.current=requestAnimationFrame(tick);
          } catch(error){fail(error);}
        };
        raf.current=requestAnimationFrame(tick);
      } catch(error){fail(error);}
    })();
    return()=>{abort.abort();release();};
  },[request]);

  const change=(patch:Partial<LightingConfig>)=>{
    const controller=controllerRef.current,currentConfig=configRef.current;
    if(!liveControls||!controller||!currentConfig)return;
    const next=copyConfig({...currentConfig,...patch});configRef.current=next;setConfig(next);pending.current=next;
    if(updating.current)return;
    const owner=generation.current;updating.current=true;
    void(async()=>{
      try {
        while(pending.current&&generation.current===owner&&controllerRef.current===controller) {
          const nextConfig=pending.current;pending.current=null;
          const nextFrame=await controller.update(nextConfig);
          if(generation.current!==owner||controllerRef.current!==controller)return;
          previousRaf.current=null;frameRef.current=nextFrame;setFrame({...nextFrame});
        }
      } catch(error){if(generation.current===owner&&controllerRef.current===controller)failRef.current(error);}
      finally{if(generation.current===owner)updating.current=false;}
    })();
  };
  const changeLight=(id:string,patch:Partial<LightingLight>)=>{
    const current=configRef.current;if(!current)return;
    change({lights:current.lights.map(light=>light.id===id?{...light,...patch}:light)});
  };
  const openReport=()=>{
    if(active)return;
    reportRequest.current?.abort();
    const abort=new AbortController();reportRequest.current=abort;
    setModal({open:true,title:'Rapport · 16 Lumière',path:'reports/'+moduleId+'/',raw:'',html:'Chargement du rapport…',feedback:''});
    void loadMarkdownReport(url=>fetch(url,{signal:abort.signal}),moduleId).then(result=>{
      if(!abort.signal.aborted)setModal(old=>({...old,raw:result.ok?result.raw:'',html:result.ok?parseMarkdownToHtml(result.raw):result.raw,feedback:result.feedback}));
    }).catch(error=>{if(!abort.signal.aborted)setModal(old=>({...old,html:error instanceof Error?error.message:String(error),feedback:'Le rapport n’a pas pu être chargé.'}));});
  };
  const actions:LabActions={
    switchModule:id=>{if(!busy.current)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},
    runBenchmark:launch,runPain:stop,stopBenchmark:stop,openReport,
    newExecution:()=>{if(!active){generation.current++;setRequest(null);setStatus('idle');setFrame(null);setMessage('Prêt à lancer la scène.');}},
    closeReport:()=>setModal(old=>({...old,open:false})),refreshReport:openReport,
    copyReport:()=>{void navigator.clipboard.writeText(modal.raw).then(()=>setModal(old=>({...old,feedback:'Rapport copié.'}))).catch(()=>setModal(old=>({...old,feedback:'Copie indisponible.'})));},
    openFinder:()=>{void fetch('/api/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:moduleId,folder:'reports'})})
      .then(response=>{if(!response.ok)throw new Error('Dossier indisponible');return response.json();})
      .then(()=>setModal(old=>({...old,feedback:'Dossier des rapports ouvert.'}))).catch(()=>setModal(old=>({...old,feedback:'Rapports : reports/'+moduleId+'/'})));},
  };
  const stats={submit:number(frame?.cpuSubmitMs,' ms'),cpuFrame:number(frame?.cpuFrameMs,' ms'),fps:number(frame?.fps,' FPS'),drawCalls:number(frame?.drawCalls)};
  const lastCampaign=useMemo(()=>report?.status==='measured'&&report.quality.passed===true?campaignSummary({
    test:moduleId,timestamp:report.timestamp,status:report.status,
    records:report.blocks.filter(block=>block.kind==='gpu-isolated').flatMap(block=>block.frames.map(value=>({variant:block.variant,cpuMs:null,gpuMs:value.gpuMs}))),
  }):null,[report]);
  const contextState={...initialSnapshot(moduleId),mode:'classic' as const,running:active,framePresented:status==='running'&&(kind==='comparison'||!!frame),reportModal:modal,
    benchLabel:launchLabel,benchStatus:message,showPain:false,showWebgl:active,showWebgpu:false,
    stats:{...initialSnapshot(moduleId).stats,...stats},
    execution:{kind:(request?.kind??kind)==='interactive'?'exploration' as const:'campaign' as const,status:status==='loading'?'running' as const:status,phase:message,lastCampaign}};
  const panels={
    configuration:<>
      <Select id="lighting-run-kind" label="Exécution" value={kind} disabled={active} onChange={event=>setKind(event.target.value as RunKind)}>
        <option value="interactive">Explorer la lumière</option><option value="comparison">Comparer brut / BVH</option>
      </Select>
      {liveControls&&config?<><Select id="lighting-variant" label="Parcours des obstacles" value={config.variant} disabled={!liveControls} onChange={event=>change({variant:event.target.value as LightingConfig['variant']})}>
        <option value="brute">Brut · tous les obstacles</option><option value="bvh">BVH · hiérarchie spatiale</option>
      </Select>
      <Input id="lighting-door" label={'Ouverture de la porte · '+Math.round(config.doorAngle*180/Math.PI)+'°'} type="range" min={0} max={90} step={1} value={config.doorAngle*180/Math.PI} disabled={!liveControls} onChange={event=>change({doorAngle:Number(event.target.value)*Math.PI/180})}/>
      <Input id="lighting-camera" label="Position de la caméra" type="range" min={0} max={1} step={.01} value={config.cameraT} disabled={!liveControls} onChange={event=>change({cameraT:Number(event.target.value)})}/>
      <Input id="lighting-lights-on" label="Éclairage allumé" type="checkbox" checked={config.lightIntensity>0} disabled={!liveControls} onChange={event=>change({lightIntensity:event.target.checked?1:0})}/>
      {config.lights.map(light=><LightFields key={light.id} light={light} disabled={!liveControls} onChange={patch=>changeLight(light.id,patch)}/>)}</>:<p className="text-xs text-base-content/60">Les commandes de la porte, de la caméra et des trois lampes apparaissent après le lancement de l’exploration.</p>}
    </>,
    metrics:<>
      <MetricGrid label="Éclairage" items={[
        {id:'lighting-cpu-transport',label:'Transport CPU',value:number(frame?.cpuTransportMs,' ms')},
        {id:'lighting-gpu',label:'Rendu GPU',value:number(frame?.gpuMs,' ms')},
        {id:'lighting-raf',label:'Intervalle rAF',value:number(frame?.rafDeltaMs,' ms')},
        {id:'lighting-resolution',label:'Résolution',value:frame&&canvasRef.current?`${canvasRef.current.width} × ${canvasRef.current.height} · DPR 1`:'Non mesurée'},
        {id:'lighting-triangles',label:'Triangles',value:number(frame?.triangles)},
        {id:'lighting-refit',label:'Mise à jour BVH CPU',value:number(frame?.bvhRefitMs,' ms')},
        {id:'lighting-rays',label:'Rayons réutilisés',value:frame?.raysReused==null?'Non mesuré':String(frame.raysReused)+' / '+number(frame.totalRays)},
      ]}/>
      {!active&&frame?<p className="text-xs text-base-content/60">Dernière observation de l’exploration arrêtée.</p>:null}
    </>,
  };
  return <LabContext.Provider value={{state:contextState,actions,panels}}><LabShell webglRef={canvasRef} webgpuRef={unusedGpu} chartRef={unusedChart}/></LabContext.Provider>;
}
