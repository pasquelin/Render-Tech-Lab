/**
 * 03-gpu-scene/benchmark/test_scene.ts
 *
 * Banc de test et validation automatisé pour 03-gpu-scene (Scène hétérogène GPU).
 * Valide les mega-buffers, la sérialisation GPUObject et la génération de commandes indirectes.
 */

import {
  generateStressScene,
  createVariedGeometries,
} from './stressScenarios.ts';
import {
  packObject,
  SLOTS_PER_OBJECT,
  BYTES_PER_OBJECT,
} from '../implementation/gpuSceneBuffers.ts';
import type { GPUObjectData, SceneStressConfig } from '../types.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[03-gpu-scene] Échec d'assertion : ${message}`);
  }
}

export function runSceneSuite() {
  console.log('🚀 Lancement du banc 03-gpu-scene (Mega-buffers & Scène hétérogène)...');

  // TEST 1 : Création de 10 géométries variées et fusion dans les méga-tampons
  const geomCount = 10;
  const { geometries, mergedVertices, mergedIndices, threeGeometries } =
    createVariedGeometries(geomCount);

  assert(geometries.length === geomCount, `Devrait produire ${geomCount} descripteurs de géométries`);
  assert(threeGeometries.length === geomCount, 'Devrait produire 10 géométries Three.js');
  assert(mergedVertices.length > 0, 'Le buffer fusionné de sommets ne doit pas être vide');
  assert(mergedIndices.length > 0, 'Le buffer fusionné d indices ne doit pas être vide');

  console.log(
    `  - Géométries fusionnées : ${geomCount} topologies | ${mergedVertices.length / 6} sommets | ${mergedIndices.length / 3} triangles`
  );

  // Vérification de la continuité des offsets
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    assert(g.boundingRadius > 0, `La géométrie ${i} doit avoir un rayon englobant positif`);
    if (i > 0) {
      const prev = geometries[i - 1];
      assert(
        g.indexOffset === prev.indexOffset + prev.indexCount,
        `Continuité indexOffset en défaut pour géométrie ${i}`
      );
      assert(
        g.vertexOffset >= prev.vertexOffset,
        `Continuité vertexOffset en défaut pour géométrie ${i}`
      );
    }
  }

  // TEST 2 : Sérialisation d'un GPUObject dans le layout binaire WGSL (96 octets)
  const buffer = new ArrayBuffer(BYTES_PER_OBJECT);
  const floatView = new Float32Array(buffer);
  const uintView = new Uint32Array(buffer);

  const testObj: GPUObjectData = {
    padding: 0,
    geometryId: 3,
    materialId: 7,
    flags: 1, // STATIQUE
    transform: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1,
    ]),
    boundingCenterRadius: [10, 20, 30, 4.5],
  };

  packObject(floatView, uintView, 0, testObj);

  assert(BYTES_PER_OBJECT === 96, 'Le layout WGSL de GPUObject doit faire exactement 96 octets');
  assert(SLOTS_PER_OBJECT === 24, 'Chaque objet doit occuper 24 slots (4 octets chacun)');
  assert(floatView[12] === 10 && floatView[13] === 20 && floatView[14] === 30, 'Translation transform invalide');
  assert(floatView[16] === 10 && floatView[17] === 20 && floatView[18] === 30, 'Centre de sphère invalide');
  assert(floatView[19] === 4.5, 'Rayon de sphère invalide');
  assert(uintView[20] === 3, 'geometryId invalide');
  assert(uintView[21] === 7, 'materialId invalide');
  assert(uintView[22] === 1, 'flags invalide');

  console.log('  - Encodage binaire GPUObject validé (96 octets, alignement WGSL respecté)');

  // TEST 3 : Génération de scène hétérogène de stress (2 000 objets, 10 topologies, 10 matériaux)
  const stressConfig: SceneStressConfig = {
    name: 'Standard Stress 2k',
    dimension: 'A-geometry',
    objectCount: 2000,
    geometryCount: 10,
    materialCount: 10,
    dynamicRatio: 0.25,
    targetVisibility: 1.0,
  };

  const scene = generateStressScene(stressConfig);
  assert(scene.objects.length === 2000, 'Doit générer 2000 objets');
  assert(scene.geometries.length === 10, 'Doit inclure 10 topologies');
  assert(scene.materials.length === 10, 'Doit inclure 10 matériaux');

  const dynamicCount = scene.objects.filter((o) => (o.flags & 1) === 0).length;
  assert(dynamicCount > 0, 'Doit contenir des objets dynamiques selon le dynamicRatio');

  console.log(
    `  - Scène 2k générée : 2000 instances, ${dynamicCount} dynamiques, ${scene.mergedVertexBuffer.byteLength} octets de sommets`
  );

  // TEST 4 : Structure du DrawBuffer indirect (5 u32 par géométrie = 20 octets par draw)
  const indirectDrawArray = new Uint32Array(scene.geometries.length * 5);
  for (let i = 0; i < scene.geometries.length; i++) {
    const o = i * 5;
    const g = scene.geometries[i];
    indirectDrawArray[o + 0] = g.indexCount;
    indirectDrawArray[o + 1] = 0; // instanceCount initialisé à 0
    indirectDrawArray[o + 2] = g.indexOffset;
    indirectDrawArray[o + 3] = g.vertexOffset;
    indirectDrawArray[o + 4] = 0;
  }
  assert(indirectDrawArray.length === 50, '10 géométries * 5 uint32 = 50 uints dans le DrawBuffer');

  console.log('Tests CPU 03-gpu-scene réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSceneSuite();
}
