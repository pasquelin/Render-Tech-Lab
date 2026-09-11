/**
 * shared/math/qem.ts
 *
 * Quadric Error Metrics (QEM) — Calculs d'énergie et décimation.
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

import { norm } from './geometry.ts';

/**
 * Construit la matrice quadrique 4x4 à partir d'une liste de plans (a, b, c, d) et poids.
 */
export function quadricFromPlanes(planes: [number[], number][]): number[][] {
  const result: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (const [plane, weight] of planes) {
    if (weight < 0 || Math.abs(norm(plane.slice(0, 3)) - 1.0) > 1e-6) {
      throw new Error('Plan non normalisé ou poids négatif');
    }
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result[row][col] += weight * plane[row] * plane[col];
      }
    }
  }
  return result;
}

/**
 * Calcule l'énergie de Garland-Heckbert p^T Q p pour une position 3D homogène [x, y, z, 1].
 */
export function quadricEnergy(quadric: number[][], position: number[]): number {
  const homogeneous = [...position, 1.0];
  let energy = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      energy += homogeneous[row] * quadric[row][col] * homogeneous[col];
    }
  }
  return energy;
}

/**
 * Résout un système linéaire matrix * x = target par élimination de Gauss-Jordan avec pivot partiel.
 */
export function solvePivoted(
  matrix: number[][],
  target: number[],
  relativeTolerance: number = 1e-12
): number[] | null {
  const size = target.length;
  const augmented: number[][] = matrix.map((row, i) => [...row, target[i]]);
  let scale = 0;
  for (const row of matrix) {
    for (const val of row) {
      scale = Math.max(scale, Math.abs(val));
    }
  }
  if (scale === 0) {
    return null;
  }

  for (let col = 0; col < size; col++) {
    let pivot = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < size; row++) {
      const val = Math.abs(augmented[row][col]);
      if (val > maxVal) {
        maxVal = val;
        pivot = row;
      }
    }

    if (Math.abs(augmented[pivot][col]) <= scale * relativeTolerance) {
      return null;
    }

    // Échange des lignes
    const temp = augmented[col];
    augmented[col] = augmented[pivot];
    augmented[pivot] = temp;

    const divisor = augmented[col][col];
    for (let c = 0; c <= size; c++) {
      augmented[col][c] /= divisor;
    }

    for (let row = 0; row < size; row++) {
      if (row !== col) {
        const factor = augmented[row][col];
        for (let c = 0; c <= size; c++) {
          augmented[row][c] -= factor * augmented[col][c];
        }
      }
    }
  }

  return augmented.map((row) => row[size]);
}

/**
 * Sélectionne la position optimale contractée minimisant l'énergie quadrique.
 * Évalue l'optimum analytique (si inversible), ainsi que left, right et le milieu.
 */
export function quadricCandidate(
  quadric: number[][],
  left: number[],
  right: number[]
): number[] {
  const matrix = quadric.slice(0, 3).map((row) => row.slice(0, 3));
  const target = quadric.slice(0, 3).map((row) => -row[3]);
  const optimum = solvePivoted(matrix, target);

  const candidates: number[][] = [
    [...left],
    [...right],
    [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2],
  ];

  if (optimum !== null) {
    candidates.push(optimum);
  }

  let best = candidates[0];
  let minEnergy = quadricEnergy(quadric, best);

  for (let i = 1; i < candidates.length; i++) {
    const energy = quadricEnergy(quadric, candidates[i]);
    if (energy < minEnergy) {
      minEnergy = energy;
      best = candidates[i];
    }
  }

  return best;
}
