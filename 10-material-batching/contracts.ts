/**
 * 10-material-batching/contracts.ts
 *
 * Contrats de type du banc de batching de matériaux : 4 stratégies à comparer
 * sans préjuger (Master Test Plan §7-10).
 *
 * CAHIER DES CHARGES : aucune implémentation.
 */

export type MaterialBatchingStrategy =
  | 'state-switch'      // A : bascule de pipeline / matériaux classique
  | 'storage-buffer'    // B : tampon de stockage de matériaux
  | 'texture-array'     // C : tableaux de textures
  | 'pseudo-bindless';  // D : atlas / indexing dynamique

export interface MaterialDef {
  id: number;
  albedo: [number, number, number];
  roughness: number;
  metallic: number;
  opacity: number;
  textureId: number | null;
}

export interface BatchingInput {
  objects: number;
  materialCount: number;
  strategy: MaterialBatchingStrategy;
}

export interface BatchingOutput {
  strategy: MaterialBatchingStrategy;
  objectCount: number;
  materialCount: number;
  /** Nombre de switches d'état de pipeline (proxy de surcharge CPU). */
  pipelineStateChanges?: number | null;
  /** Nombre de changements de bind group (proxy de surcharge CPU). */
  bindGroupChanges?: number | null;
  /** Temps CPU par frame. */
  cpuFrameMs?: number | null;
  /** Temps GPU par frame. */
  gpuFrameMs?: number | null;
  /** Mémoire consommée par la table de matériaux. */
  materialTableBytes?: number | null;
}

export interface MaterialBatch { materialId: number; firstDraw: number; drawCount: number; }
export interface MaterialSubmissionPlan {
  strategy: MaterialBatchingStrategy; drawCount: number; drawMaterialIds: number[];
  batches: MaterialBatch[]; pipelineStateChanges: number; bindGroupChanges: number;
}
export interface MaterialMeasurement {
  cpuFrameMs: number | null; gpuFrameMs: number | null; submittedDraws: number;
  /** Empreinte d'une lecture de sortie réelle, identique pour un shading identique. */
  correctnessDigest: string;
}
export interface MaterialCampaignRecord extends BatchingOutput { validSamples: number; submittedDraws: number; }
export interface MaterialCampaignProgress {
  stage: 'warmup' | 'measure' | 'complete'; completed: number; total: number;
  strategy?: MaterialBatchingStrategy; materialCount?: number;
}

export type { LabCampaign, LabManifest, LabMetric, LabRunnerOptions } from '../shared/contracts/index.ts';
