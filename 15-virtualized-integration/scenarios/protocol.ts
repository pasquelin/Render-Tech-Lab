import { nextFrame } from '../../shared/benchmark/frame.ts';

/** A physical control is not evidence that the virtualized architecture exists. */
export const TEST_ID = '15-virtualized-integration' as const;
export const SCENARIOS = [
  ['dense-urban', 'Extérieur urbain dense', 'Real asset, certified replacement hierarchy and cluster raster'],
  ['interior', 'Intérieur avec occlusion', 'Current-frame GPU Hi-Z connected to cluster raster'],
  ['transition', 'Transition intérieur/extérieur', 'Complete hierarchy cut and current-frame occlusion'],
  ['fast-camera', 'Caméra rapide', 'Hierarchy selection with bounded page feedback'],
  ['near-far', 'Gros plan vers vue lointaine', 'Certified geometric error, projected error and replacement groups'],
  ['dynamic', 'Objets dynamiques', 'Versioned transform updates and conservative cluster bounds'],
  ['vegetation', 'Végétation/transparence', 'Alpha coverage and transparent fallback with identical materials'],
  ['streaming', 'Pression mémoire/streaming', 'Physical page loader, GPU residency publication and safe eviction'],
  ['visibility-jump', 'Changements brutaux de visibilité', 'Complete fallback and invalidated occlusion history'],
  ['low-budget', 'Budgets CPU/GPU/mémoire réduits', 'Physical memory instrumentation and identified low-end hardware'],
] as const;

export function blockedScenarios() {
  return SCENARIOS.map(([id, label, missing]) => ({ id, label, status: 'not-run' as const,
    reason: missing, conclusion: 'blocked: no assembled virtualized renderer',
    metrics: { cpuFrameMs: null, submitMs: null, gpuMs: null, fps: null, ramBytes: null, vramBytes: null,
      visibleClusters: null, submittedClusters: null, cacheHits: null, cacheMisses: null, bytesRead: null, imageError: null } }));
}

export interface ControlConfig {
  count: number; seed: number; width: number; height: number; samples: number; warmup: number; timeoutMs: number;
}
export function configuration(input: Partial<ControlConfig> = {}): ControlConfig {
  const c = { count: 256, seed: 42, width: 640, height: 360, samples: 8, warmup: 2, timeoutMs: 60_000, ...input };
  for (const [key, lo, hi] of [
    ['count', 1, 4096], ['seed', 1, 2147483646], ['width', 64, 960], ['height', 64, 540],
    ['samples', 2, 32], ['warmup', 0, 16], ['timeoutMs', 100, 120_000],
  ] as const) if (!Number.isSafeInteger(c[key]) || c[key] < lo || c[key] > hi) throw new RangeError(`Invalid ${key}: ${c[key]}`);
  return c;
}

export function pose(frame: number, samples: number): [number, number, number] {
  const t = frame / Math.max(1, samples - 1), angle = t * Math.PI * 1.5;
  const radius = 230 - 160 * Math.sin(t * Math.PI);
  return [Math.cos(angle) * radius, 35 + t * 30, Math.sin(angle) * radius];
}

export function summarize(values: readonly number[]) {
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0)) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return { mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1)! };
}
export function cadence(intervals: readonly number[]) {
  const stats = summarize(intervals);
  return { intervalsMs: [...intervals], frameMs: stats,
    fps: stats && stats.mean > 0 ? 1000 / stats.mean : null,
    stuttersOver50Ms: stats ? intervals.filter(v => v > 50).length : null };
}
export function compareImages(a: Uint8Array, b: Uint8Array) {
  if (!a.length || a.length !== b.length || a.length % 4) throw new Error('Invalid RGBA images');
  let differentPixels = 0, maxChannelError = 0, squared = 0;
  for (let i = 0; i < a.length; i += 4) {
    let different = false;
    for (let c = 0; c < 4; c++) { const delta = Math.abs(a[i + c] - b[i + c]);
      squared += delta * delta; maxChannelError = Math.max(maxChannelError, delta); different ||= delta !== 0; }
    if (different) differentPixels++;
  }
  return { differentPixels, maxChannelError, rmse: Math.sqrt(squared / a.length) };
}

/** The pending operation must support abort through its owner (RAF, readback, etc.). */
export function active(signal: AbortSignal): void { signal.throwIfAborted(); }
export { nextFrame };
export async function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  active(signal);
  let abort: () => void = () => {};
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
  })]); } finally { signal.removeEventListener('abort', abort); }
}
