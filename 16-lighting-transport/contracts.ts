import type * as THREE from 'three';
import type { CameraPose, FrameMetrics } from '@web-geometry/sdk/browser';
import type { StageProfile } from '@web-geometry/sdk';

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

/** Plages des curseurs d'une lampe, à l'échelle de la scène. `intensity` est l'intensité
 *  radiométrique du contrat du moteur (W/sr) et `range` la portée en mètres : un pâté de maisons
 *  demande des dizaines de mètres et des dizaines de W/sr là où une pièce se contente de quelques
 *  unités. Les valeurs par défaut sortent d'ici pour qu'une seule table décrive chaque scène. */
export interface SceneLightLimits {
  readonly intensityMax: number;
  readonly intensityStep: number;
  readonly rangeMax: number;
  readonly rangeStep: number;
  readonly defaultIntensity: number;
  readonly defaultRange: number;
}
export const SCENE_LIGHT_LIMITS: Readonly<Record<SceneId, SceneLightLimits>> = Object.freeze({
  house: Object.freeze({ intensityMax: 20, intensityStep: 0.5, rangeMax: 20, rangeStep: 0.5, defaultIntensity: 6, defaultRange: 12 }),
  'emerald-night': Object.freeze({ intensityMax: 200, intensityStep: 5, rangeMax: 80, rangeStep: 1, defaultIntensity: 40, defaultRange: 30 }),
});

export function defaultAdjustableLights(scene: SceneId): SceneLight[] {
  const b = SCENE_LIGHT_BOUNDS[scene];
  const limits = SCENE_LIGHT_LIMITS[scene];
  const midY = Math.min(b.maxY, 2.4);
  // Le projecteur garde son rapport historique aux deux ponctuelles : un tiers plus intense, un
  // sixième moins portant. Seule l'échelle de la scène change d'une scène à l'autre.
  const spotIntensity = Math.min(limits.intensityMax, limits.defaultIntensity * 4 / 3);
  const spotRange = limits.defaultRange * 5 / 6;
  return [
    { id: 'light-1', kind: 'point', position: [b.minX + (b.maxX - b.minX) * 0.25, midY, b.minZ + (b.maxZ - b.minZ) * 0.5], color: [1, 0.82, 0.6], intensity: limits.defaultIntensity, range: limits.defaultRange, castsShadow: true },
    { id: 'light-2', kind: 'point', position: [b.minX + (b.maxX - b.minX) * 0.75, midY, b.minZ + (b.maxZ - b.minZ) * 0.5], color: [0.55, 0.75, 1], intensity: limits.defaultIntensity, range: limits.defaultRange, castsShadow: true },
    { id: 'light-3', kind: 'spot', position: [b.minX + (b.maxX - b.minX) * 0.5, Math.min(b.maxY, 2.8), b.minZ + (b.maxZ - b.minZ) * 0.25], direction: [0, -1, 0], color: [1, 0.55, 0.85], intensity: spotIntensity, range: spotRange, coneAngle: 0.6, castsShadow: false },
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
  /** Portée (m) et intensité (W/sr) communes aux lampes automatiques, réglables comme celles des
   *  trois lampes nommées : sans elles, une lampe de pièce éclairerait une rue entière. */
  autoLightRange: number;
  autoLightIntensity: number;
  lights: SceneLight[];
  animationPaused: boolean;
  animationSpeed: number;
}

export function defaultConfig(scene: SceneId): LightingBenchConfig {
  const limits = SCENE_LIGHT_LIMITS[scene];
  return {
    scene, night: scene === 'emerald-night', shadows: true, autoLightCount: 6,
    autoLightRange: limits.defaultRange, autoLightIntensity: limits.defaultIntensity,
    lights: defaultAdjustableLights(scene), animationPaused: false, animationSpeed: 1,
  };
}

/** Moteurs que ce banc sait lancer ; mêmes identifiants que le catalogue de moteurs du Lab, pour
 *  que le sélecteur reprenne les libellés du banc 15 au lieu d'en inventer. */
export const LIGHTING_BACKEND_IDS = ['webgpu-page-raster', 'exact-cluster-pages'] as const;
export type LightingBackendId = (typeof LIGHTING_BACKEND_IDS)[number];
export const DEFAULT_LIGHTING_BACKEND: LightingBackendId = 'webgpu-page-raster';

/** Les trois déplacements du banc 15, repris tels quels : orbite, marche libre, jeu. */
export type LightingCameraMode = 'orbit' | 'free' | 'game';
export const DEFAULT_LIGHTING_CAMERA: LightingCameraMode = 'game';

export interface LightingFrameStats {
  fps: number | null;
  /** Somme des passes GPU de l'image, quel que soit le compteur que le backend publie. */
  gpuMs: number | null;
  lightsActive: number | null;
  shadowsUpdated: number | null;
  gpuLightListsMs: number | null;
  gpuShadowsMs: number | null;
  gpuLightingMs: number | null;
  /** Compteurs bruts publiés par le moteur pour cette image (CPU, draw calls, triangles, pages) :
   *  ils alimentent le panneau de métriques commun au banc 15, sans être recopiés ni recalculés ici. */
  frame: FrameMetrics | null;
  /** Pose de la caméra active, pour le bloc « Caméra active » du même panneau commun. */
  cameraPose: CameraPose | null;
  /** Profil par étape publié par le moteur (`explorer.stageProfile()`), lu à la même cadence que le
   *  reste. Ses colonnes processeur et carte graphique ne s'additionnent ni ne se comparent ; `null`
   *  y veut dire « non mesuré », jamais 0. Vaut `null` tant qu'aucune image n'a été relevée. */
  stageProfile: StageProfile | null;
}

/** Aucune image mesurée : tout est « Non mesuré », jamais 0. L'état initial du composant React et
 *  celui du runner sortent d'ici, pour qu'un compteur ajouté ne puisse pas manquer d'un côté. */
export function emptyLightingStats(): LightingFrameStats {
  return {
    fps: null, gpuMs: null, lightsActive: null, shadowsUpdated: null,
    gpuLightListsMs: null, gpuShadowsMs: null, gpuLightingMs: null, frame: null, cameraPose: null,
    stageProfile: null,
  };
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
  /** Déplacement demandé par l'utilisateur ; la couche React décide ce qu'elle sait construire. */
  mode: LightingCameraMode;
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
  /** Moteur demandé. Aucun repli silencieux : un moteur absent fait échouer le lancement avec son
   *  motif, à charge de l'utilisateur d'en choisir un autre dans le sélecteur. */
  backend?: LightingBackendId;
  camera?: LightingCameraMode;
  createControls?: (context: ControlsContext) => Promise<LightingControlsHandle>;
}

export interface LightingController {
  readonly backend: LightingBackendId;
  readonly camera: LightingCameraMode;
  getConfig(): LightingBenchConfig;
  getCapabilities(): EngineCapabilities;
  getStats(): LightingFrameStats;
  update(patch: Partial<LightingBenchConfig>): void;
  /** Reconstruit les commandes pour un autre déplacement, scène ouverte. Les anciennes ne sont
   *  libérées qu'une fois les nouvelles construites : un échec laisse la scène pilotable. */
  setCamera(mode: LightingCameraMode): Promise<LightingCameraMode>;
  dispose(): void;
}
