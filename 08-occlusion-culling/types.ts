/**
 * 08-occlusion-culling/types.ts
 *
 * Contrats de type du banc d'occlusion à partir du Hi-Z (banc 07) et du
 * culling (banc 06). La mesure est axée sur l'équation de gain net
 * (Master Test Plan §7-08).
 *
 * CAHIER DES CHARGES : aucune implémentation.
 */

import type { HiZPyramid } from '../07-hiz/types.ts';
import type { Meshlet } from '../05-meshlets/types.ts';

export interface OcclusionInput {
  meshlets: Meshlet[];
  hiZ: HiZPyramid;
  /** Seuil de confiance (0..1) pour déclarer un meshlet comme occlus. */
  threshold: number;
  /** Position du centre de la pyramide Hi-Z (frustum). */
  screenExtent: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcclusionResult {
  /** Meshlets visibles. */
  visibleMeshlets: Meshlet[];
  /** Meshlets rejetés (occlusion). */
  occludedMeshlets: Meshlet[];
  /** Nombre de triangles rejetés (somme triangleCount des occlus). */
  trianglesRejected: number;
  /** Nombre total (référentiel). */
  totalMeshlets: number;
  /** Taux de rejet dû à l'occlusion (0..1). */
  occlusionRejectRate: number;
}

export interface OcclusionGainEquation {
  /** Coût du baselines (mesuré par 00-baseline). */
  baselineCost?: number | null;
  /** Coût de génération de la pyramide Hi-Z (mesuré par 07). */
  hiZGenerationCost?: number | null;
  /** Coût du culling Hi-Z (mesuré par 08). */
  cullingCost?: number | null;
  /** Coût de rasterisation résiduelle. */
  rasterCost?: number | null;
  /** Gain net = baselineCost - (hiZGeneration + culling + raster). */
  gainNet?: number | null;
}
