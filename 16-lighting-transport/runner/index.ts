import * as THREE from 'three';
import { createExplorer, exactPagesBackend, webgpuPagesBackend } from '@web-geometry/sdk/browser';
import type { CameraPose, Explorer, BackendFactory } from '@web-geometry/sdk/browser';
import {
  MAX_SHADOWED_LIGHTS_PER_FRAME, DEFAULT_LIGHTING_BACKEND, DEFAULT_LIGHTING_CAMERA, defaultConfig, emptyLightingStats,
  type LightingBackendId, type LightingBenchConfig, type LightingController, type LightingBenchOptions,
  type LightingCameraMode, type SceneId, type SceneLight, type EngineCapabilities, type LightingControlsHandle,
  type Vec3,
} from '../contracts.ts';
import { detectEngineCapabilities } from '../implementation/engineCapabilities.ts';
import { createHouseAnimatedNodes, carHeadlightPoses, autoLightOnOff, buildAutoLights, type AnimatedNode } from '../implementation/sceneAnimations.ts';

const noopControls: LightingControlsHandle = { update() {}, dispose() {} };

const MANIFEST_URLS: Record<SceneId, string> = {
  house: '/16-lighting-cache/house/native/full/manifest.json',
  'emerald-night': '/emerald-night-cache/native/full/manifest.json',
};

/** Compose un THREE.Matrix4 dans un tampon Float32Array(16) réutilisé (aucune allocation par image). */
function writeWorldMatrix(node: AnimatedNode, matrix: THREE.Matrix4, buffer: Float32Array, unitScale: THREE.Vector3): Float32Array {
  matrix.compose(node.position, node.quaternion, unitScale);
  matrix.toArray(buffer);
  return buffer;
}

function applyLightSet(explorer: Explorer, capabilities: EngineCapabilities, activeIds: Set<string>, desired: SceneLight[]) {
  const desiredIds = new Set(desired.map(light => light.id));
  if (capabilities.removeLight) for (const id of [...activeIds]) if (!desiredIds.has(id)) {
    explorer.removeLight(id);
    activeIds.delete(id);
  }
  for (const light of desired) {
    if (activeIds.has(light.id)) { if (capabilities.setLight) explorer.setLight(light.id, light); }
    else if (capabilities.addLight) { explorer.addLight(light); activeIds.add(light.id); }
  }
}

/** Au plus MAX_SHADOWED_LIGHTS_PER_FRAME lampes gardent leur ombre ; les autres la perdent pour cette image. */
function capShadows(lights: SceneLight[], shadowsEnabled: boolean): SceneLight[] {
  if (!shadowsEnabled) return lights.map(light => (light.castsShadow ? { ...light, castsShadow: false } : light));
  let remaining = MAX_SHADOWED_LIGHTS_PER_FRAME;
  return lights.map(light => {
    if (!light.castsShadow) return light;
    if (remaining > 0) { remaining--; return light; }
    return { ...light, castsShadow: false };
  });
}

/** Comme ModelLab.tsx (banc 15) : l'Explorer occupe exactement le cadre CSS du canvas, plein cadre,
 * jamais une résolution fixe par défaut — sinon object-contain le réduirait avec des marges. */
function boxSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const box = canvas.getBoundingClientRect();
  return { width: Math.max(1, Math.round(box.width)), height: Math.max(1, Math.round(box.height)) };
}

/** Les deux moteurs que l'utilisateur choisit dans le panneau, comme au banc 15. Aucun repli
 * silencieux : le moteur demandé est le seul construit, et son absence est dite. */
const BACKENDS: Record<LightingBackendId, BackendFactory> = {
  'webgpu-page-raster': webgpuPagesBackend,
  'exact-cluster-pages': exactPagesBackend,
};

/** Les réglages dont dépend la liste des lampes automatiques ; les autres n'obligent pas à la refaire. */
const AUTO_LIGHT_KEYS: readonly (keyof LightingBenchConfig)[] = ['autoLightCount', 'autoLightIntensity', 'autoLightRange', 'shadows'];

export async function createLightingBench(
  canvas: HTMLCanvasElement, scene: SceneId, options: LightingBenchOptions = {},
): Promise<LightingController> {
  const { signal, onProgress } = options;
  onProgress?.('Préparation de la scène avec le SDK…');
  const { width, height } = boxSize(canvas);
  const backend = options.backend ?? DEFAULT_LIGHTING_BACKEND;
  const explorer = await createExplorer(canvas, {
    manifestUrl: MANIFEST_URLS[scene], scope: 'full', signal, preload: 'all', width, height,
    backends: [BACKENDS[backend]], onPreparation: event => onProgress?.(event.message),
    // Chronométrage par étape du moteur : c'est lui qui tient la fenêtre glissante, les quantiles et
    // le coût du relevé. Sans ce drapeau, explorer.stageProfile() ne renvoie que « non mesuré ».
    stageProfile: true,
  });
  const capabilities = detectEngineCapabilities(explorer);

  const resize = new ResizeObserver(() => {
    const size = canvas.getBoundingClientRect();
    if (size.width > 0 && size.height > 0) explorer.resize(Math.round(size.width), Math.round(size.height));
  });
  resize.observe(canvas);

  // La caméra à la première personne (WASD, souris, collisions) est le composant existant du banc 15 ;
  // ce fichier ne construit rien lui-même — options.createControls (fourni par LightingLab.tsx, la
  // seule couche autorisée à importer un autre banc) construit le déplacement demandé.
  const buildControls = (mode: LightingCameraMode) => options.createControls?.({
    mode, canvas, camera: explorer.camera, bounds: explorer.bounds, manifestUrl: MANIFEST_URLS[scene],
    sourceKey: explorer.metadata.key, orbitControls: () => explorer.controls(),
  }) ?? Promise.resolve(noopControls);
  let cameraMode = options.camera ?? DEFAULT_LIGHTING_CAMERA;
  let controls: LightingControlsHandle = await buildControls(cameraMode);

  const houseNodes = scene === 'house' ? createHouseAnimatedNodes() : [];
  const nodeBuffers = new Map<string, { matrix: THREE.Matrix4; buffer: Float32Array }>();
  for (const nodeEntry of houseNodes) nodeBuffers.set(nodeEntry.name, { matrix: new THREE.Matrix4(), buffer: new Float32Array(16) });
  const unitScale = new THREE.Vector3(1, 1, 1);
  // Cible du bloc « Caméra active » : reconstruite depuis la direction de vue, un mètre devant l'œil.
  // Vecteur réutilisé d'une image à l'autre pour ne rien allouer dans la boucle de rendu.
  const lookAhead = new THREE.Vector3();
  const readCameraPose = (): CameraPose => {
    const camera = explorer.camera;
    camera.getWorldDirection(lookAhead).add(camera.position);
    return {
      position: camera.position.toArray() as CameraPose['position'],
      target: lookAhead.toArray() as CameraPose['target'],
      fov: camera.fov, near: camera.near, far: camera.far,
    };
  };
  const failedNodes = new Set<string>();

  let config: LightingBenchConfig = defaultConfig(scene);
  const activeLightIds = new Set<string>();
  // Les commandes viennent de placer la caméra à son point de départ : c'est autour de lui que les
  // lampadaires automatiques sont retenus, pour que la rue d'arrivée soit celle qui s'allume.
  const lightOrigin = explorer.camera.position.toArray() as Vec3;
  const autoColor: Vec3 = [1, 0.85, 0.6];
  const rebuildAutoLights = () => buildAutoLights(scene, config.autoLightCount, autoColor, config.autoLightIntensity, config.autoLightRange, config.shadows, lightOrigin);
  let autoLights: SceneLight[] = rebuildAutoLights();
  let stats = emptyLightingStats();
  const start0 = performance.now();
  let previousRafTime: number | null = null;
  let rafHandle = 0;
  let disposed = false;

  const applyEnvironment = () => {
    if (!capabilities.setEnvironment) return;
    const skyColor: [number, number, number] = config.night ? [0.02, 0.03, 0.06] : [0.55, 0.68, 0.85];
    explorer.setEnvironment({ skyColor, exposure: config.night ? 0.6 : 1 });
  };
  applyEnvironment();

  const tick = (time: number) => {
    if (disposed) return;
    const interval = previousRafTime === null ? null : time - previousRafTime;
    previousRafTime = time;
    const dt = interval === null ? 0 : Math.min(interval / 1000, 0.05);
    const elapsed = (performance.now() - start0) / 1000;
    const animSpeed = config.animationPaused ? 0 : config.animationSpeed;

    controls.update(dt);

    if (capabilities.setTransform) {
      for (const nodeEntry of houseNodes) {
        if (failedNodes.has(nodeEntry.name)) continue;
        nodeEntry.advance(elapsed, animSpeed);
        const target = nodeBuffers.get(nodeEntry.name)!;
        // setTransform refuse un nœud précisément absent de la scène préparée par un EngineError
        // nommé (UNKNOWN_SCENE_NODE) : ce refus est propre à ce nœud, pas au contrat — les autres
        // nœuds animés continuent, sans désactiver la capacité affichée dans le panneau.
        try { explorer.setTransform(nodeEntry.name, writeWorldMatrix(nodeEntry, target.matrix, target.buffer, unitScale)); }
        catch { failedNodes.add(nodeEntry.name); }
      }
    }

    const adjustable = capShadows(config.lights, config.shadows);
    // Vague allumée/éteinte des lampes automatiques, indépendante des trois lampes réglables à la main.
    // Le contrat refuse une intensité nulle (INVALID_SCENE_LIGHT) : une lampe « éteinte » est simplement
    // absente de la liste souhaitée, retirée par applyLightSet le temps qu'elle reste hors cycle.
    const auto = capShadows(autoLights.filter((_, index) => autoLightOnOff(index, elapsed, animSpeed)), config.shadows);
    let desired = [...adjustable, ...auto];
    if (scene === 'emerald-night') {
      const heads = carHeadlightPoses(elapsed, animSpeed);
      desired = [...desired, ...heads.map((head, index): SceneLight => ({
        id: `headlight-${index}`, kind: 'spot', position: head.position, direction: head.direction,
        color: [1, 0.95, 0.85], intensity: 10, range: 20, coneAngle: 0.45, castsShadow: false,
      }))];
    }
    applyLightSet(explorer, capabilities, activeLightIds, desired);

    // FrameMetrics porte directement les compteurs lampes/ombres quand le backend actif les publie ;
    // aucun appel séparé n'existe pour eux.
    const metrics = explorer.render();
    stats = {
      fps: interval && interval > 0 ? 1000 / interval : null,
      gpuMs: metrics.gpuMs ?? metrics.gpuFrameMs ?? null,
      lightsActive: metrics.lightsActive ?? (capabilities.addLight ? activeLightIds.size : null),
      shadowsUpdated: metrics.shadowsUpdated ?? null,
      gpuLightListsMs: metrics.gpuLightListsMs ?? null,
      gpuShadowsMs: metrics.gpuShadowsMs ?? null,
      gpuLightingMs: metrics.gpuLightingMs ?? null,
      frame: metrics,
      cameraPose: readCameraPose(),
      // Le profil par étape est lu comme les autres compteurs, une fois par image : c'est le moteur
      // qui tient la fenêtre glissante, ce relevé n'en est qu'une photographie.
      stageProfile: explorer.stageProfile(),
    };
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);

  return {
    backend,
    get camera() { return cameraMode; },
    getConfig: () => ({ ...config, lights: config.lights.map(light => ({ ...light })) }),
    getCapabilities: () => ({ ...capabilities }),
    getStats: () => stats,
    update(patch) {
      config = { ...config, ...patch, lights: patch.lights ? patch.lights.map(light => ({ ...light })) : config.lights };
      if (AUTO_LIGHT_KEYS.some(key => patch[key] !== undefined)) autoLights = rebuildAutoLights();
      if (patch.night !== undefined) applyEnvironment();
    },
    async setCamera(mode) {
      if (disposed || mode === cameraMode) return cameraMode;
      // Les nouvelles commandes sont construites avant de libérer les anciennes : si la géométrie de
      // navigation manque, la scène reste pilotable avec le déplacement précédent.
      const replacement = await buildControls(mode);
      controls.dispose();
      controls = replacement;
      cameraMode = mode;
      return cameraMode;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafHandle);
      resize.disconnect();
      controls.dispose();
      explorer.dispose();
    },
  };
}
