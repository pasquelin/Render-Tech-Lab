/**
 * 05-meshlets/tests/test_meshlets.ts
 *
 * Banc de test et d'analyse comparative multi-échelles pour 05-meshlets.
 * Teste le partitionnement géométrique en grappes (64/128/256/512 triangles).
 */

import { createSphereMesh } from '../../shared/fixtures/sphere.ts';
import { buildMeshlets } from '../implementation/meshletBuilder.ts';
import type { MeshletPartitioningConfig } from '../contracts.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[05-meshlets] Échec d'assertion : ${message}`);
  }
}

export function runMeshletsSuite() {
  console.log('🚀 Lancement du banc 05-meshlets (Partitionnement en clusters)...');

  // Utilisation de la fixture partagée : sphère haute densité (2 048 triangles)
  const sphere = createSphereMesh({ radius: 2.0, longBands: 48, latBands: 32 });
  console.log(
    `  Maillage témoin : ${sphere.name} | ${sphere.vertexCount} sommets | ${sphere.triangleCount} triangles`
  );

  const tiers: (64 | 128 | 256 | 512)[] = [64, 128, 256, 512];
  const tierResults: MeshletPartitioningConfig[] = [];

  for (const tier of tiers) {
    const { config, meshlets, totalTriangles } = buildMeshlets(sphere, tier);

    assert(totalTriangles === sphere.triangleCount, 'Nombre total de triangles divergent');
    assert(meshlets.length > 0, `Aucun meshlet généré pour le tier ${tier}`);

    // Invariant 1 : La somme des triangles des meshlets doit égaler le total
    const sumTris = meshlets.reduce((sum, m) => sum + m.triangleCount, 0);
    assert(sumTris === totalTriangles, `Somme triangles ${sumTris} !== ${totalTriangles}`);
    let expectedTriangleOffset = 0;

    // Invariant 2 : Couverture géométrique de la sphère englobante
    for (let mIdx = 0; mIdx < meshlets.length; mIdx++) {
      const m = meshlets[mIdx];
      assert(m.triangleCount <= tier, `Limite de triangles dépassée par le meshlet ${mIdx}`);
      assert(m.indexCount === m.triangleCount * 3, `Compte d indices incohérent pour le meshlet ${mIdx}`);
      assert(m.sourceTriangleOffset === expectedTriangleOffset, `Trou ou chevauchement avant le meshlet ${mIdx}`);
      expectedTriangleOffset += m.triangleCount;
      assert(new Set(m.vertexIndices).size === m.vertexCount, `Liste de sommets locaux incohérente pour le meshlet ${mIdx}`);
      const { center, radius } = m.boundingSphere;

      for (let i = 0; i < m.indexCount; i++) {
        const vIdx = sphere.indices[m.indexOffset + i] * 3;
        const dx = sphere.positions[vIdx] - center[0];
        const dy = sphere.positions[vIdx + 1] - center[1];
        const dz = sphere.positions[vIdx + 2] - center[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        assert(
          dist <= radius + 1e-4,
          `Sommet hors de la sphère englobante du meshlet ${mIdx} (dist: ${dist}, r: ${radius})`
        );
      }

      // Invariant 3 : Cône de normale valide
      assert(
        m.normalCone.cosHalfAngle >= -1.0 && m.normalCone.cosHalfAngle <= 1.0,
        `cosHalfAngle hors bornes [-1, 1] pour meshlet ${mIdx}`
      );
    }
    assert(expectedTriangleOffset === totalTriangles, 'La couverture des triangles doit se terminer exactement à la fin du maillage');

    tierResults.push(config);
    console.log(
      `  Tier ${String(tier).padStart(3)} tri/m : Meshlets = ${String(config.meshletCount).padStart(3)} | Duplication = ${config.vertexDuplicationFactor}x | Métadonnées = ${config.metadataMemoryBytes} o | Build = ${config.buildTimeMs} ms`
    );
  }

  // Vérification de la propriété structurelle :
  // Le tier 64 génère plus de meshlets que le tier 512
  const res64 = tierResults.find((r) => r.trianglesPerMeshlet === 64)!;
  const res512 = tierResults.find((r) => r.trianglesPerMeshlet === 512)!;
  assert(
    res64.meshletCount! > res512.meshletCount!,
    'Le tier 64 doit générer plus de meshlets que le tier 512'
  );

  const invalid = { ...sphere, indices: new Uint32Array([0, 1, sphere.vertexCount]) };
  let rejectedInvalidMesh = false;
  try { buildMeshlets(invalid, 64); } catch { rejectedInvalidMesh = true; }
  assert(rejectedInvalidMesh, 'Un index hors limites doit arrêter le partitionnement explicitement');
  assert(
    res64.metadataMemoryBytes! > res512.metadataMemoryBytes!,
    'Le tier 64 doit consommer plus de mémoire de métadonnées que le tier 512'
  );

  console.log('Tests CPU 05-meshlets réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMeshletsSuite();
}
