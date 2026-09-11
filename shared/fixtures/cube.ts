/**
 * shared/fixtures/cube.ts
 *
 * Maillage témoin : une boîte unité (cube) de 12 triangles.
 * Déterministe : valeurs fixes, zéro dépendance.
 */

import type { TriangleMesh } from './types.ts';

/**
 * Cube unité centré à l'origine (arête 1). 8 sommets, 6 faces, 12 triangles.
 * Témoin de volumétrie pour le culling / Hi-Z / occlusion.
 */
export function createCubeMesh(): TriangleMesh {
  const positions = new Float32Array([
    // 8 sommets
    -0.5, -0.5, -0.5, // 0
     0.5, -0.5, -0.5, // 1
     0.5,  0.5, -0.5, // 2
    -0.5,  0.5, -0.5, // 3
    -0.5, -0.5,  0.5, // 4
     0.5, -0.5,  0.5, // 5
     0.5,  0.5,  0.5, // 6
    -0.5,  0.5,  0.5, // 7
  ]);

  // 12 triangles (2 par face), orientation cohérente (normales tournées vers l'extérieur).
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, // face -z
    4, 6, 5, 4, 7, 6, // face +z
    0, 4, 7, 0, 7, 3, // face -x
    1, 5, 6, 1, 6, 2, // face +x
    3, 7, 6, 3, 6, 2, // face +y
    0, 1, 5, 0, 5, 4, // face -y
  ]);

  return {
    name: 'unit-cube',
    positions,
    indices,
    vertexCount: 8,
    triangleCount: 12,
  };
}
