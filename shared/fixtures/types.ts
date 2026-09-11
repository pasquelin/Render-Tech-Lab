/**
 * shared/fixtures/types.ts
 *
 * Contrats des maillages témoins. Volontairement bruts (positions + indices)
 * et agnostiques de Three.js, afin d'être consommables aussi bien par le banc
 * CPU (Test A) que par les buffers plats WebGPU (Test B).
 */

export interface TriangleMesh {
  /** Nom stable du maillage (clé d'identification dans les rapports). */
  name: string;
  /** Positions en triplets xyz, en unités monde. */
  positions: Float32Array;
  /** Indices de triangles. */
  indices: Uint32Array;
  /** Nombre de sommets. */
  vertexCount: number;
  /** Nombre de triangles (indices.length / 3). */
  triangleCount: number;
}
