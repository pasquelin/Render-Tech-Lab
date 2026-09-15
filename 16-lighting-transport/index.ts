export { manifest } from './manifest.ts';
export {
  SCENES, MAX_ENGINE_LIGHTS, MAX_SHADOWED_LIGHTS_PER_FRAME, ADJUSTABLE_LIGHT_IDS, SCENE_LIGHT_BOUNDS,
  SCENE_LIGHT_LIMITS, LIGHTING_BACKEND_IDS, DEFAULT_LIGHTING_BACKEND, DEFAULT_LIGHTING_CAMERA,
  AUTO_LIGHT_MIN, AUTO_LIGHT_MAX, CAPABILITY_LABELS, defaultAdjustableLights, defaultConfig, emptyLightingStats,
} from './contracts.ts';
export type * from './contracts.ts';
export { LIGHTING_MODULE, LIGHTING_UI } from './implementation/presentation.ts';
export { scenarios, scenarioIds } from './scenarios/index.ts';
import type { LightingBenchOptions, LightingController, SceneId } from './contracts.ts';

/** Importing the public metadata does not load the SDK renderer or create a canvas. */
export async function createLightingBench(
  canvas: HTMLCanvasElement, scene: SceneId, options: LightingBenchOptions = {},
): Promise<LightingController> {
  const runner = await import('./runner/index.ts');
  return runner.createLightingBench(canvas, scene, options);
}
