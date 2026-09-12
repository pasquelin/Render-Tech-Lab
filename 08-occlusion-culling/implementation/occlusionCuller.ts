/**
 * 08-occlusion-culling/implementation/occlusionCuller.ts
 *
 * Implémentation du culling d'occlusion Hi-Z et de l'équation contractuelle de gain net.
 * Réutilise les types et fonctions de 05-meshlets et 07-hiz.
 */

import type { Meshlet } from '../../05-meshlets/index.ts';
import type {
  OcclusionResult,
  OcclusionGainEquation,
} from '../contracts.ts';
import {
  queryHiZ,
  type HiZPyramidData,
} from '../../07-hiz/index.ts';

export interface ScreenMeshlet {
  meshlet: Meshlet;
  screenBox: { x0: number; y0: number; x1: number; y1: number };
  depth: number;
  /** Confiance de la projection/borne écran, entre 0 et 1. */
  confidence?: number;
}

/**
 * Filtre les meshlets par occlusion en interrogeant la pyramide Hi-Z.
 */
export function cullMeshletsByOcclusion(
  screenMeshlets: ScreenMeshlet[],
  hiZData: HiZPyramidData,
  reversedZ: boolean = false,
  threshold: number = 1
): OcclusionResult {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Seuil de confiance invalide');
  const visibleMeshlets: Meshlet[] = [];
  const occludedMeshlets: Meshlet[] = [];
  let trianglesRejected = 0;

  for (const item of screenMeshlets) {
    const res = queryHiZ(hiZData, item.screenBox, item.depth, reversedZ);
    const confidence = item.confidence ?? 1;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Confiance invalide');
    if (res.occluded && confidence >= threshold) {
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
  rasterCostPerKTriMs: number | null;
  baselineSubmitMs: number | null;
  hiZGenerationMs: number | null;
  cullingMs: number | null;
}): OcclusionGainEquation {
  const {
    totalTriangles,
    occlusionRate,
    rasterCostPerKTriMs,
    baselineSubmitMs,
    hiZGenerationMs,
    cullingMs,
  } = params;

  if (!Number.isFinite(totalTriangles) || totalTriangles < 0 || !Number.isFinite(occlusionRate) || occlusionRate < 0 || occlusionRate > 1) {
    throw new Error('Entrées géométriques invalides');
  }
  const measured = [rasterCostPerKTriMs, baselineSubmitMs, hiZGenerationMs, cullingMs];
  if (measured.some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error('Coût mesuré invalide');
  if (rasterCostPerKTriMs === null || baselineSubmitMs === null || hiZGenerationMs === null || cullingMs === null) {
    return { baselineCost: null, hiZGenerationCost: hiZGenerationMs, cullingCost: cullingMs, rasterCost: null, gainNet: null };
  }

  // Triangles rasterisés après occlusion
  const visibleTriangles = totalTriangles * (1.0 - occlusionRate);
  const rasterCost = (visibleTriangles / 1000) * rasterCostPerKTriMs;

  // Baseline cost : soumission CPU + raster complet de tous les triangles
  const baselineRasterCost = (totalTriangles / 1000) * rasterCostPerKTriMs;
  const baselineCost = baselineSubmitMs + baselineRasterCost;

  const totalPrototypeCost = hiZGenerationMs + cullingMs + rasterCost;
  const gainNet = baselineCost - totalPrototypeCost;

  return {
    baselineCost: Number(baselineCost.toFixed(3)),
    hiZGenerationCost: Number(hiZGenerationMs.toFixed(3)),
    cullingCost: Number(cullingMs.toFixed(3)),
    rasterCost: Number(rasterCost.toFixed(3)),
    gainNet: Number(gainNet.toFixed(3)),
  };
}
