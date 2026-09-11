/**
 * shared/math/screenSpaceError.ts
 *
 * Fonctions mathématiques pures pour le calcul du Screen-Space Error (SSE)
 * et la sélection de niveau de détail (LOD).
 *
 * Règle de gouvernance : Ces fonctions sont exemptes de toute dépendance
 * à WebGL, WebGPU ou au DOM afin d'être exécutables et testables unitairement
 * sur tout environnement (Node, Web Worker, Thread principal).
 */

export interface LodThresholds {
  lod0: number; // Taille minimale en pixels pour LOD 0 (défaut: 250 px)
  lod1: number; // Taille minimale en pixels pour LOD 1 (défaut: 60 px)
}

export const DEFAULT_LOD_THRESHOLDS: LodThresholds = {
  lod0: 250,
  lod1: 60,
};

export const CONTRACTUAL_MAX_ERROR_PX = 1.5;

/**
 * Calcule la taille projetée en pixels d'un diamètre englobant à l'écran.
 *
 * Formule canonique :
 *   pixels = (D * H) / (2 * d * tan(FOV / 2))
 *
 * @param diameter Diamètre englobant de l'objet en unités monde (D)
 * @param distance Distance euclidienne objet-caméra en unités monde (d)
 * @param screenHeight Hauteur physique ou logique du viewport en pixels (H)
 * @param fovRad Champ de vision vertical en radians (FOV)
 * @returns Taille projetée en pixels
 */
export function calculateScreenSpacePixels(
  diameter: number,
  distance: number,
  screenHeight: number,
  fovRad: number
): number {
  if (distance <= 0.0001) return Infinity;
  if (diameter <= 0 || screenHeight <= 0 || fovRad <= 0) return 0;

  const halfFovTan = Math.tan(fovRad * 0.5);
  if (halfFovTan <= 0) return 0;

  return (diameter * screenHeight) / (2 * distance * halfFovTan);
}

/**
 * Détermine l'indice de palier LOD (0, 1, ou 2) en fonction de la taille projetée en pixels.
 *
 * - pixels > lod0 (250 px) => LOD 0 (100% géométrie)
 * - lod1 (60 px) < pixels <= lod0 (250 px) => LOD 1 (50% géométrie)
 * - pixels <= lod1 (60 px) => LOD 2 (25% géométrie)
 *
 * @param projectedPixels Taille projetée calculée
 * @param thresholds Seuils configurables (défaut: 250 px et 60 px)
 * @returns Indice de LOD (0, 1, 2)
 */
export function evaluateLodTier(
  projectedPixels: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS
): number {
  if (projectedPixels > thresholds.lod0) {
    return 0;
  }
  if (projectedPixels > thresholds.lod1) {
    return 1;
  }
  return 2;
}

/**
 * Sélectionne la valeur de LOD (0/1/2) à partir de la projection en pixels.
 *
 * Équivalent canonique de `evaluateLodTier` : exposé sous ce nom car il est
 * référencé directement par le Master Test Plan, et attendu par les futurs
 * bancs (04, 05, 06, …). Signatures identiques.
 */
export function selectLODFromScreenPixels(
  projectedPixels: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS
): number {
  return evaluateLodTier(projectedPixels, thresholds);
}

/**
 * Projette l'erreur géométrique de décimation (en unités monde) en pixels à l'écran.
 *
 * @param geometricErrorWorld Erreur géométrique en unités monde produite par le simplificateur
 * @param distance Distance euclidienne objet-caméra
 * @param screenHeight Hauteur du viewport en pixels
 * @param fovRad Champ de vision vertical en radians
 * @returns Erreur projetée en pixels
 */
export function calculateProjectedGeometricError(
  geometricErrorWorld: number,
  distance: number,
  screenHeight: number,
  fovRad: number
): number {
  if (geometricErrorWorld <= 0) return 0;
  return calculateScreenSpacePixels(geometricErrorWorld, distance, screenHeight, fovRad);
}

/**
 * Valide si l'erreur géométrique projetée respecte le seuil contractuel (<= 1.5 px).
 *
 * @param projectedErrorPx Erreur projetée en pixels
 * @param maxTolerancePx Seuil toléré (défaut: 1.5 px)
 * @returns true si l'erreur est imperceptible sous le seuil contractuel
 */
export function isGeometricErrorAcceptable(
  projectedErrorPx: number,
  maxTolerancePx: number = CONTRACTUAL_MAX_ERROR_PX
): boolean {
  return projectedErrorPx <= maxTolerancePx;
}
