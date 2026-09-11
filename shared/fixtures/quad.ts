/**
 * shared/fixtures/quad.ts
 *
 * Maillage témoin : un plan (quad) unité découpé en 2 triangles.
 * Déterministe : valeurs fixes, zéro dépendance.
 */

import type { TriangleMesh } from './types.ts';

/**
 * Quad unité dans le plan Z=0, centré, découpé en deux triangles.
 * Témoin de surface plane pour les tests de shading / visibilité.
 */
export function createQuadMesh(): TriangleMesh {
  const positions = new Float32Array([
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
     0.5,  0.5, 0,
    -0.5,  0.5, 0,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

  return {
    name: 'unit-quad',
    positions,
    indices,
    vertexCount: 4,
    triangleCount: 2,
  };
}
