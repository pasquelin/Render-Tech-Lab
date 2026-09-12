import type { BenchResultRecord } from '../../shared/benchmark/types.ts';

export interface ComparisonOptions {
  count: number;
  /** Physical drawing-buffer pixels, independent of pixelRatio. */
  width: number;
  height: number;
  /** CSS size is physical size divided by pixelRatio. */
  pixelRatio: number;
  seed: number;
  samples: number;
  warmup: number;
  shadows: boolean;
  candidate?: 'prepared' | 'guarded';
}
export type ComparisonVariant = 'reference' | 'prepared' | 'guarded';
export interface MetricSummary {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  validSamples: number;
}
export interface ComparisonFrame {
  index: number;
  rafTimestamp: number;
  rafDeltaMs: number | null;
  cpuSelectMs: number;
  cpuApplyMs: number;
  cpuRenderSubmitMs: number;
  cpuFrameWorkMs: number;
  cpuQueryPollMs: number;
  gpuMs: number | null;
  gpuStatus: string;
  lodCounts: [number, number, number];
  drawCalls: number;
  triangles: number;
  mainPassTriangles: number;
  shadowPassTriangles: number;
  mainPassDrawCalls: number;
  shadowPassDrawCalls: number;
  consumedInstances: number;
  uploadBytesRequested: number;
  bufferSubDataBytes: number;
  bufferDataBytes: number;
  selectionHash: string;
}
export interface ComparisonBlock {
  variant: ComparisonVariant;
  startedAt: string;
  measuredUntil: string;
  completedAt: string;
  samples: ComparisonFrame[];
  summary: Record<string, MetricSummary>;
}
export interface QualityCapture {
  frameIndex: number;
  variant: ComparisonVariant;
  width: number;
  height: number;
  differentPixels: number;
  maxChannelError: number;
  referenceHash: string;
  candidateHash: string;
}
export interface TrajectoryControl {
  frameIndex: number;
  referenceHash: string;
  lodCounts: [number, number, number];
  frustumIntersectingInstances: number;
}
export interface SceneComparisonResult {
  timestamp: string;
  config: ComparisonOptions;
  environment: Record<string, unknown>;
  scene: Record<string, unknown>;
  preparation: Record<string, number>;
  quality: {
    passed: boolean;
    captures: QualityCapture[];
    trajectory: TrajectoryControl[];
    measuredFrameIdsMatch: boolean;
    correspondingDrawCountsMatch: boolean;
    failure?: string;
  };
  blocks: ComparisonBlock[];
  records: BenchResultRecord[];
  limitations: string[];
}
