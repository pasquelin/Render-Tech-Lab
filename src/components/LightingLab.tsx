import { useEffect, useRef, useState } from 'react';
import { Play, Flame } from 'lucide-react';
import { LIGHTING_MODULE, LIGHTING_UI, SCENES, SCENE_LIGHT_BOUNDS, AUTO_LIGHT_MIN, AUTO_LIGHT_MAX, ADJUSTABLE_LIGHT_IDS, defaultConfig } from '../../16-lighting-transport/index.ts';
import type { LightingBenchConfig, LightingController, SceneId, SceneLight, EngineCapabilities, LightingFrameStats, Vec3, ControlsContext, LightingControlsHandle } from '../../16-lighting-transport/index.ts';
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
import { LabShell } from './LabShell.tsx';
import { LabStats } from './LabStats.tsx';
import { PreparationStation } from './PreparationStation.tsx';
import { ReportSection } from './ReportSection.tsx';
import { LabSection } from './ui/LabSection.tsx';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { StatusBadge } from './ui/StatusBadge.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { LoadingState } from './ui/LoadingState.tsx';

type Status = 'idle' | 'loading' | 'running' | 'stopped' | 'error';
const moduleId = '16-lighting-transport';
const number = (value: number | null | undefined, unit = '') => (value == null || !Number.isFinite(value) ? 'Non mesuré' : value.toFixed(unit === ' ms' ? 2 : 0) + unit);
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
        <Input id={prefix + '-intensity'} label={'Intensité · ' + light.intensity.toFixed(1)} type="range" min={0} max={20} step={0.5} value={light.intensity} disabled={disabled} onChange={event => onChange({ intensity: Number(event.target.value) })} />
        <Input id={prefix + '-x'} label="X" type="range" min={bounds.minX} max={bounds.maxX} step={0.1} value={light.position[0]} disabled={disabled} onChange={event => move(0, Number(event.target.value))} />
        <Input id={prefix + '-y'} label="Y" type="range" min={bounds.minY} max={bounds.maxY} step={0.1} value={light.position[1]} disabled={disabled} onChange={event => move(1, Number(event.target.value))} />
        <Input id={prefix + '-z'} label="Z" type="range" min={bounds.minZ} max={bounds.maxZ} step={0.1} value={light.position[2]} disabled={disabled} onChange={event => move(2, Number(event.target.value))} />
        <Input id={prefix + '-shadow'} label="Ombre" type="checkbox" checked={light.castsShadow} disabled={disabled} onChange={event => onChange({ castsShadow: event.target.checked })} />
      </div>
    </div>
  );
}

/** React possède le cycle de vie et les commandes ; la scène, le rendu et les mesures restent dans le runner public. */
export function LightingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null), carCanvasRef = useRef<HTMLCanvasElement>(null);
  const unusedGpu = useRef<HTMLCanvasElement>(null), unusedChart = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<LightingController | null>(null), abortRef = useRef<AbortController | null>(null);
  const generation = useRef(0), poll = useRef(0), busy = useRef(false);
  const reportRequest = useRef<AbortController | null>(null);
  const [sceneId, setSceneId] = useState<SceneId>('house');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Prêt à ouvrir une scène.');
  const [config, setConfig] = useState<LightingBenchConfig>(() => defaultConfig('house'));
  const [capabilities, setCapabilities] = useState<EngineCapabilities | null>(null);
  const [stats, setStats] = useState<LightingFrameStats>({ fps: null, cpuFrameMs: null, gpuMs: null, lightsActive: null, shadowsUpdated: null, gpuLightListsMs: null, gpuShadowsMs: null, gpuLightingMs: null, drawCalls: null, triangles: null });
  const [modal, setModal] = useState(() => initialSnapshot(moduleId).reportModal);
  const active = status === 'loading' || status === 'running';

  const release = () => {
    cancelAnimationFrame(poll.current);
    controllerRef.current?.dispose();
    controllerRef.current = null;
  };
  const stop = () => {
    if (!busy.current) return;
    abortRef.current?.abort(); release(); busy.current = false;
    setStatus('stopped'); setMessage('Scène arrêtée. Les ressources de rendu ont été libérées.'); setCapabilities(null);
  };
  const launch = () => {
    if (busy.current) return;
    busy.current = true; setStatus('loading'); setMessage('Chargement de la scène…'); setCapabilities(null);
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
              return createNavigationControls(context.canvas, context.camera, context.bounds, world, 1, 'game', 0);
            } catch (error) {
              console.warn('[16-lighting-transport] navigation à la première personne (banc 15) indisponible, repli orbite :', error);
            }
          }
          const orbit = context.orbitControls();
          return { update: () => orbit.update(), dispose: () => orbit.dispose() };
        };
        const controller = await runner.createLightingBench(canvas, sceneId === 'emerald-night' ? carCanvasRef.current : null, sceneId, {
          signal: abort.signal, onProgress: value => { if (generation.current === owner) setMessage(value); }, createControls,
        });
        if (generation.current !== owner || abort.signal.aborted) { controller.dispose(); return; }
        controllerRef.current = controller;
        setCapabilities(controller.getCapabilities());
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
    setModal({ open: true, title: 'Rapport · 16 Lumière', path: 'reports/' + moduleId + '/…/REPORT.md', raw: '', html: 'Chargement du rapport…', feedback: '' });
    void loadMarkdownReport(fetch, moduleId).then(report => {
      if (abort.signal.aborted) return;
      setModal(old => ({ ...old, raw: report.ok ? report.raw : '', html: report.ok ? parseMarkdownToHtml(report.raw) : `<p>${report.raw}</p>`, feedback: report.feedback }));
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
    newExecution: () => { if (!active) { setStatus('idle'); setMessage('Prêt à ouvrir une scène.'); } },
  };
  const primaryStats = { submit: 'Non mesuré', cpuFrame: number(stats.cpuFrameMs, ' ms'), fps: number(stats.fps, ' FPS'), drawCalls: number(stats.drawCalls) };
  const contextState = {
    ...initialSnapshot(moduleId), running: active, framePresented: status === 'running', reportModal: modal,
    stats: { ...initialSnapshot(moduleId).stats, ...primaryStats },
    execution: { status: status === 'loading' ? ('running' as const) : status, phase: message, lastCampaign: null },
  };

  const sidebar = (
    <>
      <LabSection id="lab-run-card" number={1} title="Campagne / comparaison">
        <Button id="btn-benchmark" className="w-full shadow-xs gap-2" disabled={active} onClick={launch}>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{status === 'stopped' || status === 'error' ? 'Relancer' : LIGHTING_MODULE.benchLabel}</span>
        </Button>
        <Button id="btn-pain-benchmark" variant="danger" className={`w-full shadow-xs gap-2 ${active ? '' : 'hidden'}`} onClick={stop}>
          <Flame className="w-3.5 h-3.5" /><span>Arrêter</span>
        </Button>
        <StatusBadge id="bench-status" tone={status === 'error' ? 'error' : status === 'running' ? 'success' : 'neutral'} className="w-full justify-start font-mono text-[10px] h-auto py-2 whitespace-nowrap truncate">
          {status === 'idle' ? 'Prêt' : status === 'loading' ? 'Chargement' : status === 'running' ? 'En cours' : status === 'stopped' ? 'Arrêté' : 'Erreur'}
        </StatusBadge>
      </LabSection>

      <LabSection id="lab-mode-card" number={2} title={active ? 'Contrôles pendant le rendu' : 'Configuration / mode d’exécution'} help={active ? 'Pendant le rendu, seuls les réglages encore actifs restent ici.' : LIGHTING_UI.modeHint}>
        {active ? (
          <>
            <p className="text-xs text-base-content/65">Réglages actifs pendant le rendu de « {SCENES.find(scene => scene.id === sceneId)?.title} ».</p>
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
            <p className="text-xs text-base-content/60">Portes, ventilateur, panneau, lampe baladeuse, miroir pivotant{sceneId === 'emerald-night' ? ', voiture et phares' : ''} : pilotés par setTransform/setLight à chaque image, sans allocation.</p>
          </>
        ) : (
          <>
            <SegmentedControl label="Scène" disabled={active} value={sceneId} onChange={value => setSceneId(value)} options={SCENES.map(scene => ({ value: scene.id, label: scene.title }))} />
            <p className="text-xs text-base-content/60">{SCENES.find(scene => scene.id === sceneId)?.description}</p>
          </>
        )}
      </LabSection>

      <LabSection id="lab-metrics-card" number={3} title="Métriques en direct">
        <LabStats stats={primaryStats} provenance="1000 ÷ intervalle rAF. La cadence dépend aussi de l’écran ; aucune fréquence physique n’est déduite." />
        <MetricGrid label="Éclairage" items={[
          { id: 'lighting-gpu', label: 'GPU (passe)', value: number(stats.gpuMs, ' ms') },
          { id: 'lighting-lights-active', label: 'Lampes actives', value: number(stats.lightsActive) },
          { id: 'lighting-shadows-updated', label: 'Ombres mises à jour', value: number(stats.shadowsUpdated) },
          { id: 'lighting-gpu-lightlists', label: 'GPU listes de lampes', value: number(stats.gpuLightListsMs, ' ms') },
          { id: 'lighting-gpu-shadows', label: 'GPU ombres', value: number(stats.gpuShadowsMs, ' ms') },
          { id: 'lighting-gpu-lighting', label: 'GPU éclairage', value: number(stats.gpuLightingMs, ' ms') },
        ]} />
      </LabSection>

      <ReportSection testId={moduleId} refreshKey={status} running={active} number={4} hint="Rapports : reports/16-lighting-transport/" onOpen={openReport} onReveal={openFinder} />
    </>
  );

  const viewport = (
    <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-base-100 flex flex-col" data-lighting-status={status} data-lighting-scene={sceneId}>
      {active ? (
        <div className="relative flex-1 min-h-0">
          <div className="relative min-w-0 min-h-0 h-full">
            <canvas id="lighting-canvas" ref={canvasRef} tabIndex={0} aria-label={'Scène ' + sceneId} className={`absolute inset-0 block w-full h-full outline-none bg-base-100 ${status === 'running' ? '' : 'invisible'}`} />
            {sceneId === 'emerald-night' && status === 'running' ? (
              <canvas ref={carCanvasRef} aria-label="Aperçu de la voiture" className="absolute bottom-3 right-3 w-40 h-28 rounded-box border border-base-content/20 bg-base-300" />
            ) : null}
            {status === 'running' ? (
              <div className="absolute left-3 bottom-3 right-3 pointer-events-none">
                <p className="bg-base-200/90 p-3 rounded-box text-xs">{sceneId === 'house' ? 'Jeu à la première personne (banc 15) · clic pour capturer la souris, WASD, Espace pour sauter, Maj pour courir, Échap pour libérer.' : 'Orbite · glisser pour tourner, molette pour zoomer.'}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {status === 'loading' ? (
        <div className="absolute inset-0 bg-base-100/95 p-6 flex items-center justify-center"><LoadingState message={message} /></div>
      ) : null}
      {!active ? (
        <PreparationStation
          controls={<SegmentedControl label="Scène" disabled={false} value={sceneId} onChange={value => setSceneId(value)} options={SCENES.map(scene => ({ value: scene.id, label: scene.title }))} />}
          presentation={{
            description: SCENES.find(scene => scene.id === sceneId)?.description ?? LIGHTING_MODULE.description,
            question: 'Les lampes, les ombres et les transformations de nœuds du moteur restent-elles correctes pendant une exploration continue ?',
            protocol: LIGHTING_UI.protocol,
            steps: ['Choisir la scène', 'Ouvrir', 'Régler les lampes', 'Observer les métriques'],
            metadata: [['Backend', LIGHTING_UI.backend], ['Scène', SCENES.find(scene => scene.id === sceneId)?.title ?? ''], ['Caméra', 'Première personne']],
          }}
        >
          <p className="text-xs" data-lighting-message="">{status === 'error' ? message : LIGHTING_UI.idleNote}</p>
        </PreparationStation>
      ) : null}
    </main>
  );

  return (
    <LabContext.Provider value={{ state: contextState, actions }}>
      <LabShell webglRef={canvasRef} webgpuRef={unusedGpu} chartRef={unusedChart} viewport={viewport} sidebar={sidebar} />
    </LabContext.Provider>
  );
}
