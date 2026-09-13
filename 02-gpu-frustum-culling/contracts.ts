/**
 * 02-gpu-frustum-culling/contracts.ts
 *
 * Contrats de type pour le banc de culling de frustum GPU (Compute Shader WGSL).
 * Conforme aux spécifications du Master Test Plan (§7-02).
 */

export interface FrustumPlane {
  normal: [number, number, number];
  offset: number;
}

export interface FrustumPlanes {
  left: FrustumPlane;
  right: FrustumPlane;
  bottom: FrustumPlane;
  top: FrustumPlane;
  near: FrustumPlane;
  far: FrustumPlane;
}

export interface CullingBoundingSphere {
  center: [number, number, number];
  radius: number;
}

export interface CullingInstance {
  id: number;
  boundingSphere: CullingBoundingSphere;
  modelMatrix?: Float32Array | number[];
}

export interface CullingBatchResult {
  totalInstances: number;
  visibleCount: number;
  culledCount: number;
  cullRate: number;
  visibleIndices: number[];
  cpuTimeMs?: number | null;
  gpuTimeMs?: number | null;
}

export interface CullingBenchmarkRow {
  instanceCount: number;
  cpuCullMs: number;
  gpuComputeMs: number;
  visibleCount: number;
  culledCount: number;
  speedup: number;
}

export type { LabCampaign, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
export const archiveContract = { endpoint: '/api/save-report', report: 'results/REPORT.md', latest: 'results/latest.json', retention: 2 } as const;
