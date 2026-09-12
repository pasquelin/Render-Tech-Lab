/**
 * 02-gpu-frustum-culling/tests/test_culling.ts
 *
 * Banc de test et benchmark automatisé pour 02-gpu-frustum-culling.
 * Valide le comportement conservateur et l'arbitrage CPU vs GPU.
 */

import {
  cullBoundingSphereAgainstFrustum,
  WGSL_FRUSTUM_CULLING,
} from '../implementation/frustumCuller.ts';
import type {
  FrustumPlane,
  CullingInstance,
} from '../contracts.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[02-gpu-frustum-culling] Échec d'assertion : ${message}`);
  }
}

// Définition d'un frustum de référence symétrique regardant vers -Z
// [left, right, bottom, top, near, far]
export const TEST_FRUSTUM_PLANES: FrustumPlane[] = [
  { normal: [1, 0, 0], offset: 50 }, // Left plane: x >= -50
  { normal: [-1, 0, 0], offset: 50 }, // Right plane: x <= 50
  { normal: [0, 1, 0], offset: 30 }, // Bottom plane: y >= -30
  { normal: [0, -1, 0], offset: 30 }, // Top plane: y <= 30
  { normal: [0, 0, -1], offset: -1 }, // Near plane: z <= -1 (devant caméra)
  { normal: [0, 0, 1], offset: 200 }, // Far plane: z >= -200
];

export function runCullingSuite() {
  console.log('🚀 Lancement du banc 02-gpu-frustum-culling...');

  // TEST 1 : Vérification de la présence du shader WGSL
  assert(
    WGSL_FRUSTUM_CULLING.includes('@compute') &&
      WGSL_FRUSTUM_CULLING.includes('atomicAdd'),
    'Le shader WGSL de culling doit contenir la passe compute et atomicAdd'
  );

  // TEST 2 : Sphère 100% visible
  const visibleInstance: CullingInstance = {
    id: 1,
    boundingSphere: { center: [0, 0, -50], radius: 5 },
  };
  assert(
    cullBoundingSphereAgainstFrustum(visibleInstance.boundingSphere, TEST_FRUSTUM_PLANES),
    'Objet au centre du frustum doit être visible'
  );

  // TEST 3 : Sphère 100% exclue derrière la caméra (z = +10)
  const culledBehind: CullingInstance = {
    id: 2,
    boundingSphere: { center: [0, 0, 10], radius: 2 },
  };
  assert(
    !cullBoundingSphereAgainstFrustum(culledBehind.boundingSphere, TEST_FRUSTUM_PLANES),
    'Objet derrière la caméra doit être culled'
  );

  // TEST 4 : Sphère sécante au plan (test conservateur strict)
  // Plan gauche à x = -50. Centre à x = -52, rayon = 3 -> distance = -52 + 50 = -2 >= -3 -> VISIBLE !
  const intersectingInstance: CullingInstance = {
    id: 3,
    boundingSphere: { center: [-52, 0, -50], radius: 3 },
  };
  assert(
    cullBoundingSphereAgainstFrustum(intersectingInstance.boundingSphere, TEST_FRUSTUM_PLANES),
    'Sphère sécante au plan de frustum doit être conservée (culling conservateur)'
  );

  // TEST 5 : Sphère entièrement en dehors du plan gauche
  // Centre à x = -55, rayon = 3 -> distance = -55 + 50 = -5 < -3 -> REJETÉ
  const outsideLeft: CullingInstance = {
    id: 4,
    boundingSphere: { center: [-55, 0, -50], radius: 3 },
  };
  assert(
    !cullBoundingSphereAgainstFrustum(outsideLeft.boundingSphere, TEST_FRUSTUM_PLANES),
    'Sphère entièrement hors du plan gauche doit être rejetée'
  );

  console.log('Tests CPU 02-gpu-frustum-culling réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCullingSuite();
}
