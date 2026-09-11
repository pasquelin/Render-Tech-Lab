/**
 * shared/fixtures/triangle.ts
 *
 * Maillage témoin minimal : un triangle unité dans le plan XY.
 * Déterministe : zéro dépendance, valeurs fixes.
 */

import type { TriangleMesh } from './types.ts';

/**
 * Un triangle dans le plan XY, centré à l'origine.
 * Utilisé comme unité de partitionnement (récipient de culling / SSE).
 */
export function createTriangleMesh(): TriangleMesh {
  const positions = new Float32Array([
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
     0.0,  0.5, 0,
  ]);
  const indices = new Uint32Array([0, 1, 2]);

  return {
    name: 'unit-triangle',
    positions,
    indices,
    vertexCount: 3,
    triangleCount: 1,
  };
}
