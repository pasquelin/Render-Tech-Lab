/**
 * 13-full-gpu-driven/contracts.ts
 *
 * Contrats du pipeline GPU-driven unifié (assemblage des bancs 03 → 12).
 * Ce banc reste `not-run` jusqu’à ce que chaque banc intermédiaire soit validé
 * (Master Test Plan §7-13).
 *
 * CAHIER DES CHARGES : aucune implémentation. La seule structure fixée est la
 * liste ordonnée des stages et les métriques consolidées attendues.
 */

export type PipelineStage =
  | 'gpu-scene'
  | 'frustum'
  | 'lod'
  | 'meshlets'
  | 'meshlet-culling'
  | 'hiz'
  | 'occlusion'
  | 'compaction'
  | 'indirect-draw'
  | 'shading';

export interface PipelineStageResult {
  stage: PipelineStage;
  /** Durée du stage (ms) — `null` si non mesuré. */
  durationMs?: number | null;
  /** Entrées (nb d'objets/meshlets/…) avant le stage. */
  inputCount?: number | null;
  /** Sorties (nb d'objets/meshlets/…) après le stage. */
  outputCount?: number | null;
  /** Verdict individuel du stage (renvoyé par le banc source). */
  verdict?: 'INTEGRATE' | 'REJECT' | 'WATCHLIST' | 'not-yet-decided';
}

export interface FullPipelineReport {
  status: 'ready' | 'blocked';
  blockers: PipelineBlocker[];
  /** Liste ordonnée des stages effectifs. */
  stages: PipelineStageResult[];
  /** Comparaison consolidée vs. 00-baseline. */
  baselineReference?: {
    test: '00-baseline';
    submitMs?: number | null;
    cpuFrameMs?: number | null;
  } | null;
  /** Gain net global (ms). `null` si non mesuré. */
  totalGainMs?: number | null;
  /** Verdict global. */
  verdict?: 'INTEGRATE' | 'REJECT' | 'WATCHLIST' | 'not-yet-decided';
}

export type BenchId = '01-indirect-draw' | '02-gpu-frustum-culling' | '03-gpu-scene' | '04-gpu-lod' |
  '05-meshlets' | '06-meshlet-culling' | '07-hiz' | '08-occlusion-culling' | '09-gpu-compaction' |
  '10-material-batching' | '11-geometry-streaming' | '12-visibility-buffer';
export interface PipelineDependency { test: BenchId; status: 'measured' | 'not-run'; verdict: 'INTEGRATE' | 'REJECT' | 'WATCHLIST' | 'not-yet-decided' }
export interface PipelineBlocker { test: BenchId; reason: 'not-measured' | 'not-decided' | 'rejected' }

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
