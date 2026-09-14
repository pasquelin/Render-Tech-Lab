import type * as THREE from 'three';
import type { CameraPose, FrameMetrics } from '@web-geometry/sdk/browser';

export type Vec3 = [number, number, number];
export type SceneId = 'house' | 'emerald-night';

export const SCENES: ReadonlyArray<{ readonly id: SceneId; readonly title: string; readonly description: string }> = [
  { id: 'house', title: 'Maison de test', description: 'Quatre pièces et un couloir sur 40 × 30 m, portes, ventilateur, panneau, lampe baladeuse, miroirs, sphère, fente et deux objets identiques.' },
  { id: 'emerald-night', title: 'Scène urbaine de nuit', description: 'Un pâté de maisons de nuit, lampadaires du modèle et deux phares qui suivent un parcours fermé.' },
];

/** Contrat livré par l'Opus (moteur) ; le banc l'appelle tel quel et détecte ce qui manque encore. */
export type SceneLightKind = 'point' | 'spot';
export interface SceneLight {
  id: string;
  kind: SceneLightKind;
  position: Vec3;
  direction?: Vec3;
  color: Vec3;
  intensity: number;
  range: number;
  coneAngle?: number;
  castsShadow: boolean;
}
export const MAX_ENGINE_LIGHTS = 64;
export const MAX_SHADOWED_LIGHTS_PER_FRAME = 4;

/** Les trois lampes réglables à la main ; leurs limites de position dépendent de la scène choisie. */
export const ADJUSTABLE_LIGHT_IDS = ['light-1', 'light-2', 'light-3'] as const;
export type AdjustableLightId = (typeof ADJUSTABLE_LIGHT_IDS)[number];

export interface PositionBounds { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number; readonly minZ: number; readonly maxZ: number; }
export const SCENE_LIGHT_BOUNDS: Readonly<Record<SceneId, PositionBounds>> = Object.freeze({
  house: Object.freeze({ minX: -19, maxX: 19, minY: 0.3, maxY: 2.8, minZ: -14, maxZ: 14 }),
  'emerald-night': Object.freeze({ minX: -64, maxX: -13, minY: 0.3, maxY: 10, minZ: 13, maxZ: 64 }),
});

export function defaultAdjustableLights(scene: SceneId): SceneLight[] {
  const b = SCENE_LIGHT_BOUNDS[scene];
  const midY = Math.min(b.maxY, 2.4);
  return [
    { id: 'light-1', kind: 'point', position: [b.minX + (b.maxX - b.minX) * 0.25, midY, b.minZ + (b.maxZ - b.minZ) * 0.5], color: [1, 0.82, 0.6], intensity: 6, range: 12, castsShadow: true },
    { id: 'light-2', kind: 'point', position: [b.minX + (b.maxX - b.minX) * 0.75, midY, b.minZ + (b.maxZ - b.minZ) * 0.5], color: [0.55, 0.75, 1], intensity: 6, range: 12, castsShadow: true },
    { id: 'light-3', kind: 'spot', position: [b.minX + (b.maxX - b.minX) * 0.5, Math.min(b.maxY, 2.8), b.minZ + (b.maxZ - b.minZ) * 0.25], direction: [0, -1, 0], color: [1, 0.55, 0.85], intensity: 8, range: 10, coneAngle: 0.6, castsShadow: false },
  ];
}

/** Curseur 1-30, placé automatiquement (grille dans les pièces / lampadaires à Emerald). */
export const AUTO_LIGHT_MIN = 1;
export const AUTO_LIGHT_MAX = 30;

/** Ce que le moteur expose réellement sur l'Explorer actif, détecté à l'exécution — jamais supposé. */
export interface EngineCapabilities {
  addLight: boolean;
  setLight: boolean;
  removeLight: boolean;
  setEnvironment: boolean;
  setTransform: boolean;
}
export const CAPABILITY_LABELS: Readonly<Record<keyof EngineCapabilities, string>> = Object.freeze({
  addLight: 'Ajout de lampes (addLight)',
  setLight: 'Réglage des lampes (setLight)',
  removeLight: 'Retrait des lampes (removeLight)',
  setEnvironment: 'Ciel et exposition (setEnvironment)',
  setTransform: 'Transformations de nœuds (setTransform) — portes, ventilateur, panneau, lampe, miroir, voiture',
});

export interface LightingBenchConfig {
  scene: SceneId;
  night: boolean;
  shadows: boolean;
  autoLightCount: number;
  lights: SceneLight[];
  animationPaused: boolean;
  animationSpeed: number;
}

export function defaultConfig(scene: SceneId): LightingBenchConfig {
  return { scene, night: scene === 'emerald-night', shadows: true, autoLightCount: 6, lights: defaultAdjustableLights(scene), animationPaused: false, animationSpeed: 1 };
}

/** Backend réellement retenu au démarrage ; mêmes identifiants que le catalogue de moteurs du Lab. */
export type LightingBackendId = 'exact-cluster-pages' | 'webgpu-page-raster';

export interface LightingFrameStats {
  fps: number | null;
  cpuFrameMs: number | null;
  gpuMs: number | null;
  lightsActive: number | null;
  shadowsUpdated: number | null;
  gpuLightListsMs: number | null;
  gpuShadowsMs: number | null;
  gpuLightingMs: number | null;
  drawCalls: number | null;
  triangles: number | null;
  /** Compteurs bruts publiés par le moteur pour cette image : ils alimentent le panneau de métriques
   *  commun au banc 15, sans être recopiés ni recalculés ici. */
  frame: FrameMetrics | null;
  /** Pose de la caméra active, pour le bloc « Caméra active » du même panneau commun. */
  cameraPose: CameraPose | null;
}

/** Ce que le runner tient à jour chaque image et libère à dispose() ; peu importe qui la construit. */
export interface LightingControlsHandle {
  update(dtSeconds: number): void;
  dispose(): void;
}

/** Tout ce qu'il faut pour construire les commandes de caméra une fois l'Explorer prêt. La caméra à la
 * première personne elle-même (WASD, souris, collisions) est un composant existant du banc 15
 * (15-virtualized-integration/implementation/navigationControls.ts) : ce contrat le laisse construire
 * en dehors du runner (dans src/components/LightingLab.tsx, la seule couche autorisée à importer les
 * fichiers internes d'un autre banc), pour que le runner reste sans dépendance envers un autre banc. */
export interface ControlsContext {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  bounds: THREE.Box3;
  manifestUrl: string;
  sourceKey: string;
  /** Repli non maison si les commandes du banc 15 n'ont pas ce qu'il leur faut (ex. pas de
   * navigation.bin pour cette scène) : les vraies orbit controls que l'Explorer construit déjà. */
  orbitControls: () => { update(): void; dispose(): void };
}

export interface LightingBenchOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  createControls?: (context: ControlsContext) => Promise<LightingControlsHandle>;
}

export interface LightingController {
  readonly backend: LightingBackendId;
  getConfig(): LightingBenchConfig;
  getCapabilities(): EngineCapabilities;
  getStats(): LightingFrameStats;
  update(patch: Partial<LightingBenchConfig>): void;
  dispose(): void;
}
