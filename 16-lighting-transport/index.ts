export { manifest } from './manifest.ts';
export { LIGHTING_PROTOCOL, LIGHTING_LIGHT_CONTROLS, LIGHTING_DELAY_PROTOCOL, LIGHTING_DELAY_EVENTS, LIGHTING_DELAY_MS } from './contracts.ts';
export type * from './contracts.ts';
export { LIGHTING_MODULE, LIGHTING_UI } from './implementation/presentation.ts';
export { formatLightingReport } from './implementation/report.ts';
export { formatLightingDelayReport } from './implementation/delayReport.ts';
export { scenarios, scenarioIds } from './scenarios/index.ts';
import type { LightingBenchOptions, LightingController, LightingReport, LightingDelayReport } from './contracts.ts';

/** Importing the public metadata does not load the SDK renderer or create a canvas. */
export async function createLightingBench(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingController> {
  const runner = await import('./runner/index.ts');
  return runner.createLightingBench(canvas, options);
}

export async function runLightingComparison(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingReport> {
  const runner = await import('./runner/index.ts');
  return runner.runLightingComparison(canvas, options);
}

/** Kept out of ./runner/index.ts on purpose: its own dynamic import path so the shell's canonical
 *  entry does not multiply — the delay scenario is a separate, independently lazy-loaded module. */
export async function runLightingDelayScenario(canvas: HTMLCanvasElement, options: LightingBenchOptions = {}): Promise<LightingDelayReport> {
  const runner = await import('./runner/delayScenario.ts');
  return runner.runLightingDelayScenario(canvas, options);
}
