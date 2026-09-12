/**
 * 06-meshlet-culling/tests/test_meshlet_culling.ts
 *
 * Banc de test et d'analyse des taux de rejet pour 06-meshlet-culling.
 * Valide les 3 étages : frustum, backface cône et sub-pixel.
 */

import { createSphereMesh } from '../../shared/fixtures/sphere.ts';
import { buildMeshlets } from '../../05-meshlets/index.ts';
import {
  cullMeshlets,
  testMeshletFrustum,
  testMeshletBackface,
  testMeshletSubPixel,
  WGSL_MESHLET_CULLING,
} from '../implementation/meshletCuller.ts';
import type { CullingInput } from '../contracts.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[06-meshlet-culling] Échec d'assertion : ${message}`);
  }
}

export function runMeshletCullingSuite() {
  console.log('🚀 Lancement du banc 06-meshlet-culling (Culling Frustum + Cône + Subpixel)...');

  // Shader WGSL validation
  assert(
    WGSL_MESHLET_CULLING.includes('@compute') &&
      WGSL_MESHLET_CULLING.includes('subPixelThreshold') &&
      WGSL_MESHLET_CULLING.includes('planeLength'),
    'Shader WGSL de culling cluster incomplet'
  );

  // Construction d'une sphère de référence partitionnée en meshlets de 128 triangles
  const sphere = createSphereMesh({ radius: 5.0, longBands: 32, latBands: 16 });
  const { meshlets } = buildMeshlets(sphere, 128);
  assert(meshlets.length > 0, 'Échec de génération des meshlets');

  const scaledPlane = { n: [2, 0, 0] as [number, number, number], d: 2 };
  const normalizedPlane = { n: [1, 0, 0] as [number, number, number], d: 1 };
  for (const meshlet of meshlets) {
    assert(testMeshletFrustum(meshlet, [scaledPlane]) === testMeshletFrustum(meshlet, [normalizedPlane]),
      'La décision frustum doit être invariante à la norme du plan');
  }

  const frustumPlanes = [
    { n: [1, 0, 0] as [number, number, number], d: 20 },
    { n: [-1, 0, 0] as [number, number, number], d: 20 },
    { n: [0, 0, 1] as [number, number, number], d: 20 },
    { n: [0, 0, -1] as [number, number, number], d: 20 },
    { n: [0, -1, 0] as [number, number, number], d: 19 }, // Near: y <= 19 (camera at y=20)
    { n: [0, 1, 0] as [number, number, number], d: 50 },  // Far: y >= -50
  ];

  const viewPos: [number, number, number] = [0, 20, 0]; // Caméra en (0, 20, 0) regardant vers l'origine
  const screenHeight = 1080;
  const fovRad = (60 * Math.PI) / 180;
  const subPixelThreshold = 2.0; // Seuil de 2 pixels

  // TEST 1 : Test Frustum isolé
  let frustumPass = 0;
  for (const m of meshlets) {
    if (testMeshletFrustum(m, frustumPlanes)) frustumPass++;
  }
  assert(frustumPass > 0, 'Au moins un meshlet doit passer le frustum');

  // TEST 2 : Test Backface cône isolé
  // Sur une sphère complète vue de face, environ 50% des meshlets font dos à la caméra !
  let backfacePass = 0;
  let backfaceReject = 0;
  for (const m of meshlets) {
    if (testMeshletBackface(m, viewPos)) {
      backfacePass++;
    } else {
      backfaceReject++;
    }
  }
  console.log(
    `  - Backface Cône : ${backfacePass} visibles, ${backfaceReject} rejetés dos à la vue (${((backfaceReject / meshlets.length) * 100).toFixed(0)}%)`
  );
  assert(backfaceReject > 0, 'Le cône de normale doit rejeter la face arrière de la sphère');
  assert(backfacePass > 0, 'La face avant de la sphère doit être conservée');

  // TEST 3 : Test Sub-pixel isolé
  // À distance 15m, une sphère rayon 5m fait ~ 400 px -> aucun rejet
  let subpixelRejectNear = 0;
  for (const m of meshlets) {
    if (!testMeshletSubPixel(m, viewPos, screenHeight, fovRad, subPixelThreshold)) {
      subpixelRejectNear++;
    }
  }
  assert(subpixelRejectNear === 0, 'À 15m, les clusters ne doivent pas être sub-pixel');

  // À distance 5 000m, les clusters font < 1px -> 100% rejetés !
  const farDistance = Math.max(...meshlets.map(m =>
    Math.hypot(...m.boundingSphere.center) + 2 * m.boundingSphere.radius * screenHeight / (Math.tan(fovRad / 2) * subPixelThreshold)));
  const farViewPos: [number, number, number] = [0, farDistance, 0];
  let subpixelRejectFar = 0;
  for (const m of meshlets) {
    if (!testMeshletSubPixel(m, farViewPos, screenHeight, fovRad, subPixelThreshold)) {
      subpixelRejectFar++;
    }
  }
  assert(subpixelRejectFar === meshlets.length, 'À la distance garantissant le seuil, tous les clusters doivent être sub-pixel');

  // TEST 4 : Chaîne complète intégrée
  const input: CullingInput = {
    meshlets,
    frustumPlanes,
    viewPosition: viewPos,
    subPixelThreshold,
    screenHeight,
    fovRad,
  };

  const output = cullMeshlets(input);
  console.log(
    `  - Campagne complète (3 tests) : ${meshlets.length} soumis -> ${output.visible.length} retenus (${(output.globalRejectRate * 100).toFixed(1)}% rejetés)`
  );
  console.log(
    `    Frustum: ${output.rejectCounts.frustum} | Backface: ${output.rejectCounts.backface} | Subpixel: ${output.rejectCounts.subpixel}`
  );

  assert(output.visible.length > 0, 'Des meshlets visibles doivent subsister');
  assert(output.globalRejectRate > 0.3, 'Le taux de rejet global doit éliminer au moins 30% des clusters');
  assert(output.rejectReasons.length === meshlets.length, 'Une raison doit exister pour chaque meshlet soumis');
  assert(output.rejectCounts.total + output.visible.length === meshlets.length, 'Chaque meshlet doit être rejeté une fois ou conservé');

  const degenerate = structuredClone(meshlets[0]);
  degenerate.normalCone.cullable = false;
  assert(testMeshletBackface(degenerate, [0, -20, 0]), 'Un cône non certifiable doit rester visible par prudence');

  console.log('Tests CPU 06-meshlet-culling réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMeshletCullingSuite();
}
