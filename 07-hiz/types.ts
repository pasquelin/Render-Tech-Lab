/**
 * 07-hiz/types.ts
 *
 * Contrats de type du banc Hi-Z : pyramide de profondeur, coût de génération,
 * et accès aux mips pour le culling d'occlusion (Master Test Plan §7-07).
 *
 * CAHIER DES CHARGES : aucune implémentation. Les types servent de contrat.
 */

export interface HiZMip {
  /** Niveau du mip (0 = base, pleine résolution). */
  level: number;
  /** Largeur du mip. */
  width: number;
  /** Hauteur du mip. */
  height: number;
  /** Format WebGPU (ex : r32float, r16float). */
  format: GPUTextureFormat;
}

export interface HiZPyramid {
  /** Mip 0 (pleine résolution) jusqu'au mip le plus petit. */
  mips: HiZMip[];
  /** Taille de la pyramide en mips. */
  depth: number;
}

export interface HiZCost {
  /** Temps de génération de toute la pyramide (ms). */
  generationMs?: number | null;
  /** Temps par mip (ms). */
  perMipMs?: (number | null)[];
  /** Mémoire totale de la pyramide (octets). */
  totalBytes?: number | null;
}

export interface HiZQueryResult {
  /** true si le fragment est occlus au niveau du mip ciblé. */
  occluded: boolean;
  /** Niveau du mip consulté. */
  mipLevel: number;
}
