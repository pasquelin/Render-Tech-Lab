import type { RefObject } from 'react';
import { useLab } from './LabContext.tsx';
import type { IntegrationScene } from '../lab/emeraldView.ts';
import { defaultEmeraldConfig, summarizeEmerald, segmentNames, type EmeraldConfig, type EmeraldReport } from '../lab/emeraldCampaign.ts';
import { PreparationStation } from './PreparationStation.tsx';
import { LabStats } from './LabStats.tsx';
import { Select } from './ui/Select.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { Button } from './ui/Button.tsx';
import { ActionBar } from './ui/ActionBar.tsx';
import { ReportSummary } from './ui/ReportSummary.tsx';
import { LoadingState } from './ui/LoadingState.tsx';
import { ProgressPanel } from './ui/ProgressPanel.tsx';
import { ErrorState } from './ui/ErrorState.tsx';
const number=(value:number|null|undefined,digits=0)=>value===null||value===undefined?'Non mesuré':value.toLocaleString('fr-FR',{maximumFractionDigits:digits});
export function IntegrationSceneChoice(){const {emerald,onIntegrationScene,state}=useLab();return <Select id="integration-scene" label="Scène du banc 15" value={emerald?'emerald':'procedural'} disabled={state.running} onChange={event=>onIntegrationScene?.(event.target.value as IntegrationScene)}><option value="emerald">Emerald Square · ville réelle</option><option value="procedural">Fixture procédurale · tests ciblés</option></Select>;}
function EmeraldReportView({report}:{report:EmeraldReport}){
 const global=summarizeEmerald(report.samples);
 const rows=report.configuration.mode==='path'?segmentNames.map((name,index)=>({name,samples:report.samples.filter(s=>s.segment===index)})):[{name:'Exploration libre',samples:report.samples}];
 return <div className="space-y-4" data-emerald-report={report.id}>
  <ReportSummary title="Résumé de navigation"><p className="text-xs">{new Date(report.timestamp).toLocaleString('fr-FR')} · {report.configuration.cities} ville(s) · {report.configuration.detail==='maximum'?'Détails maximum':'Détail source'} · {report.configuration.diagnostic} · {report.resolution.join(' × ')} px</p><MetricGrid items={[{label:'Première image depuis le clic',value:number(report.firstImageMs,1),unit:'ms'},{label:'Préparation SDK',value:number(report.preparationMs,1),unit:'ms'},{label:'Images observées',value:String(global.frames)},{label:'Préchauffage exclu',value:String(report.warmupFrames),unit:'images'},{label:'CPU p50 / p95 / p99',value:global.cpu?`${number(global.cpu.p50,2)} / ${number(global.cpu.p95,2)} / ${number(global.cpu.p99,2)}`:'Non mesuré',unit:'ms'},{label:'rAF p50 / p95 / p99',value:global.raf?`${number(global.raf.p50,2)} / ${number(global.raf.p95,2)} / ${number(global.raf.p99,2)}`:'Non mesuré',unit:'ms'},{label:'FPS minimum observé',value:number(global.minFps,1)},{label:'GPU / VRAM',value:'Non mesuré'}]}/></ReportSummary>
  {rows.map(({name,samples},index)=>{const summary=summarizeEmerald(samples),capture=report.captures.find(c=>c.segment===index),last=samples.at(-1);return <ReportSummary key={name} title={name}><MetricGrid items={[{label:'Images',value:String(samples.length)},{label:'CPU p95',value:number(summary.cpu?.p95,2),unit:'ms'},{label:'rAF p95',value:number(summary.raf?.p95,2),unit:'ms'},{label:'FPS minimum',value:number(summary.minFps,1)},{label:'Derniers triangles soumis',value:number(last?.triangles)},{label:'Derniers clusters sélectionnés',value:number(last?.clusters)},{label:'Dernières pages attachées',value:report.configuration.diagnostic==='clusters'||report.configuration.diagnostic==='pages'?number(last?.residentPages):'Non mesuré'},{label:'Dernières évictions de pages',value:number(last?.pageEvictions)}]}/>{capture?<figure><img src={capture.image} width="320" alt={`Capture réelle : ${name}`} className="max-w-full rounded-box"/><figcaption className="text-xs text-base-content/60">Repère visuel au début du segment ; ce n’est pas une preuve de fidélité A/B.</figcaption></figure>:null}</ReportSummary>;})}
  <ReportSummary title="Provenance et limites"><p className="text-xs break-all">Source : {report.sourceKey} · trajet v{report.pathVersion} · {report.environment}</p><p className="text-xs">CPU : durée de l’appel de rendu. Cadence : intervalles requestAnimationFrame. Les coordonnées, les échantillons et le backend réellement exécuté sont exportables. Les surcoûts des captures peuvent affecter l’intervalle rAF suivant.</p><p className="text-xs">Comparaison A/B indisponible : pipeline optimisée complète absente et contrôle A/A instable. Le trajet est géométrique et reproductible ; les zones de rue et de végétation ne sont pas encore calibrées. Aucun gain ni mesure de VRAM n’est déduit.</p>{report.retainedSamplesOnly?<p className="text-xs">Résumé limité aux 3 600 dernières images de l’exploration.</p>:null}{report.fallbacks.length?<p className="text-xs">Replis observés : {report.fallbacks.join(' · ')}</p>:null}{report.error?<p role="alert" className="text-xs">{report.error}</p>:null}</ReportSummary>
 </div>;
}
export function EmeraldViewport({webglRef}:{webglRef:RefObject<HTMLCanvasElement|null>}){
 const {emerald:view,state,actions}=useLab();if(!view)return null;
 const runAction=<Button disabled={view.availability.status!=='ready'} onClick={actions.runBenchmark}>{state.benchLabel}</Button>;
 return <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-base-100 flex flex-col" data-emerald-status={view.status} data-rendered-mode={view.config.diagnostic}>
  {state.running?<div className={`relative flex-1 min-h-0 ${view.config.layout==='comparison'?'grid grid-cols-2':''}`}><div className="relative min-w-0 min-h-0 h-full"><canvas id="canvas-emerald" ref={webglRef} tabIndex={0} aria-label="Vue interactive Emerald Square" className={`absolute inset-0 block w-full h-full outline-none ${view.status==='ready'?'':'invisible'}`}/>{view.status==='ready'?<div className="absolute left-3 bottom-3 right-3 pointer-events-none bg-base-200/90 p-3 rounded-box text-xs"><p>{view.config.mode==='path'?view.message:'Exploration libre'} · {view.config.diagnostic==='beauty'?'Rendu texturé':view.config.diagnostic==='pages'?'Vert : pages d’indices réellement attachées':view.config.diagnostic==='clusters'?'Couleurs : identifiants réels de clusters':'Triangles réellement soumis'}</p>{view.progress?<ProgressPanel message={view.message} value={view.progress.completed} max={view.progress.total}/>:null}</div>:null}</div>{view.config.layout==='comparison'?<div className="border-l border-base-content/15 p-6"><ReportSummary title="B · Web Geometry indisponible"><p className="text-sm">La pipeline optimisée complète ne rend pas cette ville. Aucun second rendu ni résultat A/B n’est présenté.</p></ReportSummary></div>:null}</div>:null}
  {view.status==='loading'?<div className="absolute inset-0 bg-base-100/95 p-6"><LoadingState message={view.message}/>{view.progress?<ProgressPanel message="Chargement avant la première image" value={view.progress.completed} max={view.progress.total}/>:null}</div>:null}
  {!state.running?<PreparationStation presentation={{description:`Emerald Square : ${view.config.mode==='path'?'un parcours urbain reproductible en huit segments':'une exploration libre de la ville réelle'}. Observez la géométrie et les compteurs de navigation.`,question:'Comment la navigation se comporte-t-elle à cette étendue et à ce niveau de détail ?',protocol:'A : Three.js standard. Diagnostics : clusters exacts du SDK. B optimisé indisponible ; aucune comparaison mesurée tant que A/A est instable.',steps:['Préparation','Première image','Préchauffage','Navigation','Résumé'],metadata:[['Scène','Emerald Square'],['Étendue',`${view.config.cities} ville(s) · ${number(view.availableTriangles)} triangles`],['Détail',view.config.detail==='maximum'?'Détails maximum':'Détail source'],['Caméra',view.config.mode==='path'?'Parcours imposé':view.config.camera==='free'?'Libre':'Orbite'],['Vue',view.config.diagnostic],['Résolution','Taille du canvas au lancement ; figée pour le parcours']]}} footer={<ActionBar onNewExecution={view.status!=='idle'?actions.newExecution:undefined}>{runAction}{view.report?<><Button variant="secondary" onClick={()=>document.querySelector('[data-emerald-report]')?.scrollIntoView({behavior:'smooth'})}>Voir le rapport</Button><Button variant="ghost" onClick={view.exportReport}>Exporter le rapport JSON</Button></>:view.history[0]?<Button variant="secondary" onClick={()=>view.showReport(view.history[0].id)}>Voir le rapport</Button>:null}</ActionBar>}>{view.report?<EmeraldReportView report={view.report}/>:<><p className="text-xs" data-emerald-availability={view.availability.status}>{view.availability.message}</p>{view.availability.status==='error'?<ErrorState message={view.availability.message} action={<Button onClick={view.retryAvailability}>Réessayer la disponibilité</Button>}/>:null}</>}</PreparationStation>:null}
 </main>;
}
function useEmeraldPanel() {
  const ctx = useLab();
  const view = ctx.emerald;
  const config = view?.config ?? defaultEmeraldConfig;
  return { ...ctx, view, config };
}

export function EmeraldModeFields() {
  const { view, config, onIntegrationScene, state } = useEmeraldPanel();
  if (!view) return null;
  const set = <K extends keyof EmeraldConfig>(key: K, value: EmeraldConfig[K]) => view.setConfig?.({ [key]: value });
  const locked = state.running || view.status !== 'idle';
  return (
    <>
      <Select id="emerald-scene" label="Scène du banc 15" value="emerald" disabled={locked} onChange={e => onIntegrationScene?.(e.target.value as IntegrationScene)}>
        <option value="emerald">Emerald Square · ville réelle</option>
        <option value="procedural">Fixture procédurale · tests ciblés</option>
      </Select>
      <Select id="emerald-extent" label="Étendue" help="Transformations répétées ; géométries et textures partagées." value={config.cities} disabled={locked} onChange={e => set('cities', Number(e.target.value) as 1 | 4 | 9)}>
        <option value="1">1 ville</option>
        <option value="4">4 villes · 2 × 2</option>
        <option value="9">9 villes · 3 × 3</option>
      </Select>
      <Select id="emerald-detail" label="Détail" help="Aucune réduction cachée de géométrie ni de résolution des textures." value={config.detail} disabled={locked} onChange={e => set('detail', e.target.value as EmeraldConfig['detail'])}>
        <option value="source">Détail source</option>
        <option value="maximum">Détails maximum</option>
      </Select>
      <Select id="emerald-mode" label="Mode d’exécution" value={config.mode} disabled={locked} onChange={e => set('mode', e.target.value as EmeraldConfig['mode'])}>
        <option value="explore">Exploration libre</option>
        <option value="path">Parcours urbain reproductible</option>
      </Select>
      <Select id="emerald-camera" label="Caméra" help={config.mode === 'path' ? 'Caméra imposée par les huit segments.' : config.camera === 'orbit' ? 'Glisser pour tourner, molette pour avancer.' : 'Cliquer dans la vue puis W/A/S/D, R/F. Glisser pour regarder.'} value={config.camera} disabled={locked || config.mode === 'path'} onChange={e => set('camera', e.target.value as EmeraldConfig['camera'])}>
        <option value="orbit">Orbite</option>
        <option value="free">Libre</option>
      </Select>
      <Select id="emerald-diagnostic" label="Vue de diagnostic" value={config.diagnostic} disabled={locked} onChange={e => set('diagnostic', e.target.value as EmeraldConfig['diagnostic'])}>
        <option value="beauty">Rendu texturé</option>
        <option value="clusters">Clusters / meshlets</option>
        <option value="wireframe">Triangles / filaire</option>
        <option value="pages">Pages / résidence</option>
      </Select>
      <Select id="emerald-layout" label="Disposition de comparaison" value={config.layout} disabled={locked} onChange={e => set('layout', e.target.value as EmeraldConfig['layout'])}>
        <option value="single">Vue unique</option>
        <option value="comparison">A / B · B indisponible</option>
      </Select>
    </>
  );
}

export function EmeraldMetricsBody() {
  const { view, config } = useEmeraldPanel();
  if (!view) return null;
  const m = view.metrics;
  const exact = config.diagnostic === 'clusters' || config.diagnostic === 'pages';
  const stats = { submit: 'Non mesuré', cpuFrame: m ? `${number(m.cpuFrameMs, 2)} ms` : 'Non mesuré', fps: view.frameIntervalMs ? `${number(1000 / view.frameIntervalMs, 1)} FPS` : 'Non mesuré', drawCalls: number(m?.drawCalls) };
  return (
    <>
      <LabStats stats={stats} provenance="1000 ÷ intervalle requestAnimationFrame (rAF)" />
      <MetricGrid items={[
        { label: 'Triangles disponibles', value: number(view.availableTriangles), provenance: 'Manifeste source × nombre de villes' },
        { label: 'Triangles sélectionnés', value: number(m?.selectedTriangles), provenance: 'Feuilles exactes visibles, hors transparences partagées' },
        { label: 'Triangles soumis', value: number(m?.triangles), provenance: 'Compteur de rasterisation Three.js, passes incluses' },
        { label: 'Clusters visibles', value: number(m?.clusters), provenance: 'Hiérarchie CPU exacte' },
        { label: 'Pages lues', value: number(m?.pageLoads), provenance: 'Lectures vérifiées du cache CPU' },
        { label: 'Pages attachées', value: exact ? number(m?.residentPages) : 'Non mesuré', provenance: 'Pages d’indices dans la scène ; pas VRAM physique' },
        { label: 'Pages évincées', value: exact ? number(m?.pageEvictions) : 'Non mesuré' },
        { label: 'Octets de géométrie comptabilisés', value: number(m?.geometryAllocationBytes), provenance: 'Tableaux uniques ; pas mémoire GPU physique' },
      ]} />
      <p className="text-xs">Caméra : <span data-emerald-camera data-camera-pose={view.position}>{view.position || 'Au repos'}</span></p>
    </>
  );
}

export function EmeraldRunBody() {
  const { view, state, actions } = useEmeraldPanel();
  if (!view) return null;
  return (
    <>
      <Button disabled={!state.running && view.availability.status !== 'ready'} onClick={state.running ? view.stop : actions.runBenchmark}>{state.running ? 'Arrêter l’exploration' : state.benchLabel}</Button>
      {view.progress ? <ProgressPanel message={view.message} value={view.progress.completed} max={view.progress.total} /> : null}
      <Button disabled>Comparer la ville complète</Button>
      <p className="text-xs text-base-content/65">B indisponible : pipeline optimisée complète absente. Comparaison mesurée bloquée tant que A/A est instable.</p>
    </>
  );
}

export function EmeraldReportBody() {
  const { view, state } = useEmeraldPanel();
  if (!view) return null;
  return (
    <>
      <p className="text-xs">Cinq dernières exécutions conservées dans ce navigateur, séparées de la fixture.</p>
      {(view.history ?? []).length
        ? (view.history ?? []).map((report, index) => (
          <Button key={report.id} variant="secondary" disabled={state.running} onClick={() => view.showReport(report.id)}>
            {index === 0 ? 'Voir le rapport' : `Rapport ${index + 1}`} · {report.configuration.cities} ville(s) · {report.status}
          </Button>
        ))
        : <p className="text-xs text-base-content/60">Aucune exécution enregistrée.</p>}
    </>
  );
}
