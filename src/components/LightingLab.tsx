import { useEffect, useRef, useState } from 'react';
import { SCENES, SCENE_LIGHT_BOUNDS, SCENE_LIGHT_LIMITS, AUTO_LIGHT_MIN, AUTO_LIGHT_MAX, ADJUSTABLE_LIGHT_IDS, LIGHTING_BACKEND_IDS, LIGHTING_VIEWS, SUN_LIGHT_ID, SUN_LIMITS, DEFAULT_LIGHTING_BACKEND, DEFAULT_LIGHTING_BOUNCE, DEFAULT_LIGHTING_CAMERA, defaultConfig, emptyLightingStats } from '../../16-lighting-transport/index.ts';
import type { LightingBackendId, LightingBenchConfig, LightingCameraMode, LightingController, SceneId, SceneLightingView, SceneLightLimits, PlacedLight, SunConfig, EngineCapabilities, LightingFrameStats, Vec3, ControlsContext, LightingControlsHandle } from '../../16-lighting-transport/index.ts';
import type { StageProfile, StageQuantiles } from '@web-geometry/sdk';
import { initialSnapshot, type LabActions } from '../lab/labState.ts';
import { navigateLabRoute } from '../lab/navigation.ts';
import { parseMarkdownToHtml } from '../lab/markdown.ts';
import { loadMarkdownReport } from '../lab/reportReader.ts';
// Caméra à la première personne : le composant existant du banc 15 (WASD, souris, saut, collisions
// sur la géométrie), branché tel quel — jamais copié ni réécrit. src/components/ est la seule couche
// autorisée à importer les fichiers internes d'un autre banc (voir test/labArchitecture.test.ts).
import { createNavigationControls } from '../../15-virtualized-integration/implementation/navigationControls.ts';
import { loadNavigationWorld } from '../../15-virtualized-integration/implementation/navigationSource.ts';
import { playerHeightFor, type NavigationWorld } from '../../15-virtualized-integration/implementation/navigation.ts';
import { benchEngine } from '../../15-virtualized-integration/implementation/engines.ts';
import { streetLevel } from '../lab/modelCampaign.ts';
import { LAB_CAMERA_MODES, cameraModeHelp, cameraModeLabel } from '../lab/cameraModes.ts';
import { LabContext } from './LabContext.tsx';
import { ModelMetricsBody, type ModelMetricsSource } from './ModelMetricsBody.tsx';
import { LabShell } from './LabShell.tsx';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { MetricGrid } from './ui/MetricGrid.tsx';
import { MetricTable, type MetricTableRow } from './ui/MetricTable.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { Select } from './ui/Select.tsx';

type Status = 'idle' | 'loading' | 'running' | 'stopped' | 'error';
const moduleId = '16-lighting-transport';
const baseSnapshot = initialSnapshot(moduleId);
const NOT_MEASURED = 'Non mesuré';
const number = (value: number | null | undefined, unit = '') => (value == null || !Number.isFinite(value) ? NOT_MEASURED : value.toFixed(unit === ' ms' ? 2 : 0) + unit);
/** Les bornes de position des lampes sont des mètres monde (SCENE_LIGHT_BOUNDS). */
const metres = (value: number) => value.toFixed(1) + ' m';
/** `intensity` est l'intensité radiométrique du contrat de lampes du moteur, pas un facteur. */
const radiometric = (value: number) => value.toFixed(1) + ' W/sr';
/** La direction du soleil se règle en degrés : azimut sur l'horizon, hauteur au-dessus de lui. */
const degrees = (value: number) => value.toFixed(0) + '°';

/** Un seul catalogue nomme les moteurs du Lab : ce banc lit celui du banc 15, il n'en réécrit aucun. */
const engineLabel = (id: LightingBackendId) => benchEngine(id).label;

/** Les plages des curseurs d'une lampe viennent toutes d'une table de bornes — SCENE_LIGHT_LIMITS
 *  pour les lampes nommées et automatiques, SUN_LIMITS pour le soleil, qui les nomme pareil : le pas
 *  minimal sert de borne basse, le contrat refusant une lampe nulle. */
type IntensityLimits = { readonly intensityMax: number; readonly intensityStep: number };
const intensitySlider = (limits: IntensityLimits) => ({ type: 'range' as const, min: limits.intensityStep, max: limits.intensityMax, step: limits.intensityStep });
const rangeSlider = (limits: SceneLightLimits) => ({ type: 'range' as const, min: limits.rangeStep, max: limits.rangeMax, step: limits.rangeStep });
/** Azimut et hauteur se règlent au degré ; seules leurs bornes les distinguent. */
const angleSlider = (min: number, max: number) => ({ type: 'range' as const, min, max, step: SUN_LIMITS.angleStep });

/** Deux images d'attente : le temps que la fiche commune démonte la surface avant d'en remonter une
 *  neuve, un canvas ne portant qu'un seul contexte graphique dans sa vie. */
const afterRemount = (run: () => void) => requestAnimationFrame(() => requestAnimationFrame(run));

/** Départ générique au sol quand aucune géométrie de navigation ne donne de point praticable :
 *  centre de l'emprise, au niveau du sol, à hauteur d'œil, regard horizontal. Aucune coordonnée
 *  n'est écrite pour une scène : tout sort de l'emprise publiée par le moteur. */
function placeAtGround(camera: ControlsContext['camera'], bounds: ControlsContext['bounds']) {
  const centerX = (bounds.min.x + bounds.max.x) / 2, centerZ = (bounds.min.z + bounds.max.z) / 2;
  const width = bounds.max.x - bounds.min.x, depth = bounds.max.z - bounds.min.z;
  const eyeY = streetLevel(bounds) + playerHeightFor(Math.min(width, depth));
  camera.position.set(centerX, eyeY, centerZ);
  camera.lookAt(centerX + width, eyeY, centerZ);
  camera.updateMatrixWorld();
}

/** Les quatre colonnes de durées du profil. Processeur et carte graphique décrivent deux machines qui
 *  travaillent en même temps : on ne les additionne jamais, on ne les compare jamais entre elles. */
const STAGE_COLUMNS = ['Étape', 'CPU p50', 'CPU p95', 'GPU p50', 'GPU p95'];
/** `null` veut dire « non mesuré » et ne vaut pas 0 : une étape absente ne coûte pas « rien ». */
const quantiles = (value: StageQuantiles): [string, string] =>
  value ? [value.p50.toFixed(2) + ' ms', value.p95.toFixed(2) + ' ms'] : [NOT_MEASURED, NOT_MEASURED];
/** Les compteurs d'une étape (ombres, listes de lampes) tels que le moteur les nomme : ce ne sont pas
 *  des durées, et aucun libellé n'est réinventé ici — seule la casse du nom publié est aérée. */
const counts = (values: Readonly<Record<string, number>> | undefined) =>
  values && Object.entries(values).map(([name, count]) => name.replace(/([A-Z])/g, ' $1').toLowerCase() + ' : ' + count).join(' · ');
const stageNote = (parts: readonly (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || undefined;

/** Une ligne par étape du contrat du moteur, puis l'enveloppe de l'image côté carte graphique, qui
 *  n'est pas la somme des étapes : un appareil qui recouvre deux passes les compterait deux fois. */
function stageRows(profile: StageProfile | null): MetricTableRow[] {
  if (!profile?.enabled) {
    return [{
      id: 'lighting-stage-cost', cells: ['Étapes du rendu', ...quantiles(null), ...quantiles(null)],
      provenance: profile?.gpuReason ?? 'Le moteur actif ne chronomètre pas ses étapes.',
    }];
  }
  const rows: MetricTableRow[] = profile.stages.map(entry => ({
    id: 'lighting-stage-' + entry.stage,
    cells: [entry.label, ...quantiles(entry.cpuMs), ...quantiles(entry.gpuMs)],
    provenance: stageNote([counts(entry.counts), entry.cpuReason && 'CPU : ' + entry.cpuReason, entry.gpuReason && 'GPU : ' + entry.gpuReason]),
  }));
  rows.push({
    id: 'lighting-stage-image',
    cells: ['Image entière (GPU)', ...quantiles(null), ...quantiles(profile.gpuImageMs)],
    provenance: stageNote([
      'du début de la première passe à la fin de la dernière ; les étapes ne s’y additionnent pas',
      profile.gpuImageMs ? undefined : profile.gpuReason,
    ]),
  });
  return rows;
}

/** Sur quoi la fenêtre du moteur a réellement porté, pour qu'aucun chiffre ne se lise sans son assise. */
function stageProvenance(profile: StageProfile | null): string | undefined {
  if (!profile?.enabled) return undefined;
  const overhead = profile.overheadMs ? `relevé lui-même ${profile.overheadMs.p50.toFixed(3)} ms (p50)` : 'coût du relevé non mesuré';
  const clock = profile.gpuMethod ?? profile.gpuReason ?? 'aucune horloge carte graphique';
  return `Fenêtre ${profile.windowFrames} images · ${profile.cpuFrames} images processeur, ${profile.gpuSamples} relevés carte graphique · ${clock} · ${overhead}`;
}
const displayColor = (color: Vec3) => '#' + color.map(value => { const x = Math.min(1, Math.max(0, value)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'); }).join('');
const linearColor = (hex: string): Vec3 => [1, 3, 5].map(offset => { const x = parseInt(hex.slice(offset, offset + 2), 16) / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }) as Vec3;

/** Les champs qu'une lampe du banc a tous, soleil compris : un seul endroit nomme la couleur,
 *  l'intensité et l'ombre, et un seul convertit la couleur linéaire du contrat en couleur d'écran.
 *  Le préfixe d'identifiant est celui du groupe, pour que chaque champ garde son libellé associé. */
function ColorField({ prefix, color, disabled, onChange }: { prefix: string; color: Vec3; disabled: boolean; onChange: (color: Vec3) => void }) {
  return <Input id={prefix + '-color'} label="Couleur" type="color" value={displayColor(color)} disabled={disabled} onChange={event => onChange(linearColor(event.target.value))} />;
}

function IntensityField({ prefix, intensity, limits, disabled, onChange }: { prefix: string; intensity: number; limits: IntensityLimits; disabled: boolean; onChange: (intensity: number) => void }) {
  return <Input id={prefix + '-intensity'} label={'Intensité · ' + radiometric(intensity)} help="Intensité radiométrique du contrat de lampes du moteur." {...intensitySlider(limits)} value={intensity} disabled={disabled} onChange={event => onChange(Number(event.target.value))} />;
}

function ShadowField({ prefix, castsShadow, help, disabled, onChange }: { prefix: string; castsShadow: boolean; help?: string; disabled: boolean; onChange: (castsShadow: boolean) => void }) {
  return <Input id={prefix + '-shadow'} label="Ombre" help={help} type="checkbox" checked={castsShadow} disabled={disabled} onChange={event => onChange(event.target.checked)} />;
}

/** Le soleil du banc : une lampe directionnelle comme les autres, mais sans position ni portée —
 *  le moteur les refuse. L'éteindre ne laisse que les lampes posées : c'est la nuit. */
function SunFields({ sun, disabled, onChange }: { sun: SunConfig; disabled: boolean; onChange: (patch: Partial<SunConfig>) => void }) {
  const prefix = 'lighting-' + SUN_LIGHT_ID;
  const off = disabled || !sun.enabled;
  return (
    <div className="space-y-2" data-light-id={SUN_LIGHT_ID}>
      <h3 className="text-xs font-semibold">soleil</h3>
      <Input id={prefix + '-enabled'} label="Allumé" help="Éteint, plus rien n’éclaire que les lampes déclarées : c’est la nuit." type="checkbox" checked={sun.enabled} disabled={disabled} onChange={event => onChange({ enabled: event.target.checked })} />
      <div className="grid grid-cols-2 gap-2">
        <ColorField prefix={prefix} color={sun.color} disabled={off} onChange={color => onChange({ color })} />
        <IntensityField prefix={prefix} intensity={sun.intensity} limits={SUN_LIMITS} disabled={off} onChange={intensity => onChange({ intensity })} />
        <Input id={prefix + '-azimuth'} label={'Azimut · ' + degrees(sun.azimuthDeg)} help="Où le soleil se tient sur l’horizon." {...angleSlider(0, SUN_LIMITS.azimuthMax)} value={sun.azimuthDeg} disabled={off} onChange={event => onChange({ azimuthDeg: Number(event.target.value) })} />
        <Input id={prefix + '-elevation'} label={'Hauteur · ' + degrees(sun.elevationDeg)} help="Sa hauteur au-dessus de l’horizon : plus bas, les ombres s’allongent." {...angleSlider(SUN_LIMITS.elevationMin, SUN_LIMITS.elevationMax)} value={sun.elevationDeg} disabled={off} onChange={event => onChange({ elevationDeg: Number(event.target.value) })} />
        <ShadowField prefix={prefix} castsShadow={sun.castsShadow} help="Cascades qui suivent la caméra." disabled={off} onChange={castsShadow => onChange({ castsShadow })} />
      </div>
    </div>
  );
}

function LightFields({ light, scene, disabled, onChange }: { light: PlacedLight; scene: SceneId; disabled: boolean; onChange: (patch: Partial<PlacedLight>) => void }) {
  const bounds = SCENE_LIGHT_BOUNDS[scene];
  // Les plages suivent l'échelle de la scène : une pièce et un pâté de maisons ne se règlent pas
  // avec le même curseur.
  const limits = SCENE_LIGHT_LIMITS[scene];
  const prefix = 'lighting-' + light.id;
  const move = (axis: 0 | 1 | 2, value: number) => { const position: Vec3 = [...light.position]; position[axis] = value; onChange({ position }); };
  return (
    <div className="space-y-2" data-light-id={light.id}>
      <h3 className="text-xs font-semibold">{light.id}</h3>
      <div className="grid grid-cols-2 gap-2">
        <ColorField prefix={prefix} color={light.color} disabled={disabled} onChange={color => onChange({ color })} />
        <IntensityField prefix={prefix} intensity={light.intensity} limits={limits} disabled={disabled} onChange={intensity => onChange({ intensity })} />
        <Input id={prefix + '-range'} label={'Portée · ' + metres(light.range)} help="Distance au-delà de laquelle cette lampe n’éclaire plus rien." {...rangeSlider(limits)} value={light.range} disabled={disabled} onChange={event => onChange({ range: Number(event.target.value) })} />
        <Input id={prefix + '-x'} label={'X · ' + metres(light.position[0])} type="range" min={bounds.minX} max={bounds.maxX} step={0.1} value={light.position[0]} disabled={disabled} onChange={event => move(0, Number(event.target.value))} />
        <Input id={prefix + '-y'} label={'Y · ' + metres(light.position[1])} type="range" min={bounds.minY} max={bounds.maxY} step={0.1} value={light.position[1]} disabled={disabled} onChange={event => move(1, Number(event.target.value))} />
        <Input id={prefix + '-z'} label={'Z · ' + metres(light.position[2])} type="range" min={bounds.minZ} max={bounds.maxZ} step={0.1} value={light.position[2]} disabled={disabled} onChange={event => move(2, Number(event.target.value))} />
        <ShadowField prefix={prefix} castsShadow={light.castsShadow} disabled={disabled} onChange={castsShadow => onChange({ castsShadow })} />
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
  const [stats, setStats] = useState<LightingFrameStats>(emptyLightingStats);
  const [backend, setBackend] = useState<LightingBackendId | null>(null);
  // Moteur demandé par l'utilisateur ; `backend` dit celui qui tourne réellement.
  const [engine, setEngine] = useState<LightingBackendId>(DEFAULT_LIGHTING_BACKEND);
  // La lumière qui rebondit se demande à la création de l'explorateur : la changer rouvre la scène.
  const [bounce, setBounce] = useState(DEFAULT_LIGHTING_BOUNCE);
  // Le motif du moteur quand le rebond demandé n'existe pas, tel qu'il le publie dans son diagnostic.
  const [bounceNotice, setBounceNotice] = useState<string | null>(null);
  // Déplacement demandé (sélecteur) et déplacement réellement branché. Le panneau « Caméra active »
  // annonce ce qui est branché, pas l'intention.
  const [camera, setCamera] = useState<LightingCameraMode>(DEFAULT_LIGHTING_CAMERA);
  const [cameraMode, setCameraMode] = useState<LightingCameraMode>(DEFAULT_LIGHTING_CAMERA);
  // Géométrie de collision du banc 15, chargée une fois par scène ouverte : changer de déplacement
  // pendant l'exploration ne la relit pas.
  const navigationWorld = useRef<NavigationWorld | null>(null);
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
  /** Les commandes de déplacement du banc 15, branchées telles quelles sur les deux scènes. Les deux
   *  caches exposent leur `navigation.bin` à côté de leur manifeste ; si le fichier manque vraiment,
   *  le motif est remonté à l'appelant, qui le dit et retombe sur l'orbite. */
  const buildControls = async (context: ControlsContext, signal: AbortSignal, owner: number): Promise<LightingControlsHandle> => {
    if (context.mode === 'orbit') {
      const orbit = context.orbitControls();
      if (generation.current === owner) setCameraMode('orbit');
      return { update: () => orbit.update(), dispose: () => orbit.dispose() };
    }
    const world = navigationWorld.current ?? await loadNavigationWorld(context.manifestUrl, context.sourceKey, context.bounds, 1, signal);
    navigationWorld.current = world;
    if (generation.current === owner) setCameraMode(context.mode);
    return createNavigationControls(context.canvas, context.camera, world, context.mode, 0);
  };

  const launch = (override?: { engine?: LightingBackendId; camera?: LightingCameraMode; bounce?: boolean; keepConfig?: boolean }) => {
    if (busy.current) return;
    const wantedEngine = override?.engine ?? engine, wantedCamera = override?.camera ?? camera;
    const wantedBounce = override?.bounce ?? bounce;
    // Aucune image n'a encore été relevée sur cette session : les compteurs de la précédente, et
    // l'indisponibilité qu'elle publiait, ne valent plus rien.
    busy.current = true; setStatus('loading'); setMessage('Chargement de la scène…'); setCapabilities(null); setBackend(null); setCameraMode(wantedCamera); setStats(emptyLightingStats()); setBounceNotice(null);
    navigationWorld.current = null;
    const abort = new AbortController(); abortRef.current = abort;
    const owner = ++generation.current;
    if (!override?.keepConfig) setConfig(defaultConfig(sceneId));
    void (async () => {
      try {
        const runner = await import('../../16-lighting-transport/index.ts');
        if (generation.current !== owner || abort.signal.aborted) return;
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('La surface de rendu est indisponible.');
        const createControls = async (context: ControlsContext): Promise<LightingControlsHandle> => {
          try {
            return await buildControls(context, abort.signal, owner);
          } catch (error) {
            if (context.mode === 'orbit' || abort.signal.aborted) throw error;
            // Fait constaté, pas supposé : la géométrie de collision manque pour ce cache. On le dit
            // et on garde l'orbite, sans réimplémenter de commande maison.
            const reason = error instanceof Error ? error.message : String(error);
            if (generation.current === owner) setMessage('Déplacement à pied indisponible : ' + reason + ' Repli sur l’orbite, caméra placée au sol au centre de l’emprise.');
            // Second terme de la règle de départ : sans point praticable lu du fichier de navigation,
            // le centre de l'emprise au niveau du sol, à hauteur d'œil.
            placeAtGround(context.camera, context.bounds);
            return buildControls({ ...context, mode: 'orbit' }, abort.signal, owner);
          }
        };
        const controller = await runner.createLightingBench(canvas, sceneId, {
          signal: abort.signal, backend: wantedEngine, camera: wantedCamera, bounce: wantedBounce,
          onProgress: value => { if (generation.current === owner) setMessage(value); }, createControls,
        });
        if (generation.current !== owner || abort.signal.aborted) { controller.dispose(); return; }
        controllerRef.current = controller;
        // Scène rouverte à réglages conservés (moteur changé, rebond allumé ou éteint) : le nouvel
        // explorateur reçoit la configuration que la colonne de droite affiche, sinon elle
        // annoncerait des lampes que le moteur n'a pas.
        if (override?.keepConfig) controller.update(config);
        setCapabilities(controller.getCapabilities());
        setBackend(controller.backend);
        setStatus('running'); setMessage('Scène active sur ' + engineLabel(controller.backend) + '. Le déplacement, le moteur et les lampes restent réglables à droite.');
        const tick = () => {
          if (generation.current !== owner || !controllerRef.current) return;
          setStats(controllerRef.current.getStats());
          setBounceNotice(controllerRef.current.getBounceUnavailable());
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
  const changeLight = (id: string, patch: Partial<PlacedLight>) => {
    change({ lights: config.lights.map(light => (light.id === id ? { ...light, ...patch } : light)) });
  };
  const changeSun = (patch: Partial<SunConfig>) => change({ sun: { ...config.sun, ...patch } });
  /** Comme au banc 15 : l'explorateur précédent est libéré, puis la scène rouvre sur une surface de
   *  rendu neuve que la fiche commune remonte pendant l'attente. Le moteur et le rebond se demandent
   *  tous deux à la création de l'explorateur : ni l'un ni l'autre ne se change scène ouverte. */
  const reopen = (notice: string, override: { engine?: LightingBackendId; bounce?: boolean }) => {
    if (!busy.current) return;
    abortRef.current?.abort(); release(); busy.current = false;
    setStatus('stopped'); setCapabilities(null); setBackend(null);
    setMessage(notice);
    afterRemount(() => launch({ ...override, keepConfig: true }));
  };
  const changeEngine = (id: LightingBackendId) => {
    if (id === engine) return;
    setEngine(id);
    reopen('Changement de moteur vers ' + engineLabel(id) + ' · surface de rendu neuve…', { engine: id });
  };
  const changeBounce = (wanted: boolean) => {
    setBounce(wanted);
    reopen('Rebond de lumière ' + (wanted ? 'allumé' : 'éteint') + ' · surface de rendu neuve…', { bounce: wanted });
  };
  /** Le déplacement se change scène ouverte : le runner ne libère les anciennes commandes qu'une
   *  fois les nouvelles construites, donc un refus laisse la scène pilotable comme avant. */
  const changeCamera = (mode: LightingCameraMode) => {
    setCamera(mode);
    const controller = controllerRef.current;
    if (!controller) return;
    void controller.setCamera(mode)
      .then(applied => { setCameraMode(applied); setMessage('Déplacement : ' + cameraModeLabel(applied) + '.'); })
      .catch(error => { setCamera(controller.camera); setMessage('Déplacement refusé : ' + (error instanceof Error ? error.message : String(error))); });
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
    runBenchmark: () => launch(), runPain: stop, stopBenchmark: stop,
    openReport, closeReport: () => setModal(old => ({ ...old, open: false })), copyReport, refreshReport: openReport, openFinder,
    newExecution: () => { if (!active) { generation.current++; setStatus('idle'); setMessage('Prêt à ouvrir une scène.'); } },
  };
  const stats4 = { submit: 'Non mesuré', cpuFrame: number(stats.frame?.cpuFrameMs, ' ms'), fps: number(stats.fps, ' FPS'), drawCalls: number(stats.frame?.drawCalls) };
  // Ce que le banc 16 sait remplir du panneau commun : le reste s'affiche « Non mesuré », jamais 0.
  // Ses deux backends sont des moteurs à pages, donc les compteurs de pages du panneau sont réels.
  const metricsSource: ModelMetricsSource = {
    metrics: stats.frame, frameIntervalMs: stats.fps ? 1000 / stats.fps : null, cameraPose: stats.cameraPose,
    availableTriangles: null, engine: backend ?? 'Non mesuré', camera: cameraMode, exactPageCounters: true,
  };
  const contextState = {
    ...baseSnapshot, running: active, framePresented: status === 'running', reportModal: modal, showWebgl: active,
    // Le bandeau du bas nomme le moteur qui tourne, ou celui qui va être lancé : jamais un moteur en dur.
    telemetryMode: engineLabel(backend ?? engine) + (backend ? ' · moteur actif' : ' · moteur choisi'),
    stats: { ...baseSnapshot.stats, ...stats4 },
    execution: { kind: 'exploration' as const, status: status === 'loading' ? ('running' as const) : status, phase: message, lastCampaign: null },
  };

  // Les deux sélecteurs restent au même endroit, scène ouverte comme à l'arrêt ; seul le chargement
  // les fige, le temps que la scène demandée soit réellement en place.
  const liveLocked = active && status !== 'running';
  const limits = SCENE_LIGHT_LIMITS[sceneId];
  const bounceReason = bounce ? bounceNotice : null;

  const panels = {
    configuration: (
      <>
        <SegmentedControl label="Scène" disabled={active} value={sceneId} onChange={value => setSceneId(value)} options={SCENES.map(scene => ({ value: scene.id, label: scene.title }))} />
        <Select id="lighting-camera" label="Caméra" help={cameraModeHelp(camera)} value={camera} disabled={liveLocked} onChange={event => changeCamera(event.target.value as LightingCameraMode)}>
          {LAB_CAMERA_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </Select>
        <Select id="lighting-engine" label="Moteur affiché" help="Le moteur précédent est libéré, puis la scène rouvre sur le moteur choisi." value={engine} disabled={liveLocked} onChange={event => changeEngine(event.target.value as LightingBackendId)}>
          {LIGHTING_BACKEND_IDS.map(id => <option key={id} value={id}>{engineLabel(id)}</option>)}
        </Select>
        <Input id="lighting-bounce" label="Rebond de lumière" help="Coûteux sur les grandes scènes, lot d’optimisation en cours." error={bounceReason ? 'Rebond indisponible · ' + bounceReason : undefined} type="checkbox" checked={bounce} disabled={liveLocked} onChange={event => changeBounce(event.target.checked)} />
        {active ? (
          <>
            <Select id="lighting-view" label="Vue d’éclairage" help="« Sans éclairage » est la vue de diagnostic d’albédo brut du moteur : la couleur des matériaux telle quelle, sans lampe. « Auto » la rend tant qu’aucune lampe n’est déclarée. « Rebond seul » est la vue de mesure du moteur : l’irradiance indirecte seule, noire sans rebond gréé." value={config.view} disabled={liveLocked || !capabilities?.setLightingView} onChange={event => change({ view: event.target.value as SceneLightingView })}>
              {LIGHTING_VIEWS.map(view => <option key={view.value} value={view.value}>{view.label}</option>)}
            </Select>
            <SunFields sun={config.sun} disabled={liveLocked || !capabilities?.addLight} onChange={changeSun} />
            <Input id="lighting-shadows" label="Ombres" type="checkbox" checked={config.shadows} disabled={liveLocked} onChange={event => change({ shadows: event.target.checked })} />
            <Input id="lighting-auto-count" label={'Lampes automatiques · ' + config.autoLightCount} help="Lampadaires du modèle les plus proches du point de départ, puis grille de secours." type="range" min={AUTO_LIGHT_MIN} max={AUTO_LIGHT_MAX} step={1} value={config.autoLightCount} disabled={liveLocked || !capabilities?.addLight} onChange={event => change({ autoLightCount: Number(event.target.value) })} />
            <Input id="lighting-auto-intensity" label={'Intensité des lampes automatiques · ' + radiometric(config.autoLightIntensity)} {...intensitySlider(limits)} value={config.autoLightIntensity} disabled={liveLocked || !capabilities?.addLight} onChange={event => change({ autoLightIntensity: Number(event.target.value) })} />
            <Input id="lighting-auto-range" label={'Portée des lampes automatiques · ' + metres(config.autoLightRange)} {...rangeSlider(limits)} value={config.autoLightRange} disabled={liveLocked || !capabilities?.addLight} onChange={event => change({ autoLightRange: Number(event.target.value) })} />
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
          <MetricTable label="Coût par étape" columns={STAGE_COLUMNS} rows={stageRows(stats.stageProfile)} provenance={stageProvenance(stats.stageProfile)} />
        </>
      } />
    ),
  };

  return <LabContext.Provider value={{ state: contextState, actions, panels }}><LabShell webglRef={canvasRef} webgpuRef={unusedGpu} chartRef={unusedChart} /></LabContext.Provider>;
}
