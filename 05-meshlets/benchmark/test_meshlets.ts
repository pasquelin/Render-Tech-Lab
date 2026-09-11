/**
 * 05-meshlets/benchmark/test_meshlets.ts
 *
 * Banc de test et d'analyse comparative multi-échelles pour 05-meshlets.
 * Teste le partitionnement géométrique en grappes (64/128/256/512 triangles).
 */

import { createSphereMesh } from '../../shared/fixtures/sphere.ts';
import { buildMeshlets } from '../implementation/meshletBuilder.ts';
import type { MeshletPartitioningConfig } from '../types.ts';

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

    // Invariant 2 : Couverture géométrique de la sphère englobante
    for (let mIdx = 0; mIdx < meshlets.length; mIdx++) {
      const m = meshlets[mIdx];
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
  assert(
    res64.metadataMemoryBytes! > res512.metadataMemoryBytes!,
    'Le tier 64 doit consommer plus de mémoire de métadonnées que le tier 512'
  );

  console.log('Tests CPU 05-meshlets réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMeshletsSuite();
}
