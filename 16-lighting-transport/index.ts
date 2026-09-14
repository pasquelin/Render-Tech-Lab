export { manifest } from './manifest.ts';
export { LIGHTING_PROTOCOL, LIGHTING_LIGHT_CONTROLS } from './contracts.ts';
export type * from './contracts.ts';
export { LIGHTING_MODULE, LIGHTING_UI } from './implementation/presentation.ts';
export { formatLightingReport } from './implementation/report.ts';
export { scenarios, scenarioIds } from './scenarios/index.ts';
import type { LightingBenchOptions, LightingController, LightingReport } from './contracts.ts';

/** Importing the public metadata does not load the SDK renderer or create a canvas. */
export async function createLightingBench(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingController> {
  const runner = await import('./runner/index.ts');
  return runner.createLightingBench(canvas, options);
}

export async function runLightingComparison(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingReport> {
  const runner = await import('./runner/index.ts');
  return runner.runLightingComparison(canvas, options);
}
