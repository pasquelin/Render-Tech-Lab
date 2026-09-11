/**
 * shared/fixtures/stress.ts
 *
 * Maillage témoin haute densité (stress) : plan maillé en grille avec un
 * déplacement sinusoïdal. Déterministe : mêmes paramètres, mêmes triangles.
 *
 * Sert de volume géométrique récurrent pour les bancs à forte densité
 * (LOD, meshlets, compaction, streaming) où la taille d'empreinte mémoire
 * et le nombre de triangles doivent être contrôlables et reproductibles.
 */

import type { TriangleMesh } from './types.ts';

export interface StressMeshOptions {
  /** Nombre de segments par axe (grid divisions). Défaut : 64. */
  segments?: number;
  /** Taille de l'empreinte du plan (largeur = hauteur). Défaut : 4. */
  size?: number;
  /** Amplitude du déplacement sinusoïdal. Défaut : 0.25. */
  amplitude?: number;
}

/**
 * Construit un plan maillé `segments × segments` avec une ondulation sinusoïdale
 * de hauteur. Résultat : une surface lisse de `segments*segments*2` triangles.
 */
export function createStressMesh(options: StressMeshOptions = {}): TriangleMesh {
  const segments = Math.max(1, options.segments ?? 64);
  const size = options.size ?? 4;
  const amplitude = options.amplitude ?? 0.25;

  const rowVertexCount = segments + 1;
  const vertexCount = rowVertexCount * rowVertexCount;
  const triangleCount = segments * segments * 2;

  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(triangleCount * 3);

  let vi = 0;
  for (let iy = 0; iy <= segments; iy++) {
    for (let ix = 0; ix <= segments; ix++) {
      const u = ix / segments;
      const v = iy / segments;
      const x = (u - 0.5) * size;
      const z = (v - 0.5) * size;
      const wave =
        Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 4) +
        0.5 * Math.sin(u * Math.PI * 9 + 1.1) * Math.cos(v * Math.PI * 9 + 0.7);
      const y = wave * amplitude;

      positions[vi * 3 + 0] = x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = z;
      vi++;
    }
  }

  let ti = 0;
  for (let iy = 0; iy < segments; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iy * rowVertexCount + ix;
      const b = (iy + 1) * rowVertexCount + ix;
      const c = (iy + 1) * rowVertexCount + ix + 1;
      const d = iy * rowVertexCount + ix + 1;

      indices[ti++] = a;
      indices[ti++] = b;
      indices[ti++] = c;
      indices[ti++] = a;
      indices[ti++] = c;
      indices[ti++] = d;
    }
  }

  return {
    name: `stress-grid-${segments}x${segments}`,
    positions,
    indices,
    vertexCount,
    triangleCount,
  };
}
