/**
 * shared/math/barycentric.ts
 *
 * Interpolation barycentrique, perspective et dérivées analytiques d'attributs.
 * Conforme aux spécifications de files_local/rapport/ORACLES_ET_TESTS.md
 */

/**
 * Fonction d'arête 2D (cross-product en 2D) : orientée positivement à gauche de first -> second.
 */
export function edge(
  first: [number, number],
  second: [number, number],
  point: [number, number]
): number {
  return (
    (second[0] - first[0]) * (point[1] - first[1]) -
    (second[1] - first[1]) * (point[0] - first[0])
  );
}

/**
 * Calcule les coordonnées barycentriques [w0, w1, w2] d'un point 2D par rapport à un triangle.
 */
export function barycentric(
  vertices: [number, number][],
  point: [number, number]
): [number, number, number] {
  const [first, second, third] = vertices;
  const area = edge(first, second, third);
  if (area === 0) {
    throw new Error('Triangle dégénéré');
  }
  return [
    edge(second, third, point) / area,
    edge(third, first, point) / area,
    edge(first, second, point) / area,
  ];
}

/**
 * Interpolation d'un attribut scalaire avec correction de perspective.
 * weights: coordonnées barycentriques [w0, w1, w2]
 * clipW: composantes w de projection [w_clip0, w_clip1, w_clip2]
 * attributes: valeurs aux sommets [a0, a1, a2]
 */
export function perspectiveAttribute(
  weights: number[],
  clipW: number[],
  attributes: number[]
): number {
  let denominator = 0;
  let numerator = 0;
  for (let i = 0; i < weights.length; i++) {
    const invW = 1.0 / clipW[i];
    denominator += weights[i] * invW;
    numerator += weights[i] * attributes[i] * invW;
  }
  if (denominator === 0) {
    throw new Error('Dénominateur nul');
  }
  return numerator / denominator;
}

/**
 * Dérivée analytique d'un attribut interpolé par rapport aux dérivées des poids barycentriques.
 */
export function perspectiveDerivative(
  weights: number[],
  derivativeWeights: number[],
  clipW: number[],
  attributes: number[]
): number {
  let denominator = 0;
  let numerator = 0;
  let derivativeDenominator = 0;
  let derivativeNumerator = 0;

  for (let i = 0; i < weights.length; i++) {
    const invW = 1.0 / clipW[i];
    denominator += weights[i] * invW;
    numerator += weights[i] * attributes[i] * invW;
    derivativeDenominator += derivativeWeights[i] * invW;
    derivativeNumerator += derivativeWeights[i] * attributes[i] * invW;
  }

  if (denominator === 0) {
    throw new Error('Dénominateur nul');
  }

  return (
    (derivativeNumerator * denominator - numerator * derivativeDenominator) /
    (denominator * denominator)
  );
}
