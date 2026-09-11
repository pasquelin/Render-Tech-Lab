/**
 * 08-occlusion-culling/implementation/occlusionCuller.ts
 *
 * Implémentation du culling d'occlusion Hi-Z et de l'équation contractuelle de gain net.
 * Réutilise les types et fonctions de 05-meshlets et 07-hiz.
 */

import type { Meshlet } from '../../05-meshlets/types.ts';
import type {
  OcclusionResult,
  OcclusionGainEquation,
} from '../types.ts';
import {
  queryHiZ,
  type HiZPyramidData,
} from '../../07-hiz/implementation/hizPyramid.ts';

export interface ScreenMeshlet {
  meshlet: Meshlet;
  screenBox: { x0: number; y0: number; x1: number; y1: number };
  depth: number;
}

/**
 * Filtre les meshlets par occlusion en interrogeant la pyramide Hi-Z.
 */
export function cullMeshletsByOcclusion(
  screenMeshlets: ScreenMeshlet[],
  hiZData: HiZPyramidData,
  reversedZ: boolean = false
): OcclusionResult {
  const visibleMeshlets: Meshlet[] = [];
  const occludedMeshlets: Meshlet[] = [];
  let trianglesRejected = 0;

  for (const item of screenMeshlets) {
    const res = queryHiZ(hiZData, item.screenBox, item.depth, reversedZ);
    if (res.occluded) {
      occludedMeshlets.push(item.meshlet);
      trianglesRejected += item.meshlet.triangleCount;
    } else {
      visibleMeshlets.push(item.meshlet);
    }
  }

  const total = screenMeshlets.length;
  const occlusionRejectRate = total > 0 ? occludedMeshlets.length / total : 0;

  return {
    visibleMeshlets,
    occludedMeshlets,
    trianglesRejected,
    totalMeshlets: total,
    occlusionRejectRate,
  };
}

/**
 * Évalue l'équation contractuelle de gain net :
 * Gain_net = BaselineCost - (HiZGenerationCost + CullingCost + RasterCostRésiduel)
 */
export function evaluateOcclusionGain(params: {
  totalTriangles: number;
  occlusionRate: number; // 0..1
  rasterCostPerKTriMs?: number; // Défaut: 0.005 ms par millier de triangles
  baselineSubmitMs?: number;    // Défaut: 3.35 ms (banc 00-baseline S3)
  hiZGenerationMs?: number;     // Défaut: 0.15 ms (génération GPU 1024x1024)
  cullingMs?: number;           // Défaut: 0.08 ms (compute dispatch)
}): OcclusionGainEquation {
  const {
    totalTriangles,
    occlusionRate,
    rasterCostPerKTriMs = 0.005,
    baselineSubmitMs = 3.35,
    hiZGenerationMs = 0.15,
    cullingMs = 0.08,
  } = params;

  // Triangles rasterisés après occlusion
  const visibleTriangles = totalTriangles * (1.0 - occlusionRate);
  const rasterCost = (visibleTriangles / 1000) * rasterCostPerKTriMs;

  // Baseline cost : soumission CPU + raster complet de tous les triangles
  const baselineRasterCost = (totalTriangles / 1000) * rasterCostPerKTriMs;
  const baselineCost = baselineSubmitMs + baselineRasterCost;

  // Prototype GPU-driven avec Hi-Z : soumission quasi nulle (0.15 ms) + HiZ + culling + raster réduit
  const totalPrototypeCost = hiZGenerationMs + cullingMs + rasterCost + 0.15;
  const gainNet = baselineCost - totalPrototypeCost;

  return {
    baselineCost: Number(baselineCost.toFixed(3)),
    hiZGenerationCost: Number(hiZGenerationMs.toFixed(3)),
    cullingCost: Number(cullingMs.toFixed(3)),
    rasterCost: Number(rasterCost.toFixed(3)),
    gainNet: Number(gainNet.toFixed(3)),
  };
}
