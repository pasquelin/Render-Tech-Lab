/**
 * 11-geometry-streaming/contracts.ts
 *
 * Contrats de type du banc de streaming de géométrie : cycle de vie de
 * résidence VRAM, métriques de pression mémoire (Master Test Plan §7-11).
 *
 * CAHIER DES CHARGES : aucune implémentation.
 */

export type ResidentState =
  | 'cold'
  | 'loading'
  | 'partially-resident'
  | 'fully-resident'
  | 'eviction'
  | 're-request';

export interface StreamingConfig {
  /** Pourcentage de géométrie demandée dans la scène (10/25/50/100). */
  requestedFraction: number;
  /** Budget VRAM alloué (octets). */
  vramBudgetBytes: number;
}

export interface StreamingFrameMetrics {
  /** Mémoire résidente (octets). `null` si non mesuré. */
  residentBytes?: number | null;
  /** Volume chargé cette trame (octets). `null` si non mesuré. */
  uploadedBytes?: number | null;
  /** Volume évincé cette trame (octets). `null` si non mesuré. */
  evictedBytes?: number | null;
  /** Temps de upload (ms). `null` si non mesuré. */
  uploadTimeMs?: number | null;
  /** Temps de frame (ms). `null` si non mesuré. */
  frameTimeMs?: number | null;
  /** Nombre de stalls (frames bloquées sur l'upload). `null` si non mesuré. */
  stalls?: number | null;
}

export interface StreamingLifecycle {
  state: ResidentState;
  metrics: StreamingFrameMetrics;
}

export interface GeometryPageDefinition { id: number; sizeBytes: number; fallbackPageId: number | null; pinned: boolean; }
export interface StreamingProgress {
  stage: 'request' | 'upload' | 'resolve' | 'complete'; frame: number; completed: number; total: number;
}

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
