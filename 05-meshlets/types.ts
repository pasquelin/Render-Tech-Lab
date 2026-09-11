/**
 * 05-meshlets/types.ts
 *
 * Contrats de type du banc meshlets : cluster, métadonnées, métriques de
 * partitionnement attendues par le Master Test Plan (§7, Test 05).
 *
 * IMPORTANT : c'est un CAHIER DES CHARGES, pas une implémentation. Aucun
 * partitionneur sophistiqué n'est exigé à cette étape ; seule la structure
 * de données est fixée pour que 05/06/07/13 réutilisent la même définition.
 */

export interface BoundingSphere {
  /** Centre (x, y, z) en unités monde. */
  center: [number, number, number];
  /** Rayon (x, y, z = 1) : empilement WGSL compatible `vec4<f32>` où w = radius. */
  radius: number;
}

export interface NormalCone {
  /** Sommet du cône (world). */
  apex: [number, number, number];
  /** Axe normalisé du cône. */
  axis: [number, number, number];
  /** cos(θ/2) : test d'angle — cosHalfAngle est le cosinus de la demi-ouverture. */
  cosHalfAngle: number;
}

export interface Meshlet {
  /** Position et rayon de la sphère englobante. */
  boundingSphere: BoundingSphere;
  /** Cône de normales pour backface culling. */
  normalCone: NormalCone;

  /** Offset du premier sommet du meshlet dans le buffer de positions. */
  vertexOffset: number;
  /** Nombre de sommets du meshlet. */
  vertexCount: number;
  /** Offset du premier index du meshlet dans le buffer d'indices. */
  indexOffset: number;
  /** Nombre d'indices (3 par triangle) du meshlet. */
  indexCount: number;

  /** Nombre de triangles du meshlet (indexCount / 3). */
  triangleCount: number;
}

/**
 * Configuration d'un banc de partitionnement (palier de taille de cluster).
 * Le banc teste les tailles ci-dessus sans préjuger du meilleur.
 */
export interface MeshletPartitioningConfig {
  trianglesPerMeshlet: 64 | 128 | 256 | 512;
  /** Nombre de meshlets générés (résultat mesuré, ou `null` si non mesuré). */
  meshletCount?: number | null;
  triangleCountPerMeshlet?: number | null;
  vertexDuplicationFactor?: number | null;
  indexMemoryBytes?: number | null;
  metadataMemoryBytes?: number | null;
  buildTimeMs?: number | null;
}

/**
 * Résultat d'un banc de partitionnement (à consolider dans `customMetrics`
 * de latest.json via shared/benchmark/runner.ts).
 */
export interface MeshletPartitioningResult {
  config: MeshletPartitioningConfig;
  meshlets: Meshlet[];
  totalTriangles: number;
}
