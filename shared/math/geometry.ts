/**
 * shared/math/geometry.ts
 *
 * Fonctions géométriques pures et oracles de référence.
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

export function dot(left: number[], right: number[]): number {
  let sum = 0;
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i++) {
    sum += left[i] * right[i];
  }
  return sum;
}

export function norm(vector: number[]): number {
  return Math.sqrt(dot(vector, vector));
}

/**
 * Calcule l'union minimale de deux sphères englobantes.
 * Retourne [center, radius].
 */
export function sphereUnion(
  firstCenter: number[],
  firstRadius: number,
  secondCenter: number[],
  secondRadius: number
): [number[], number] {
  if (firstRadius < 0 || secondRadius < 0) {
    throw new Error('Rayon négatif');
  }
  const direction = secondCenter.map((val, idx) => val - firstCenter[idx]);
  const distance = norm(direction);

  if (firstRadius >= distance + secondRadius) {
    return [[...firstCenter], firstRadius];
  }
  if (secondRadius >= distance + firstRadius) {
    return [[...secondCenter], secondRadius];
  }

  const radius = (distance + firstRadius + secondRadius) / 2;
  const center = firstCenter.map(
    (val, idx) => val + ((radius - firstRadius) * direction[idx]) / distance
  );
  return [center, radius];
}

/**
 * Test conservateur AABB / plan : renvoie true si l'AABB est entièrement
 * située en dehors (côté négatif) du demi-espace défini par le plan.
 * Le plan est défini par n · x + d >= 0 (demi-espace positif).
 */
export function aabbOutsidePlane(
  center: number[],
  extent: number[],
  normal: number[],
  offset: number
): boolean {
  if (extent.some((v) => v < 0)) {
    throw new Error('Étendue négative');
  }
  const absNormal = normal.map((v) => Math.abs(v));
  return dot(normal, center) + offset + dot(absNormal, extent) < 0;
}

/**
 * Projection en perspective sur le plan focal.
 */
export function projectedPoint(
  point: number[],
  focal: [number, number]
): [number, number] {
  if (point[2] <= 0) {
    throw new Error('Point hors domaine perspective (z <= 0)');
  }
  return [(focal[0] * point[0]) / point[2], (focal[1] * point[1]) / point[2]];
}

/**
 * Borne supérieure d'erreur géométrique projetée à l'écran.
 */
export function projectedErrorBound(
  error: number,
  minimum: number[],
  maximum: number[],
  focal: [number, number],
  near: number = 0.01
): number {
  if (
    error < 0 ||
    ![error, ...minimum, ...maximum, ...focal, near].every(Number.isFinite)
  ) {
    throw new Error('Valeur invalide');
  }
  if (minimum.some((lower, idx) => lower > maximum[idx]) || near <= 0) {
    throw new Error('Boîte ou plan proche invalide');
  }
  if (minimum[2] <= near) {
    return Infinity;
  }
  const transverseSquared =
    Math.max(Math.abs(minimum[0]), Math.abs(maximum[0])) ** 2 +
    Math.max(Math.abs(minimum[1]), Math.abs(maximum[1])) ** 2;

  const maxFocal = Math.max(Math.abs(focal[0]), Math.abs(focal[1]));
  return (
    ((error * maxFocal) / minimum[2]) *
    Math.sqrt(1 + transverseSquared / minimum[2] ** 2)
  );
}

/**
 * Quantification d'une valeur continue avec pas et origine.
 * Retourne [valeur entière discrète, valeur reconstruite].
 */
export function quantize(
  value: number,
  step: number,
  origin: number = 0.0
): [number, number] {
  if (step <= 0) {
    throw new Error('Pas invalide');
  }
  const scaled = (value - origin) / step;
  const integer = Math.floor(scaled + 0.5);
  return [integer, origin + step * integer];
}
