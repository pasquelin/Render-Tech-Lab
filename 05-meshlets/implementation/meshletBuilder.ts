/**
 * 05-meshlets/implementation/meshletBuilder.ts
 *
 * Algorithme de partitionnement de géométrie en clusters (meshlets).
 * Construit les métadonnées (boundingSphere, normalCone, offsets)
 * et calcule les métriques de partitionnement (facteur de duplication, mémoire).
 */

import type { TriangleMesh } from '../../shared/fixtures/types.ts';
import type {
  Meshlet,
  MeshletPartitioningConfig,
  MeshletPartitioningResult,
  BoundingSphere,
  NormalCone,
} from '../contracts.ts';
import { dot } from '../../shared/math/geometry.ts';

function validateMesh(mesh: TriangleMesh): void {
  if (mesh.positions.length % 3 !== 0 || mesh.indices.length % 3 !== 0) {
    throw new Error('Le maillage doit contenir des positions xyz et des triangles indexés complets');
  }
  if (mesh.triangleCount !== mesh.indices.length / 3 || mesh.vertexCount !== mesh.positions.length / 3) {
    throw new Error('Les compteurs du maillage ne correspondent pas aux buffers');
  }
  for (const value of mesh.positions) if (!Number.isFinite(value)) throw new Error('Position non finie');
  for (const index of mesh.indices) if (index >= mesh.vertexCount) throw new Error(`Index de sommet hors limites: ${index}`);
}

/**
 * Calcule la sphère englobante minimale d'un ensemble de sommets indexés.
 */
function computeMeshletBoundingSphere(
  positions: Float32Array,
  vertexIndices: number[]
): BoundingSphere {
  if (vertexIndices.length === 0) {
    return { center: [0, 0, 0], radius: 0 };
  }

  // Centre = barycentre des sommets
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const vIdx of vertexIndices) {
    const p = vIdx * 3;
    cx += positions[p];
    cy += positions[p + 1];
    cz += positions[p + 2];
  }
  cx /= vertexIndices.length;
  cy /= vertexIndices.length;
  cz /= vertexIndices.length;

  // Rayon = distance maximale au centre
  let maxRadiusSq = 0;
  for (const vIdx of vertexIndices) {
    const p = vIdx * 3;
    const dx = positions[p] - cx;
    const dy = positions[p + 1] - cy;
    const dz = positions[p + 2] - cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxRadiusSq) {
      maxRadiusSq = distSq;
    }
  }

  return {
    center: [cx, cy, cz],
    radius: Math.sqrt(maxRadiusSq),
  };
}

/**
 * Calcule le cône de normales pour le backface culling du cluster.
 */
function computeMeshletNormalCone(
  positions: Float32Array,
  meshIndices: Uint32Array,
  startTriIdx: number,
  triCount: number,
  boundingCenter: [number, number, number]
): NormalCone {
  let avgNx = 0;
  let avgNy = 0;
  let avgNz = 0;
  const faceNormals: [number, number, number][] = [];

  for (let t = 0; t < triCount; t++) {
    const i0 = meshIndices[(startTriIdx + t) * 3] * 3;
    const i1 = meshIndices[(startTriIdx + t) * 3 + 1] * 3;
    const i2 = meshIndices[(startTriIdx + t) * 3 + 2] * 3;

    // Vecteurs d'arêtes e1 = v1 - v0, e2 = v2 - v0
    const e1x = positions[i1] - positions[i0];
    const e1y = positions[i1 + 1] - positions[i0 + 1];
    const e1z = positions[i1 + 2] - positions[i0 + 2];

    const e2x = positions[i2] - positions[i0];
    const e2y = positions[i2 + 1] - positions[i0 + 1];
    const e2z = positions[i2 + 2] - positions[i0 + 2];

    // Produit vectoriel e1 x e2
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len > 1e-6) {
      nx /= len;
      ny /= len;
      nz /= len;

      faceNormals.push([nx, ny, nz]);
      avgNx += nx;
      avgNy += ny;
      avgNz += nz;
    }
  }

  const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz);
  const axis: [number, number, number] =
    avgLen > 1e-6
      ? [avgNx / avgLen, avgNy / avgLen, avgNz / avgLen]
      : [0, 0, 1];

  // Calcul du cosinus de la demi-ouverture du cône
  let minCos = 1.0;
  for (const fn of faceNormals) {
    const d = dot(fn, axis);
    if (d < minCos) {
      minCos = d;
    }
  }

  return {
    apex: boundingCenter,
    axis,
    cosHalfAngle: Math.max(-1.0, Math.min(1.0, minCos)),
    cullable: faceNormals.length > 0 && avgLen > 1e-6 && minCos > 0,
  };
}

/**
 * Partitionne un maillage indexé en grappes (meshlets) contiguës de taille maximale donnée.
 */
export function buildMeshlets(
  mesh: TriangleMesh,
  trianglesPerMeshlet: 64 | 128 | 256 | 512
): MeshletPartitioningResult {
  validateMesh(mesh);
  const startTime = performance.now();
  const totalTriangles = mesh.triangleCount;
  const meshlets: Meshlet[] = [];

  let accumulatedMeshletVertexCount = 0;
  const uniqueVertexSet = new Set<number>();

  for (let triOffset = 0; triOffset < totalTriangles; triOffset += trianglesPerMeshlet) {
    const currentTriCount = Math.min(trianglesPerMeshlet, totalTriangles - triOffset);
    const indexOffset = triOffset * 3;
    const indexCount = currentTriCount * 3;

    // Collecte des sommets uniques du meshlet
    const localVertexSet = new Set<number>();
    for (let i = 0; i < indexCount; i++) {
      const v = mesh.indices[indexOffset + i];
      localVertexSet.add(v);
      uniqueVertexSet.add(v);
    }

    const localVertices = Array.from(localVertexSet);
    accumulatedMeshletVertexCount += localVertices.length;

    // Calcul de la sphère englobante
    const boundingSphere = computeMeshletBoundingSphere(
      mesh.positions,
      localVertices
    );

    // Calcul du cône de normales
    const normalCone = computeMeshletNormalCone(
      mesh.positions,
      mesh.indices,
      triOffset,
      currentTriCount,
      boundingSphere.center
    );

    meshlets.push({
      boundingSphere,
      normalCone,
      vertexOffset: localVertices[0] ?? 0,
      vertexCount: localVertices.length,
      indexOffset,
      indexCount,
      triangleCount: currentTriCount,
      vertexIndices: Uint32Array.from(localVertices),
      sourceTriangleOffset: triOffset,
    });
  }

  const buildDuration = performance.now() - startTime;
  const meshletCount = meshlets.length;
  const avgTriangles = meshletCount > 0 ? totalTriangles / meshletCount : 0;
  const vertexDuplication =
    uniqueVertexSet.size > 0
      ? Number((accumulatedMeshletVertexCount / uniqueVertexSet.size).toFixed(2))
      : 1.0;

  // Empreinte mémoire :
  // Indices : indexCount * 4 octets (u32)
  // Métadonnées : 64 octets par meshlet (aligné vec4 WGSL)
  const indexMemoryBytes = mesh.indices.byteLength;
  const metadataMemoryBytes = meshletCount * 64;

  const config: MeshletPartitioningConfig = {
    trianglesPerMeshlet,
    meshletCount,
    triangleCountPerMeshlet: Number(avgTriangles.toFixed(1)),
    vertexDuplicationFactor: vertexDuplication,
    indexMemoryBytes,
    metadataMemoryBytes,
    buildTimeMs: Number(buildDuration.toFixed(2)),
  };

  return {
    config,
    meshlets,
    totalTriangles,
  };
}
