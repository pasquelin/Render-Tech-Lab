/**
 * 10-material-batching/types.ts
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
