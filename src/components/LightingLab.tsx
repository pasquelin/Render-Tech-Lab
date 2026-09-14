import { useEffect, useRef, useState } from 'react';
import { SCENES, SCENE_LIGHT_BOUNDS, AUTO_LIGHT_MIN, AUTO_LIGHT_MAX, ADJUSTABLE_LIGHT_IDS, defaultConfig } from '../../16-lighting-transport/index.ts';
import type { LightingBackendId, LightingBenchConfig, LightingController, SceneId, SceneLight, EngineCapabilities, LightingFrameStats, Vec3, ControlsContext, LightingControlsHandle } from '../../16-lighting-transport/index.ts';
import { initialSnapshot, type LabActions } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { parseMarkdownToHtml } from '../lab/markdown.ts';
import { loadMarkdownReport } from '../lab/reportReader.ts';
// Caméra à la première personne : le composant existant du banc 15 (WASD, souris, saut, collisions
// sur la géométrie), branché tel quel — jamais copié ni réécrit. src/components/ est la seule couche
// autorisée à importer les fichiers internes d'un autre banc (voir test/labArchitecture.test.ts).
import { createNavigationControls } from '../../15-virtualized-integration/implementation/navigationControls.ts';
import { loadNavigationWorld } from '../../15-virtualized-integration/implementation/navigationSource.ts';
import { LabContext } from './LabContext.tsx';
import { ModelMetricsBody, type ModelMetricsSource } from './ModelMetricsBody.tsx';
import { LabShell } from './LabShell.tsx';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';

type Status = 'idle' | 'loading' | 'running' | 'stopped' | 'error';
const moduleId = '16-lighting-transport';
const baseSnapshot = initialSnapshot(moduleId);
const number = (value: number | null | undefined, unit = '') => (value == null || !Number.isFinite(value) ? 'Non mesuré' : value.toFixed(unit === ' ms' ? 2 : 0) + unit);
/** Les bornes de position des lampes sont des mètres monde (SCENE_LIGHT_BOUNDS). */
const metres = (value: number) => value.toFixed(1) + ' m';

/** Coût d'une étape du rendu : une ligne par étape, colonnes CPU et GPU, quantiles p50 et p95.
 *  `null` signifie « non mesuré » et reste distinct de 0, qui serait une étape mesurée à coût nul.
 *  Le contrat moteur arrive dans un lot séparé : ici seul l'emplacement est posé. */
export interface StageCostQuantiles { readonly p50: number | null; readonly p95: number | null }
export interface StageCost { readonly stage: string; readonly cpuMs: StageCostQuantiles; readonly gpuMs: StageCostQuantiles }
const quantiles = (value: StageCostQuantiles) =>
  value.p50 == null && value.p95 == null ? 'Non mesuré' : number(value.p50, ' ms') + ' / ' + number(value.p95, ' ms');
/** Tant que le moteur ne publie rien, la liste reste vide et le bloc affiche « Non mesuré ». */
const STAGE_COSTS: readonly StageCost[] = [];
const displayColor = (color: Vec3) => '#' + color.map(value => { const x = Math.min(1, Math.max(0, value)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'); }).join('');
const linearColor = (hex: string): Vec3 => [1, 3, 5].map(offset => { const x = parseInt(hex.slice(offset, offset + 2), 16) / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }) as Vec3;

function LightFields({ light, scene, disabled, onChange }: { light: SceneLight; scene: SceneId; disabled: boolean; onChange: (patch: Partial<SceneLight>) => void }) {
  const bounds = SCENE_LIGHT_BOUNDS[scene];
  const prefix = 'lighting-' + light.id;
  const move = (axis: 0 | 1 | 2, value: number) => { const position: Vec3 = [...light.position]; position[axis] = value; onChange({ position }); };
  return (
    <div className="space-y-2" data-light-id={light.id}>
      <h3 className="text-xs font-semibold">{light.id}</h3>
      <div className="grid grid-cols-2 gap-2">
        <Input id={prefix + '-color'} label="Couleur" type="color" value={displayColor(light.color)} disabled={disabled} onChange={event => onChange({ color: linearColor(event.target.value) })} />
        <Input id={prefix + '-intensity'} label={'Intensité · ' + light.intensity.toFixed(1)} help="Échelle du moteur, sans unité physique." type="range" min={0} max={20} step={0.5} value={light.intensity} disabled={disabled} onChange={event => onChange({ intensity: Number(event.target.value) })} />
        <Input id={prefix + '-x'} label={'X · ' + metres(light.position[0])} type="range" min={bounds.minX} max={bounds.maxX} step={0.1} value={light.position[0]} disabled={disabled} onChange={event => move(0, Number(event.target.value))} />
        <Input id={prefix + '-y'} label={'Y · ' + metres(light.position[1])} type="range" min={bounds.minY} max={bounds.maxY} step={0.1} value={light.position[1]} disabled={disabled} onChange={event => move(1, Number(event.target.value))} />
        <Input id={prefix + '-z'} label={'Z · ' + metres(light.position[2])} type="range" min={bounds.minZ} max={bounds.maxZ} step={0.1} value={light.position[2]} disabled={disabled} onChange={event => move(2, Number(event.target.value))} />
        <Input id={prefix + '-shadow'} label="Ombre" type="checkbox" checked={light.castsShadow} disabled={disabled} onChange={event => onChange({ castsShadow: event.target.checked })} />
      </div>
    </div>
  );
}

/** React possède le cycle de vie et les commandes ; la scène, le rendu et les mesures restent dans le
 * runner public. La fiche commune (LabShell/LabSidebar/PreparationStation) fournit sections, canvas
 * et états idle/chargement/arrêt ; ce composant ne fournit que l'état et le contenu de ses panneaux. */
export function LightingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null), unusedGpu = useRef<HTMLCanvasElement>(null), unusedChart = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<LightingController | null>(null), abortRef = useRef<AbortController | null>(null);
  const generation = useRef(0), poll = useRef(0), busy = useRef(false);
  const reportRequest = useRef<AbortController | null>(null);
  const [sceneId, setSceneId] = useState<SceneId>('house');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Prêt à ouvrir une scène.');
  const [config, setConfig] = useState<LightingBenchConfig>(() => defaultConfig('house'));
  const [capabilities, setCapabilities] = useState<EngineCapabilities | null>(null);
  const [stats, setStats] = useState<LightingFrameStats>({ fps: null, cpuFrameMs: null, gpuMs: null, lightsActive: null, shadowsUpdated: null, gpuLightListsMs: null, gpuShadowsMs: null, gpuLightingMs: null, drawCalls: null, triangles: null, frame: null, cameraPose: null });
  const [backend, setBackend] = useState<LightingBackendId | null>(null);
  // Les commandes réelles : jeu à la première personne quand celles du banc 15 ont pu être construites,
  // orbite de l'Explorer sinon. Le panneau « Caméra active » annonce ce qui est branché, pas l'intention.
  const [cameraMode, setCameraMode] = useState<'orbit' | 'game'>('orbit');
  const [modal, setModal] = useState(baseSnapshot.reportModal);
  const active = status === 'loading' || status === 'running';

  const release = () => {
    cancelAnimationFrame(poll.current);
    controllerRef.current?.dispose();
    controllerRef.current = null;
  };
  const stop = () => {
    if (!busy.current) return;
    abortRef.current?.abort(); release(); busy.current = false;
    setStatus('stopped'); setMessage('Exploration arrêtée. Les ressources de rendu ont été libérées.'); setCapabilities(null); setBackend(null);
  };
  const launch = () => {
    if (busy.current) return;
    busy.current = true; setStatus('loading'); setMessage('Chargement de la scène…'); setCapabilities(null); setBackend(null); setCameraMode('orbit');
    const abort = new AbortController(); abortRef.current = abort;
    const owner = ++generation.current;
    setConfig(defaultConfig(sceneId));
    void (async () => {
      try {
        const runner = await import('../../16-lighting-transport/index.ts');
        if (generation.current !== owner || abort.signal.aborted) return;
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('La surface de rendu est indisponible.');
        // Maison : navigation à pied du banc 15 (WASD, saut, collisions sur les murs/le sol générés
        // par assets/house.ts + assets/prepareHouseNavigation.ts). Emerald : le cache du Lab principal
        // est en lecture seule, donc aucun navigation.bin n'est généré pour lui ; repli sur les vraies
        // orbit controls de l'Explorer (pas une commande maison) — à signaler, pas à réimplémenter.
        const createControls = async (context: ControlsContext): Promise<LightingControlsHandle> => {
          if (sceneId === 'house') {
            try {
              const world = await loadNavigationWorld(context.manifestUrl, context.sourceKey, context.bounds, 1, abort.signal);
              if (generation.current === owner) setCameraMode('game');
              return createNavigationControls(context.canvas, context.camera, world, 'game', 0);
            } catch (error) {
              console.warn('[16-lighting-transport] navigation à la première personne (banc 15) indisponible, repli orbite :', error);
            }
          }
          const orbit = context.orbitControls();
          return { update: () => orbit.update(), dispose: () => orbit.dispose() };
        };
        const controller = await runner.createLightingBench(canvas, sceneId, {
          signal: abort.signal, onProgress: value => { if (generation.current === owner) setMessage(value); }, createControls,
        });
        if (generation.current !== owner || abort.signal.aborted) { controller.dispose(); return; }
        controllerRef.current = controller;
        setCapabilities(controller.getCapabilities());
        setBackend(controller.backend);
        setStatus('running'); setMessage('Scène active. Cliquez dans la vue pour capturer la souris (WASD, Espace pour sauter, Maj pour courir, Échap pour libérer).');
        const tick = () => {
          if (generation.current !== owner || !controllerRef.current) return;
          setStats(controllerRef.current.getStats());
          poll.current = requestAnimationFrame(tick);
        };
        poll.current = requestAnimationFrame(tick);
      } catch (error) {
        if (generation.current !== owner) return;
        release(); busy.current = false; setStatus('error'); setMessage(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  useEffect(() => {
    document.title = '16 · Lumière — render-tech-lab';
    return () => { generation.current++; abortRef.current?.abort(); reportRequest.current?.abort(); release(); };
  }, []);

  const change = (patch: Partial<LightingBenchConfig>) => {
    if (!controllerRef.current) return;
    setConfig(previous => ({ ...previous, ...patch })); controllerRef.current.update(patch);
  };
  const changeLight = (id: string, patch: Partial<SceneLight>) => {
    change({ lights: config.lights.map(light => (light.id === id ? { ...light, ...patch } : light)) });
  };

  const openReport = () => {
    reportRequest.current?.abort();
    const abort = new AbortController(); reportRequest.current = abort;
    setModal({ open: true, title: 'Rapport · 16 Lumière', path: 'reports/' + moduleId + '/', raw: '', html: 'Chargement du rapport…', feedback: '' });
    void loadMarkdownReport(fetch, moduleId).then(result => {
      if (!abort.signal.aborted) setModal(old => ({ ...old, raw: result.ok ? result.raw : '', html: result.ok ? parseMarkdownToHtml(result.raw) : result.raw, feedback: result.feedback }));
    }).catch(error => { if (!abort.signal.aborted) setModal(old => ({ ...old, html: error instanceof Error ? error.message : String(error), feedback: 'Le rapport n’a pas pu être chargé.' })); });
  };
  const openFinder = () => {
    void fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testId: moduleId, folder: 'reports' }) })
      .then(response => { if (!response.ok) throw new Error('Dossier indisponible'); return response.json(); })
      .then(() => setModal(old => ({ ...old, feedback: 'Dossier des rapports ouvert.' }))).catch(() => setModal(old => ({ ...old, feedback: 'Rapports : reports/' + moduleId + '/' })));
  };
  const copyReport = () => {
    void navigator.clipboard.writeText(modal.raw).then(() => setModal(old => ({ ...old, feedback: 'Rapport copié.' }))).catch(() => setModal(old => ({ ...old, feedback: 'Copie indisponible.' })));
  };

  const actions: LabActions = {
    switchModule: id => { if (!busy.current) navigateLabRoute(id); }, setMode: () => {}, setScenario: () => {},
    runBenchmark: launch, runPain: stop, stopBenchmark: stop,
    openReport, closeReport: () => setModal(old => ({ ...old, open: false })), copyReport, refreshReport: openReport, openFinder,
    newExecution: () => { if (!active) { generation.current++; setStatus('idle'); setMessage('Prêt à ouvrir une scène.'); } },
  };
  const stats4 = { submit: 'Non mesuré', cpuFrame: number(stats.cpuFrameMs, ' ms'), fps: number(stats.fps, ' FPS'), drawCalls: number(stats.drawCalls) };
  // Ce que le banc 16 sait remplir du panneau commun : le reste s'affiche « Non mesuré », jamais 0.
  const metricsSource: ModelMetricsSource = {
    metrics: stats.frame, frameIntervalMs: stats.fps ? 1000 / stats.fps : null, cameraPose: stats.cameraPose,
    availableTriangles: null, engine: backend ?? 'Non mesuré', diagnostic: 'beauty', camera: cameraMode,
  };
  // Une ligne par étape, colonne CPU puis colonne GPU ; sans donnée moteur, une seule case « Non mesuré ».
  const stageItems = STAGE_COSTS.length === 0
    ? [{ id: 'lighting-stage-cost', label: 'Étapes du rendu', value: 'Non mesuré', provenance: 'Le moteur ne publie pas encore le coût par étape ; son contrat arrive dans un lot séparé.' }]
    : STAGE_COSTS.flatMap(cost => [
        { id: 'lighting-stage-' + cost.stage + '-cpu', label: cost.stage + ' · CPU', value: quantiles(cost.cpuMs), provenance: 'p50 / p95' },
        { id: 'lighting-stage-' + cost.stage + '-gpu', label: cost.stage + ' · GPU', value: quantiles(cost.gpuMs), provenance: 'p50 / p95' },
      ]);
  const contextState = {
    ...baseSnapshot, running: active, framePresented: status === 'running', reportModal: modal, showWebgl: active,
    stats: { ...baseSnapshot.stats, ...stats4 },
    execution: { kind: 'exploration' as const, status: status === 'loading' ? ('running' as const) : status, phase: message, lastCampaign: null },
  };

  const panels = {
    configuration: (
      <>
        <SegmentedControl label="Scène" disabled={active} value={sceneId} onChange={value => setSceneId(value)} options={SCENES.map(scene => ({ value: scene.id, label: scene.title }))} />
        {active ? (
          <>
            <p className="text-xs text-base-content/65">{sceneId === 'house' ? 'Jeu à la première personne (banc 15) : clic pour capturer la souris, WASD, Espace pour sauter, Maj pour courir, Échap pour libérer.' : 'Orbite (Explorer) : glisser pour tourner, molette pour zoomer — aucun navigation.bin pour un cache en lecture seule.'}</p>
            <Input id="lighting-night" label="Mode nuit" type="checkbox" checked={config.night} disabled={!capabilities?.setEnvironment} onChange={event => change({ night: event.target.checked })} />
            <Input id="lighting-shadows" label="Ombres" type="checkbox" checked={config.shadows} onChange={event => change({ shadows: event.target.checked })} />
            <Input id="lighting-auto-count" label={'Lampes automatiques · ' + config.autoLightCount} type="range" min={AUTO_LIGHT_MIN} max={AUTO_LIGHT_MAX} step={1} value={config.autoLightCount} disabled={!capabilities?.addLight} onChange={event => change({ autoLightCount: Number(event.target.value) })} />
            {ADJUSTABLE_LIGHT_IDS.map(id => {
              const light = config.lights.find(entry => entry.id === id);
              return light ? <LightFields key={id} light={light} scene={sceneId} disabled={false} onChange={patch => changeLight(id, patch)} /> : null;
            })}
            <Button id="lighting-pause" variant={config.animationPaused ? 'primary' : 'secondary'} onClick={() => change({ animationPaused: !config.animationPaused })}>
              {config.animationPaused ? 'Reprendre' : 'Mettre en pause'}
            </Button>
            <Input id="lighting-speed" label={'Vitesse · ×' + config.animationSpeed.toFixed(1)} type="range" min={0.1} max={4} step={0.1} value={config.animationSpeed} onChange={event => change({ animationSpeed: Number(event.target.value) })} />
            <p className="text-xs text-base-content/60">Portes, ventilateur, panneau, lampe baladeuse, miroir pivotant{sceneId === 'emerald-night' ? ', phares' : ''} : pilotés par setTransform/setLight à chaque image, sans allocation.</p>
          </>
        ) : <p className="text-xs text-base-content/60">{SCENES.find(scene => scene.id === sceneId)?.description}</p>}
      </>
    ),
    // Le panneau commun du banc 15, tel quel, pour que les deux rapports se lisent de la même façon ;
    // les blocs propres à la lumière viennent à la suite par son point d'extension.
    metrics: (
      <ModelMetricsBody source={metricsSource} extra={
        <>
          <MetricGrid label="Éclairage" items={[
            { id: 'lighting-gpu', label: 'GPU (passe)', value: number(stats.gpuMs, ' ms') },
            { id: 'lighting-lights-active', label: 'Lampes actives', value: number(stats.lightsActive) },
            { id: 'lighting-shadows-updated', label: 'Ombres mises à jour', value: number(stats.shadowsUpdated) },
            { id: 'lighting-gpu-lightlists', label: 'GPU listes de lampes', value: number(stats.gpuLightListsMs, ' ms') },
            { id: 'lighting-gpu-shadows', label: 'GPU ombres', value: number(stats.gpuShadowsMs, ' ms') },
            { id: 'lighting-gpu-lighting', label: 'GPU éclairage', value: number(stats.gpuLightingMs, ' ms') },
          ]} />
          <MetricGrid label="Coût par étape" items={stageItems} />
        </>
      } />
    ),
  };

  return <LabContext.Provider value={{ state: contextState, actions, panels }}><LabShell webglRef={canvasRef} webgpuRef={unusedGpu} chartRef={unusedChart} /></LabContext.Provider>;
}
