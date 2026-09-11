import type { BenchResultRecord } from '../shared/benchmark/types.ts';
export type WorldMode = 'brute' | 'frustum' | 'hierarchy' | 'shadow-cache' | 'static-cache' | 'adaptive-frustum' | 'adaptive-coherent';
export interface WorldOptions {
  /** Physical pixels. The shared viewport controls CSS size; renderer logical size is width/pixelRatio × height/pixelRatio. */
  width: number; height: number; pixelRatio: number;
  districts: 1 | 9 | 25; samples: number; warmup: number; shadows: boolean;
  candidate: Exclude<WorldMode, 'brute'>; previewMode?: WorldMode;
  order?: 'ABBA' | 'BAAB';
  fov?: number; antialias?: boolean; shadowMapSize?: 1024 | 2048 | 4096;
  path?: 'mixed' | 'panorama' | 'perimeter';
  wireframe?: boolean; showBounds?: boolean; previewDurationSeconds?: number;
}
export interface WorldFrame {
  index: number; timestamp: string; rafTimestampMs: number; rafDeltaMs: number | null;
  cpuCullMs: number; cpuRenderSubmitMs: number; cpuFrameWorkMs: number; gpuMs: number | null;
  mainPassTriangles: number; shadowPassTriangles: number; mainPassDrawCalls: number; shadowPassDrawCalls: number;
  triangles: number; lines: number; mainPassLines: number; shadowPassLines: number;
  drawCalls: number; activeDistricts: number;
  shadowMapReused?: boolean;
  adaptivePlaneTests?: number | null;
  adaptiveRejectedMeshes?: number | null;
  adaptiveCertifiedMeshes?: number | null;
}
export type WorldPreviewMetrics = Pick<WorldFrame, 'cpuFrameWorkMs' | 'rafDeltaMs' | 'triangles' | 'drawCalls' |
  'mainPassTriangles' | 'shadowPassTriangles' | 'mainPassDrawCalls' | 'shadowPassDrawCalls' | 'activeDistricts' |
  'lines' | 'mainPassLines' | 'shadowPassLines'> & { sourceTriangles: number; sourceMeshes: number;
    cpuCullMs?: number; cpuRenderSubmitMs?: number; gpuMs?: number | null; gpuTimerAvailable?: boolean;
    variant?: WorldMode; phase?: 'warmup' | 'measure' | 'preview' };
export interface WorldSummary { p50: number | null; p95: number | null; p99: number | null; mean: number | null; validSamples: number }
export interface WorldBlock { variant: WorldMode; startedAt: string; samples: WorldFrame[]; summary: Record<string, WorldSummary> }
export interface WorldCapture {
  index: number; baselineHash: string; repeatHash: string; candidateHash: string;
  repeatDifferentBytes: number; candidateDifferentBytes: number; maxChannelDifference: number;
  candidateShadowPassTriangles?: number; cachedShadowChecked?: boolean;
}
export interface WorldReport {
  timestamp: string; config: WorldOptions; environment: Record<string, unknown>; scene: Record<string, unknown>;
  quality: { passed: boolean; captures: WorldCapture[]; failure?: string; checkedFrames: number[] };
  blocks: WorldBlock[]; records: BenchResultRecord[]; limitations: string[];
  preparationMs: number; qualityMs: number;
}
