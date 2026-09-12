export const INTEGRATED_RUNNER_IDS = [
  '02-gpu-frustum-culling', '05-meshlets', '06-meshlet-culling', '07-hiz',
  '08-occlusion-culling', '09-gpu-compaction', '10-material-batching',
  '11-geometry-streaming', '12-visibility-buffer', '15-virtualized-integration',
] as const;

export type IntegratedRunnerId = typeof INTEGRATED_RUNNER_IDS[number];
export type IntegratedPhase = 'prepare' | 'warmup' | 'measure' | 'verify' | 'complete';

export interface IntegratedRunnerEvent {
  test: IntegratedRunnerId;
  phase: IntegratedPhase;
  variant?: string;
  completed: number;
  total: number;
  message: string;
}

export interface IntegratedMetric {
  test: IntegratedRunnerId;
  variant: string;
  cpuMs: number | null;
  gpuMs: number | null;
  custom: Record<string, number | string | boolean | null>;
}

export interface IntegratedRunResult {
  test: IntegratedRunnerId;
  status: 'measured' | 'not-run';
  reason: string | null;
  records: IntegratedMetric[];
  gates: { correctness: boolean | null; detail: string };
}

export interface IntegratedRunOptions {
  canvas?: HTMLCanvasElement;
  device?: GPUDevice | null;
  samples?: number;
  warmup?: number;
  signal?: AbortSignal;
  onPhase?: (event: IntegratedRunnerEvent) => void;
  onProgress?: (event: IntegratedRunnerEvent) => void;
  onMetrics?: (metric: IntegratedMetric) => void;
  scenario?: string;
}

export interface IntegratedBenchRunner {
  readonly id: IntegratedRunnerId;
  readonly variants: readonly string[];
  run(options?: IntegratedRunOptions): Promise<IntegratedRunResult>;
}

