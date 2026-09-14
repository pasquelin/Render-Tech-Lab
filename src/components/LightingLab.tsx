import {useEffect,useRef,useState} from 'react';
import {LIGHTING_LIGHT_CONTROLS,LIGHTING_MODULE,LIGHTING_PROTOCOL,LIGHTING_UI} from '../../16-lighting-transport/index.ts';
import type {LightingArchiveEntry,LightingArchiveHistory,LightingConfig,LightingController,LightingFrame,LightingLight,LightingReport,LightingVector} from '../../16-lighting-transport/index.ts';
import {initialSnapshot,type LabActions} from '../lab/labState.ts';
import {navigateLabRoute} from '../lab/navigation.ts';
import {parseMarkdownToHtml} from '../lab/markdown.ts';
import {LabContext} from './LabContext.tsx';
import {LabShell} from './LabShell.tsx';
import {LabStats} from './LabStats.tsx';
import {LabSection} from './ui/LabSection.tsx';
import {Input} from './ui/Input.tsx';
import {Select} from './ui/Select.tsx';
import {Button} from './ui/Button.tsx';
import {MetricGrid} from './ui/MetricGrid.tsx';
import {StatusBadge} from './ui/StatusBadge.tsx';
import {EmptyState} from './ui/EmptyState.tsx';
import {LoadingState} from './ui/LoadingState.tsx';
import {ErrorState} from './ui/ErrorState.tsx';
import {ProgressPanel} from './ui/ProgressPanel.tsx';
import {ReportSummary} from './ui/ReportSummary.tsx';
import {ActionBar} from './ui/ActionBar.tsx';

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
  const previousRaf=useRef<number|null>(null);
  const pending=useRef<LightingConfig|null>(null),failRef=useRef<(error:unknown)=>void>(()=>{});
  const [status,setStatus]=useState<Status>('idle'),[kind,setKind]=useState<RunKind>('interactive');
  const [request,setRequest]=useState<{id:number;kind:RunKind}|null>(null);
  const [message,setMessage]=useState('Prêt à lancer la scène.');
  const [config,setConfig]=useState<LightingConfig|null>(null),[frame,setFrame]=useState<LightingFrame|null>(null);
  const [report,setReport]=useState<LightingReport|null>(null);
  const [archives,setArchives]=useState<LightingArchiveHistory>({formatVersion:1,latestAttempt:null,latestValid:null,attempts:[]});
  const [selectedPackage,setSelectedPackage]=useState(''),[archiveMessage,setArchiveMessage]=useState('Lecture des archives…');
  const reportRequest=useRef<AbortController|null>(null);
  const archivedReport=archives.attempts.find(entry=>entry.package===selectedPackage);
  const reportLabel=(entry:LightingArchiveEntry)=>entry.status==='measured'?'Comparaison mesurée':entry.status==='rejected'?'Comparaison rejetée':entry.status==='error'?'Comparaison en erreur':'Comparaison arrêtée';
  const [modal,setModal]=useState(()=>initialSnapshot(moduleId).reportModal);
  const active=status==='loading'||status==='running';
  const liveControls=status==='running'&&kind==='interactive';
  const launchLabel=kind==='comparison'?'Comparer brut / BVH':LIGHTING_MODULE.benchLabel;

  const release=()=>{
    cancelAnimationFrame(raf.current);
    controllerRef.current?.dispose();controllerRef.current=null;
    pending.current=null;updating.current=false;previousRaf.current=null;
    delete window.lightingBench16;
  };
  const stop=()=>{
    if(!busy.current)return;
    abortRef.current?.abort();release();busy.current=false;
    setStatus('stopped');setMessage('Exécution arrêtée. Les ressources de rendu ont été libérées.');
  };
  const launch=()=>{
    if(busy.current)return;
    busy.current=true;frameRef.current=null;setFrame(null);setStatus('loading');setMessage('Chargement du banc Lumière…');
    setModal(old=>({...old,open:false}));
    if(kind==='comparison')delete window.__lightingBench16Report;
    setRequest({id:++generation.current,kind});
  };

  useEffect(()=>{
    document.title='16 · Lumière — render-tech-lab';
    return()=>{generation.current++;abortRef.current?.abort();reportRequest.current?.abort();release();};
  },[]);

  useEffect(()=>{
    if(active)return;
    const abort=new AbortController();
    void fetch('/api/lighting-report',{signal:abort.signal}).then(async response=>{
      if(!response.ok)throw Error('Archives indisponibles.');
      const history=await response.json() as LightingArchiveHistory;
      if(abort.signal.aborted)return;
      setArchives(history);setArchiveMessage(history.attempts.length?'':'Aucune campagne archivée pour ce banc.');
      setSelectedPackage(previous=>history.attempts.find(entry=>entry.id===report?.id)?.package??
        (history.attempts.some(entry=>entry.package===previous)?previous:history.latestAttempt??history.latestValid??''));
    }).catch(error=>{if(!abort.signal.aborted)setArchiveMessage(error instanceof Error?error.message:String(error));});
    return()=>abort.abort();
  },[active,report?.id]);

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
        const options={signal:abort.signal,onProgress:(value:string)=>{if(current())setMessage(value);}};
        if(request.kind==='comparison') {
          setStatus('running');
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
        controllerRef.current=controller;const initial=copyConfig(controller.getConfig());configRef.current=initial;setConfig(initial);
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
    if(!archivedReport)return;
    reportRequest.current?.abort();
    const abort=new AbortController();reportRequest.current=abort;
    const path='reports/'+moduleId+'/'+archivedReport.package+'/REPORT.md';
    setModal({open:true,title:'Rapport · 16 Lumière',path,raw:'',html:'Chargement du rapport…',feedback:''});
    void fetch('/api/lighting-report?package='+encodeURIComponent(archivedReport.package),{signal:abort.signal}).then(async response=>{
      if(!response.ok)throw Error('Lecture du rapport archivé impossible.');
      const raw=await response.text();
      if(!abort.signal.aborted)setModal(old=>({...old,raw,html:parseMarkdownToHtml(raw)}));
    }).catch(error=>{if(!abort.signal.aborted)setModal(old=>({...old,html:error instanceof Error?error.message:String(error),feedback:'Le rapport n’a pas pu être chargé.'}));});
  };
  const downloadReport=()=>{
    if(!archivedReport)return;
    const link=document.createElement('a');
    link.href='/api/report-artifact?package='+encodeURIComponent(moduleId+'/'+archivedReport.package)+'&file=objects%2Fresult.json.gz';
    link.download='lumiere-'+archivedReport.id+'.json.gz';link.click();
  };
  const actions:LabActions={
    switchModule:id=>{if(!busy.current)navigateLabRoute(id);},setMode:()=>{},setScenario:()=>{},
    runBenchmark:launch,runPain:stop,stopBenchmark:stop,openReport,
    closeReport:()=>setModal(old=>({...old,open:false})),refreshReport:openReport,
    copyReport:()=>{void navigator.clipboard.writeText(modal.raw).then(()=>setModal(old=>({...old,feedback:'Rapport copié.'}))).catch(()=>setModal(old=>({...old,feedback:'Copie indisponible.'})));},
    openFinder:()=>{void fetch('/api/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:moduleId,folder:'reports'})})
      .then(response=>{if(!response.ok)throw new Error('Dossier indisponible');return response.json();})
      .then(()=>setModal(old=>({...old,feedback:'Dossier des rapports ouvert.'}))).catch(()=>setModal(old=>({...old,feedback:'Rapports : reports/'+moduleId+'/'})));},
  };
  const stats={submit:number(frame?.cpuSubmitMs,' ms'),cpuFrame:number(frame?.cpuFrameMs,' ms'),fps:number(frame?.fps,' FPS'),drawCalls:number(frame?.drawCalls)};
  const contextState={...initialSnapshot(moduleId),running:active,framePresented:!!frame,reportModal:modal,
    stats:{...initialSnapshot(moduleId).stats,...stats},
    execution:{status:status==='loading'?'running' as const:status,phase:message,lastCampaign:null}};
  const reportActions=archivedReport?<ActionBar><Button id="lighting-open-report" variant="secondary" disabled={active} onClick={openReport}>Lire le rapport</Button><Button variant="outline" disabled={active} onClick={downloadReport}>Exporter les données</Button></ActionBar>:null;
  const sidebar=<>
    <LabSection id="lab-mode-card" number={1} title="Configuration / mode d’exécution" help={LIGHTING_UI.modeHint}>
      <Select id="lighting-run-kind" label="Exécution" value={kind} disabled={active} onChange={event=>setKind(event.target.value as RunKind)}>
        <option value="interactive">Explorer la lumière</option><option value="comparison">Comparer brut / BVH</option>
      </Select>
      {config?<><Select id="lighting-variant" label="Parcours des obstacles" value={config.variant} disabled={!liveControls} onChange={event=>change({variant:event.target.value as LightingConfig['variant']})}>
        <option value="brute">Brut · tous les obstacles</option><option value="bvh">BVH · hiérarchie spatiale</option>
      </Select>
      <Input id="lighting-door" label={'Ouverture de la porte · '+Math.round(config.doorAngle*180/Math.PI)+'°'} type="range" min={0} max={90} step={1} value={config.doorAngle*180/Math.PI} disabled={!liveControls} onChange={event=>change({doorAngle:Number(event.target.value)*Math.PI/180})}/>
      <Input id="lighting-camera" label="Position de la caméra" type="range" min={0} max={1} step={.01} value={config.cameraT} disabled={!liveControls} onChange={event=>change({cameraT:Number(event.target.value)})}/>
      <Input id="lighting-lights-on" label="Éclairage allumé" type="checkbox" checked={config.lightIntensity>0} disabled={!liveControls} onChange={event=>change({lightIntensity:event.target.checked?1:0})}/>
      {config.lights.map(light=><LightFields key={light.id} light={light} disabled={!liveControls} onChange={patch=>changeLight(light.id,patch)}/>)}</>:<p className="text-xs text-base-content/60">Les commandes de la porte, de la caméra et des trois lampes apparaissent après le lancement de l’exploration.</p>}
    </LabSection>
    <LabSection id="lab-metrics-card" number={2} title="Métriques en direct">
      <LabStats stats={stats} provenance="1000 ÷ intervalle rAF. La cadence dépend aussi de l’écran ; aucune fréquence physique n’est déduite."/>
      <MetricGrid label="Éclairage" items={[
        {id:'lighting-cpu-transport',label:'Transport CPU',value:number(frame?.cpuTransportMs,' ms')},
        {id:'lighting-gpu',label:'Rendu GPU',value:number(frame?.gpuMs,' ms')},
        {id:'lighting-raf',label:'Intervalle rAF',value:number(frame?.rafDeltaMs,' ms')},
        {id:'lighting-triangles',label:'Triangles',value:number(frame?.triangles)},
        {id:'lighting-refit',label:'Mise à jour BVH CPU',value:number(frame?.bvhRefitMs,' ms')},
        {id:'lighting-rays',label:'Rayons réutilisés',value:frame?.raysReused==null?'Non mesuré':String(frame.raysReused)+' / '+number(frame.totalRays)},
      ]}/>
      {!active&&frame?<p className="text-xs text-base-content/60">Dernière observation de l’exploration arrêtée.</p>:null}
    </LabSection>
    <LabSection id="lab-run-card" number={3} title="Campagne / comparaison">
      <StatusBadge id="bench-status" tone={status==='error'?'error':status==='running'?'success':'neutral'}>{status==='idle'?'Prêt':status==='loading'?'Chargement':status==='running'?'En cours':status==='stopped'?'Arrêté':status==='error'?'Erreur':'Terminé'}</StatusBadge>
      <p className="text-xs text-base-content/60">{LIGHTING_UI.protocol}</p>
      <p className="text-xs text-base-content/60">{LIGHTING_PROTOCOL.width} × {LIGHTING_PROTOCOL.height} · DPR {LIGHTING_PROTOCOL.pixelRatio} · qualité identique pour les deux variantes.</p>
      {active?<Button id="lighting-stop" variant="danger" onClick={stop}>Arrêter</Button>:status==='idle'?<p className="text-xs">Lancez le mode choisi depuis la fiche centrale.</p>:<Button id="lighting-relaunch" onClick={launch}>{launchLabel}</Button>}
      {active?<ProgressPanel message={message}/>:null}
    </LabSection>
    <LabSection id="lab-report-card" number={4} title="Rapports et suivi">
      {archives.attempts.length?<Select id="lighting-report-history" label="Campagne archivée" value={selectedPackage} disabled={active} onChange={event=>setSelectedPackage(event.target.value)}>
        {archives.attempts.map(entry=><option key={entry.package} value={entry.package}>{entry.timestamp+' · '+reportLabel(entry)+(entry.package===archives.latestValid?' · dernier résultat valide':'')}</option>)}
      </Select>:null}
      {archivedReport?<><ReportSummary title={reportLabel(archivedReport)}>
        <p className="text-xs">{archivedReport.qualityPassed===true?'Contrôle des images réussi.':archivedReport.qualityPassed===false?'Le contrôle des images a échoué.':'Contrôle des images non terminé.'}</p>
        <p className="text-xs text-base-content/60">{archivedReport.timestamp}</p>
      </ReportSummary>{reportActions}</>:<p className="text-xs text-base-content/60">{archiveMessage}</p>}

    </LabSection>
  </>;
  const viewport=<main data-lighting-status={status} className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-base-100 flex flex-col">
    {active?<><canvas id="lighting-canvas" ref={canvasRef} aria-label="Deux pièces et trois sources lumineuses" className="block w-full h-full min-h-0 object-contain"/>
      {status==='loading'?<div className="absolute inset-0 flex items-center justify-center bg-base-100"><LoadingState message={message}/></div>:null}
      {kind==='comparison'?<div className="absolute left-3 right-3 bottom-3"><ProgressPanel message={message}/></div>:null}
    </>:<div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
      {status==='error'?<ErrorState message={message} action={<Button onClick={launch}>{launchLabel}</Button>}/>:<EmptyState title={status==='idle'?'16 · Lumière':status==='stopped'?'Exécution arrêtée':'Comparaison terminée'}>
        <p className="max-w-xl text-sm text-base-content/70">{status==='idle'?LIGHTING_MODULE.description:message}</p>
        <p className="max-w-xl text-xs text-base-content/55">{LIGHTING_UI.idleNote}</p>
        <ActionBar><Button id="lighting-launch" onClick={launch}>{launchLabel}</Button>{archivedReport?<Button variant="secondary" onClick={openReport}>Lire le rapport</Button>:null}</ActionBar>
      </EmptyState>}
    </div>}
  </main>;
  return <LabContext.Provider value={{state:contextState,actions}}><LabShell webglRef={canvasRef} webgpuRef={unusedGpu} chartRef={unusedChart} viewport={viewport} sidebar={sidebar}/></LabContext.Provider>;
}
