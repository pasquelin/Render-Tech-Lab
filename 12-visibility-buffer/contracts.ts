/**
 * 12-visibility-buffer/contracts.ts
 *
 * Contrats de type du banc de visibilité buffer (shading différé) : passe 1
 * (écriture compacte d'IDs + profondeur) puis passe 2 (shading des pixels
 * visibles uniquement) — Master Test Plan §7-12.
 *
 * CAHIER DES CHARGES : aucune implémentation.
 */

export interface VisibilityPassInput {
  /** Scene rendue (nb d'objets). */
  sceneObjectCount: number;
  /** Résolution du viewport (pixels). */
  viewportWidth: number;
  viewportHeight: number;
}

export interface VisibilityPassOutput {
  /** Passe 1 : buffer d'IDs compacté (32-bit: instanceId/primitiveId/depth). */
  primitiveIdBufferBytes?: number | null;
  materialIdBufferBytes?: number | null;
  depthBufferBytes?: number | null;
  /** Passe 2 : coût du shading différé. */
  shadingCostMs?: number | null;
  /** Overdraw de shading évité (comparé à forward). */
  overdrawAvoided?: number | null;
  /** Bande passante du G-buffer (forward) vs. du Visibility-buffer (deferred). */
  forwardBufferBytes?: number | null;
  deferredBufferBytes?: number | null;
  /** Coût de lookup des matériaux (ms) — si stratégie de batch différent. */
  materialLookupMs?: number | null;
}

export interface VisibilityVerdict {
  verdict: 'INTEGRATE' | 'REJECT' | 'WATCHLIST';
  reason?: string | null;
}

export interface VisibilityExecution {
  visibilityMs: number | null; shadingMs: number | null; forwardMs: number | null; materialLookupMs: number | null;
  expectedIds: Uint32Array; actualIds: Uint32Array; expectedDepth: Float32Array; actualDepth: Float32Array;
  shadedPixels: number; forwardFragments: number;
}
export interface VisibilityProgress {
  stage: 'warmup' | 'visibility' | 'shading' | 'complete'; completed: number; total: number; objectCount?: number;
}

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
