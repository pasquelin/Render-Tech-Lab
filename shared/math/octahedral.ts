/**
 * shared/math/octahedral.ts
 *
 * Encodage et décodage octaédrique des normales unitaires sur 2 composantes.
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

import { norm } from './geometry.ts';

export function signNotZero(value: number): number {
  return value < 0 ? -1 : 1;
}

/**
 * Encode une normale unitaire 3D [nx, ny, nz] sur le domaine octaédrique 2D [-1, 1]^2.
 */
export function octEncode(normal: number[]): [number, number] {
  const total = Math.abs(normal[0]) + Math.abs(normal[1]) + Math.abs(normal[2]);
  if (total === 0) {
    throw new Error('Normale nulle');
  }

  let horizontal = normal[0] / total;
  let vertical = normal[1] / total;
  const depth = normal[2] / total;

  if (depth < 0) {
    const origH = horizontal;
    const origV = vertical;
    horizontal = (1 - Math.abs(origV)) * signNotZero(origH);
    vertical = (1 - Math.abs(origH)) * signNotZero(origV);
  }

  return [horizontal, vertical];
}

/**
 * Décode un vecteur octaédrique 2D vers une normale unitaire 3D [nx, ny, nz].
 */
export function octDecode(encoded: [number, number]): [number, number, number] {
  let [horizontal, vertical] = encoded;
  let depth = 1 - Math.abs(horizontal) - Math.abs(vertical);

  if (depth < 0) {
    const origH = horizontal;
    const origV = vertical;
    horizontal = (1 - Math.abs(origV)) * signNotZero(origH);
    vertical = (1 - Math.abs(origH)) * signNotZero(origV);
  }

  const length = norm([horizontal, vertical, depth]);
  return [horizontal / length, vertical / length, depth / length];
}
