/**
 * shared/fixtures/sphere.ts
 *
 * Maillage témoin : une sphère par maillage UV (latitude/longitude).
 * Déterministe : paramètres fixes par défaut, zéro dépendance.
 */

import type { TriangleMesh } from './types.ts';

export interface SphereOptions {
  /** Nombre de divisions en latitude (rangs verticaux). Défaut : 16. */
  latBands?: number;
  /** Nombre de divisions en longitude (colonnes). Défaut : 32. */
  longBands?: number;
  /** Rayon de la sphère. Défaut : 0.5. */
  radius?: number;
}

/**
 * Construit une sphère maillée en UV (latBands × longBands), centrée à l'origine.
 * Les bords sont recollés sans duplication (indices pointant sur la même colonne).
 */
export function createSphereMesh(options: SphereOptions = {}): TriangleMesh {
  const latBands = Math.max(2, options.latBands ?? 16);
  const longBands = Math.max(3, options.longBands ?? 32);
  const radius = options.radius ?? 0.5;

  const rowVertexCount = longBands + 1; // colonne 0 et colonne longBands coïncident (recollement)
  const vertexCount = (latBands + 1) * rowVertexCount;
  const triangleCount = latBands * longBands * 2;

  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(triangleCount * 3);

  let vi = 0;
  for (let i = 0; i <= latBands; i++) {
    const theta = (i / latBands) * Math.PI; // 0..PI
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let j = 0; j <= longBands; j++) {
      const phi = (j / longBands) * Math.PI * 2; // 0..2PI, j=0 et j=longBands sont recollés
      positions[vi * 3 + 0] = radius * sinTheta * Math.cos(phi);
      positions[vi * 3 + 1] = radius * cosTheta;
      positions[vi * 3 + 2] = radius * sinTheta * Math.sin(phi);
      vi++;
    }
  }

  // Indices (quad décomposé en 2 triangles). Colonne j et j+1 avec recouvrement.
  let ti = 0;
  for (let i = 0; i < latBands; i++) {
    for (let j = 0; j < longBands; j++) {
      const a = i * rowVertexCount + j;
      const b = (i + 1) * rowVertexCount + j;
      const c = (i + 1) * rowVertexCount + j + 1;
      const d = i * rowVertexCount + j + 1;

      indices[ti++] = a;
      indices[ti++] = b;
      indices[ti++] = c;
      indices[ti++] = a;
      indices[ti++] = c;
      indices[ti++] = d;
    }
  }

  return {
    name: 'unit-sphere',
    positions,
    indices,
    vertexCount,
    triangleCount,
  };
}
