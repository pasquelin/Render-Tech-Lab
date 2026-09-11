import * as THREE from 'three';

export interface BoundingSphere {
  center: THREE.Vector3;
  radius: number;
}

export interface MeshInstanceDef {
  id: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  boundingSphere: BoundingSphere;
  color: THREE.Color;
}

export interface DrawIndexedIndirectCommand {
  indexCount: number;
  instanceCount: number;
  firstIndex: number;
  baseVertex: number;
  firstInstance: number;
}

export interface BenchmarkTier {
  objectCount: number;
  label: string;
}

export interface FrameMeasurement {
  frameIndex: number;
  cpuFrameMs: number;
  submitMs: number;
  fps: number | null;
  drawCalls: number;
  triangles: number;
  visibleCountEstimated?: number;
}

export interface BenchmarkResult {
  mode: 'classic' | 'gpu-driven';
  objectCount: number;
  samplesCount: number;
  avgCpuFrameMs: number;
  avgSubmitMs: number;
  p95SubmitMs: number;
  p99SubmitMs: number;
  avgFps: number | null;
  gpuFrameMs?: number | null;
  queueCompletionMs?: number | null;
  drawCalls: number;
}

export interface CrossoverReport {
  timestamp: string;
  tiers: number[];
  classicResults: BenchmarkResult[];
  gpuDrivenResults: BenchmarkResult[];
  crossoverObjectCount: number | null;
  analysis: string;
}
