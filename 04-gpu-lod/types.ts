/**
 * 04-gpu-lod/types.ts
 *
 * Types et interfaces normalisées pour le banc 04-gpu-lod.
 * Décomposition tripartite :
 * - 04A : Génération hors thread UI via worker meshoptimizer (Transferable)
 * - 04B : Sélection Screen-Space Error sur CPU
 * - 04C : Sélection Screen-Space Error sur GPU (Compute WGSL)
 */

/** Paliers d'objets balayés par la campagne 04B/04C — source unique. */
export const LOD_OBJECT_COUNTS = [1000, 2000, 5000, 10000, 50000] as const;

export interface LodGenerationRequest {
  geometryId: number;
  positions: Float32Array;
  indices: Uint32Array;
  /** Paliers cibles : ex [0.5, 0.25] pour LOD1 et LOD2 */
  ratios: number[];
  targetErrors?: number[];
}

export interface LodLevelData {
  tier: number; // 0, 1, 2
  ratio: number; // 1.0, 0.5, 0.25
  indices: Uint32Array;
  indexCount: number;
  simplificationError: number;
}

export interface LodGenerationResult {
  geometryId: number;
  originalTriangles: number;
  lods: LodLevelData[];
  durationMs: number;
}

export interface LodBenchmarkSummary {
  generation: {
    originalTriangles: number;
    lod1Triangles: number;
    lod2Triangles: number;
    durationMs: number;
    memorySavedPercent: number;
  };
  cpuSelection: {
    objectCounts: number[];
    latenciesMs: number[];
  };
  /**
   * 04C — Sélection Screen-Space Error sur GPU.
   * `computeTimesMs` vaut `null` tant que le compute shader WGSL
   * (`gpuLodShader.ts`) n'est pas réellement dispatché : une estimation
   * analytique ne doit pas pouvoir être publiée comme une mesure.
   */
  gpuSelection: {
    objectCounts: number[];
    computeTimesMs: number[] | null;
  };
  contractualErrorCheck: {
    maxObservedErrorPx: number;
    thresholdPx: number;
    passed: boolean;
  };
}
