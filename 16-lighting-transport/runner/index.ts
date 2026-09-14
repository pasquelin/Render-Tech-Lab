import * as THREE from 'three';
import { createExplorer, exactPagesBackend, webgpuPagesBackend, detectCapabilities } from '@web-geometry/sdk/browser';
import type { CameraPose, Explorer, BackendFactory } from '@web-geometry/sdk/browser';
import {
  MAX_SHADOWED_LIGHTS_PER_FRAME, defaultConfig,
  type LightingBackendId, type LightingBenchConfig, type LightingController, type LightingBenchOptions,
  type LightingFrameStats, type SceneId, type SceneLight, type EngineCapabilities, type LightingControlsHandle,
} from '../contracts.ts';
import { detectEngineCapabilities } from '../implementation/engineCapabilities.ts';
import { createHouseAnimatedNodes, carHeadlightPoses, autoLightOnOff, buildAutoLights, type AnimatedNode } from '../implementation/sceneAnimations.ts';

const noopControls: LightingControlsHandle = { update() {}, dispose() {} };

const MANIFEST_URLS: Record<SceneId, string> = {
  house: '/16-lighting-cache/house/native/full/manifest.json',
  'emerald-night': '/emerald-night-cache/native/full/manifest.json',
};

const emptyStats = (): LightingFrameStats => ({
  fps: null, cpuFrameMs: null, gpuMs: null, lightsActive: null, shadowsUpdated: null,
  gpuLightListsMs: null, gpuShadowsMs: null, gpuLightingMs: null, drawCalls: null, triangles: null,
  frame: null, cameraPose: null,
});

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

/** Le contrat de lampes (addLight/setLight/removeLight/setEnvironment/setTransform) n'est rendu
 * visible que par le backend WebGPU (webgpuPagesBackend) ; exact-cluster-pages (WebGL2) reste la
 * valeur sûre partout ailleurs. On préfère WebGPU dès qu'un adaptateur existe, sans jamais l'exiger. */
async function pickBackend(): Promise<{ factory: BackendFactory; id: LightingBackendId }> {
  try {
    const probe = document.createElement('canvas');
    const detected = await detectCapabilities('webgpu', probe);
    if (detected.adapter) return { factory: webgpuPagesBackend, id: 'webgpu-page-raster' };
  } catch { /* WebGPU indisponible sur ce navigateur ou cet appareil : repli WebGL2 silencieux. */ }
  return { factory: exactPagesBackend, id: 'exact-cluster-pages' };
}

export async function createLightingBench(
  canvas: HTMLCanvasElement, scene: SceneId, options: LightingBenchOptions = {},
): Promise<LightingController> {
  const { signal, onProgress } = options;
  onProgress?.('Préparation de la scène avec le SDK…');
  const { width, height } = boxSize(canvas);
  const backend = await pickBackend();
  const explorer = await createExplorer(canvas, {
    manifestUrl: MANIFEST_URLS[scene], scope: 'full', signal, preload: 'all', width, height,
    backends: [backend.factory], onPreparation: event => onProgress?.(event.message),
  });
  const capabilities = detectEngineCapabilities(explorer);

  const resize = new ResizeObserver(() => {
    const size = canvas.getBoundingClientRect();
    if (size.width > 0 && size.height > 0) explorer.resize(Math.round(size.width), Math.round(size.height));
  });
  resize.observe(canvas);

  // La caméra à la première personne (WASD, souris, collisions) est le composant existant du banc 15 ;
  // ce fichier ne construit rien lui-même — options.createControls (fourni par LightingLab.tsx, la
  // seule couche autorisée à importer un autre banc) choisit navigationControls ou l'orbite de repli.
  const controls: LightingControlsHandle = options.createControls ? await options.createControls({
    canvas, camera: explorer.camera, bounds: explorer.bounds, manifestUrl: MANIFEST_URLS[scene],
    sourceKey: explorer.metadata.key, orbitControls: () => explorer.controls(),
  }) : noopControls;

  const houseNodes = scene === 'house' ? createHouseAnimatedNodes() : [];
  const nodeBuffers = new Map<string, { matrix: THREE.Matrix4; buffer: Float32Array }>();
  for (const nodeEntry of houseNodes) nodeBuffers.set(nodeEntry.name, { matrix: new THREE.Matrix4(), buffer: new Float32Array(16) });
  const unitScale = new THREE.Vector3(1, 1, 1);
  // Cible reconstruite depuis la direction de vue, comme ModelLab.tsx (banc 15) : un mètre devant
  // l'œil. Vecteur réutilisé d'une image à l'autre pour ne rien allouer dans la boucle de rendu.
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
  let autoLights: SceneLight[] = buildAutoLights(scene, config.autoLightCount, [1, 0.85, 0.6], 5, config.shadows);
  let stats = emptyStats();
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
      cpuFrameMs: metrics.cpuFrameMs ?? null,
      gpuMs: metrics.gpuMs ?? metrics.gpuFrameMs ?? null,
      lightsActive: metrics.lightsActive ?? (capabilities.addLight ? activeLightIds.size : null),
      shadowsUpdated: metrics.shadowsUpdated ?? null,
      gpuLightListsMs: metrics.gpuLightListsMs ?? null,
      gpuShadowsMs: metrics.gpuShadowsMs ?? null,
      gpuLightingMs: metrics.gpuLightingMs ?? null,
      drawCalls: metrics.drawCalls ?? null,
      triangles: metrics.triangles ?? null,
      frame: metrics,
      cameraPose: readCameraPose(),
    };
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);

  return {
    backend: backend.id,
    getConfig: () => ({ ...config, lights: config.lights.map(light => ({ ...light })) }),
    getCapabilities: () => ({ ...capabilities }),
    getStats: () => stats,
    update(patch) {
      config = { ...config, ...patch, lights: patch.lights ? patch.lights.map(light => ({ ...light })) : config.lights };
      if (patch.autoLightCount !== undefined) autoLights = buildAutoLights(scene, config.autoLightCount, [1, 0.85, 0.6], 5, config.shadows);
      if (patch.night !== undefined) applyEnvironment();
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
