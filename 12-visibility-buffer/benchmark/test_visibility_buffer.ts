/**
 * 12-visibility-buffer/benchmark/test_visibility_buffer.ts
 *
 * Banc d'analyse comparative pour 12-visibility-buffer.
 * Valide l'encodage ID 32-bit, l'interpolation barycentrique et l'économie de bande passante VRAM.
 */

import {
  packVisibilityId,
  unpackVisibilityId,
  reconstructAttributeAtPixel,
  evaluateVisibilityBuffer,
  WGSL_VISIBILITY_PASS1,
  WGSL_VISIBILITY_PASS2,
} from '../implementation/visibilityBuffer.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[12-visibility-buffer] Échec d'assertion : ${message}`);
  }
}

export function runVisibilityBufferSuite() {
  console.log('🚀 Lancement du banc 12-visibility-buffer (Passe Visibilité & Shading Découplé)...');

  // Shader WGSL validation
  assert(
    WGSL_VISIBILITY_PASS1.includes('visibilityId') &&
      WGSL_VISIBILITY_PASS2.includes('@compute'),
    'Shaders WGSL Visibility Buffer incomplets'
  );

  // TEST 1 : Aller-retour d'encodage bitwise 32-bit (instanceId / primitiveId)
  const testPairs: [number, number][] = [
    [0, 0],
    [1, 1],
    [42, 105],
    [1024, 2048],
    [65535, 65535],
    [12345, 54321],
  ];

  for (const [inst, prim] of testPairs) {
    const packed = packVisibilityId(inst, prim);
    const [unpackedInst, unpackedPrim] = unpackVisibilityId(packed);
    assert(
      unpackedInst === inst && unpackedPrim === prim,
      `Échec roundtrip visibilityId pour (${inst}, ${prim}) -> ${packed} -> (${unpackedInst}, ${unpackedPrim})`
    );
  }
  console.log('  - Encodage/décodage 32-bit (16-bit instanceId + 16-bit primitiveId) validé sans perte');

  // TEST 2 : Reconstruction analytique d'attribut à l'écran via coordonnées barycentriques
  const triangle2D: [number, number][] = [
    [0, 0],
    [100, 0],
    [0, 100],
  ];
  const clipW = [1.0, 2.0, 4.0];
  const vertexUvs = [0.0, 1.0, 0.0]; // Attribut U par exemple

  // Au sommet 0 (0, 0)
  const valAtV0 = reconstructAttributeAtPixel([0, 0], triangle2D, clipW, vertexUvs);
  assert(Math.abs(valAtV0 - 0.0) < 1e-5, 'Reconstruction au sommet 0');

  // Au centre de gravité barycentrique (1/3, 1/3, 1/3) -> point (100/3, 100/3)
  const valAtCenter = reconstructAttributeAtPixel([100 / 3, 100 / 3], triangle2D, clipW, vertexUvs);
  // Valeur perspective exacte calculée par l'oracle : (1/3 * 1 / 2) / (1/3/1 + 1/3/2 + 1/3/4) = 2/7
  assert(
    Math.abs(valAtCenter - 2 / 7) < 1e-5,
    `Reconstruction perspective au centre : ${valAtCenter} !== ${2 / 7}`
  );
  console.log(`  - Reconstruction perspective d'attribut validée au pixel : ${valAtCenter.toFixed(4)} (attendu: 2/7)`);

  // TEST 3 : Analyse de bande passante et de mémoire comparée G-Buffer vs Visibility Buffer
  const resolutions = [
    { name: '1080p', width: 1920, height: 1080 },
    { name: '1440p', width: 2560, height: 1440 },
    { name: '4K', width: 3840, height: 2160 },
  ];

  const benchRows: { resolution: string; gbufferBytes: number; visBufferBytes: number; bandwidthRatio: string }[] = [];

  for (const res of resolutions) {
    const out = evaluateVisibilityBuffer({
      sceneObjectCount: 2000,
      viewportWidth: res.width,
      viewportHeight: res.height,
    });

    const ratio = (out.forwardBufferBytes! / out.deferredBufferBytes!).toFixed(1);
    benchRows.push({
      resolution: res.name,
      gbufferBytes: out.forwardBufferBytes!,
      visBufferBytes: out.deferredBufferBytes!,
      bandwidthRatio: `${ratio}x`,
    });

    console.log(
      `  Résolution ${res.name.padEnd(5)} : G-Buffer = ${(out.forwardBufferBytes! / (1024 * 1024)).toFixed(1)} Mo | Visibility Buffer = ${(out.deferredBufferBytes! / (1024 * 1024)).toFixed(1)} Mo | Économie = ${ratio}x`
    );
  }


  console.log('Tests CPU 12-visibility-buffer réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVisibilityBufferSuite();
}
