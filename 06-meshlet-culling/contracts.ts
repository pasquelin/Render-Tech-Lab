/**
 * 06-meshlet-culling/contracts.ts
 *
 * Contrats de type du banc de culling de meshlets : résultats de culling par
 * test (frustum, cône de normale, sub-pixel), métriques de rejet séparées et
 * consolidées (Master Test Plan §7-06).
 *
 * L'oracle CPU et le shader de référence sont livrés dans implementation/.
 */

import type { Meshlet } from '../05-meshlets/index.ts';

export interface CullingInput {
  meshlets: Meshlet[];
  /** Six plans du frustum (n, d) : point.n · point + d > 0 → visible. */
  frustumPlanes: { n: [number, number, number]; d: number }[];
  /** Position de la vue (world). */
  viewPosition: [number, number, number];
  /** Seuil de taille projetée sous-pixel (pixels). */
  subPixelThreshold: number;
  /** Contexte SSE (hauteur écran, FOV) — pour le test sub-pixel. */
  screenHeight: number;
  fovRad: number;
}

export interface CullingOutput {
  /** Meshlets retenus après les 3 tests. */
  visible: Meshlet[];
  /** Raisons de rejet par meshlet (0 = visible). */
  rejectReasons: RejectFlag[];
  /** Comptage par test, décomposé. */
  rejectCounts: {
    frustum: number;
    backface: number;
    subpixel: number;
    total: number;
  };
  /** Taux de rejet global (0..1). */
  globalRejectRate: number;
}

export type RejectFlag = 0 | 1 | 2 | 3 | 7; // 0=visible, 1=frustum, 2=backface, 3=subpixel, 7=les trois

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
