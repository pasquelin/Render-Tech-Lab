/**
 * 10-material-batching/benchmark/test_material_batching.ts
 *
 * Banc de test et d'arbitrage pour 10-material-batching.
 * Compare les 4 stratégies de gestion multi-matériaux (state-switch vs storage-buffer vs texture-array vs pseudo-bindless).
 */

import {
  generateMaterialPalette,
  packMaterialStorageBuffer,
  evaluateBatchingStrategy,
  BYTES_PER_MATERIAL,
  WGSL_MATERIAL_STORAGE_BUFFER,
} from '../implementation/materialBatcher.ts';
import type {
  MaterialBatchingStrategy,
  BatchingOutput,
} from '../types.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[10-material-batching] Échec d'assertion : ${message}`);
  }
}

export function runMaterialBatchingSuite() {
  console.log('🚀 Lancement du banc 10-material-batching (4 Stratégies Matériaux)...');

  // Shader WGSL validation
  assert(
    WGSL_MATERIAL_STORAGE_BUFFER.includes('array<MaterialData>'),
    'Shader WGSL Material Storage Buffer incomplet'
  );

  // TEST 1 : Validation de l'encodage binaire des matériaux (32 octets / 8 floats)
  const palette100 = generateMaterialPalette(100);
  assert(palette100.length === 100, 'Doit générer 100 matériaux distincts');

  const packedBuffer = packMaterialStorageBuffer(palette100);
  assert(
    packedBuffer.byteLength === 100 * BYTES_PER_MATERIAL,
    `Taille buffer invalide : ${packedBuffer.byteLength} !== ${100 * BYTES_PER_MATERIAL}`
  );

  // Vérification du premier matériau
  assert(
    Math.abs(packedBuffer[0] - palette100[0].albedo[0]) < 1e-5,
    'Albedo rouge non concordant dans le buffer empaqueté'
  );
  assert(
    Math.abs(packedBuffer[4] - palette100[0].roughness) < 1e-5,
    'Rugosité non concordante dans le buffer empaqueté'
  );

  console.log('  - Encodage binaire MaterialBuffer validé (32 octets par matériau, alignement vec4)');

  // TEST 2 : Comparaison des stratégies sous charge multi-matériaux
  const strategies: MaterialBatchingStrategy[] = [
    'state-switch',
    'storage-buffer',
    'texture-array',
    'pseudo-bindless',
  ];

  const materialCounts = [1, 10, 50, 100, 500];
  const objectCount = 2000;
  const benchmarkMatrix: BatchingOutput[] = [];

  for (const mCount of materialCounts) {
    console.log(`  Palier M = ${mCount} matériaux uniques sur ${objectCount} objets :`);
    for (const strat of strategies) {
      const out = evaluateBatchingStrategy({
        objects: objectCount,
        materialCount: mCount,
        strategy: strat,
      });

      console.log(
        `    - [${strat.padEnd(16)}] : Switches Pipeline = ${String(out.pipelineStateChanges).padStart(3)} | CPU Frame = ${out.cpuFrameMs} ms | VRAM Table = ${out.materialTableBytes} o`
      );

      benchmarkMatrix.push(out);
    }
  }

  // Vérification de la supériorité du storage buffer à M=100
  const stateSwitch100 = benchmarkMatrix.find(
    (r) => r.strategy === 'state-switch' && r.materialCount === 100
  )!;
  const storageBuffer100 = benchmarkMatrix.find(
    (r) => r.strategy === 'storage-buffer' && r.materialCount === 100
  )!;

  assert(
    stateSwitch100.pipelineStateChanges === 100,
    'State switch doit forcer 100 changements de pipeline'
  );
  assert(
    storageBuffer100.pipelineStateChanges === 1,
    'Storage buffer doit maintenir 1 seul changement de pipeline'
  );
  assert(
    storageBuffer100.cpuFrameMs === null && stateSwitch100.cpuFrameMs === null,
    'Aucune durée CPU ne peut être déduite des changements d’état'
  );

  console.log('Tests CPU 10-material-batching réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMaterialBatchingSuite();
}
