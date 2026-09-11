/**
 * 07-hiz/benchmark/test_hiz.ts
 *
 * Banc de test et d'analyse de performance pour 07-hiz (Hi-Z Depth Pyramid).
 * Valide la construction récursive conservatrice, la mémoire VRAM et les requêtes d'occlusion.
 */

import {
  buildHiZPyramid,
  queryHiZ,
  WGSL_HIZ_REDUCE,
} from '../implementation/hizPyramid.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[07-hiz] Échec d'assertion : ${message}`);
  }
}

export function runHiZSuite() {
  console.log('🚀 Lancement du banc 07-hiz (Hierarchical-Z Depth Pyramid)...');

  // Shader validation
  assert(
    WGSL_HIZ_REDUCE.includes('@compute') &&
      WGSL_HIZ_REDUCE.includes('textureStore'),
    'Shader WGSL Hi-Z incomplet'
  );

  // TEST 1 : Pyramide sur résolution non-puissance-de-2 (1920x1080)
  // Simulation d'une scène avec un mur occludeur au centre (depth = 0.3) et le fond (depth = 1.0)
  const baseW = 128;
  const baseH = 72; // Version miniature proportionnelle à 1920x1080 pour exécution rapide
  const baseDepth: number[][] = [];

  for (let y = 0; y < baseH; y++) {
    const row: number[] = [];
    for (let x = 0; x < baseW; x++) {
      // Mur occludeur au centre : [30..90, 20..50] à depth 0.35, reste à 1.0 (ciel)
      if (x >= 30 && x <= 90 && y >= 20 && y <= 50) {
        row.push(0.35);
      } else {
        row.push(1.0);
      }
    }
    baseDepth.push(row);
  }

  const pyramidData = buildHiZPyramid(baseDepth, false, 'r32float');
  const { pyramid, cost } = pyramidData;

  console.log(
    `  - Pyramide construite : ${baseW}x${baseH} -> ${pyramid.depth} mips | VRAM = ${cost.totalBytes} octets | Temps = ${cost.generationMs} ms`
  );

  // Invariant 1 : Le dernier mip doit être 1x1
  const lastMip = pyramid.mips[pyramid.depth - 1];
  assert(
    lastMip.width === 1 && lastMip.height === 1,
    `Le dernier mip doit converger vers 1x1 (observé ${lastMip.width}x${lastMip.height})`
  );

  // Invariant 2 : Conservation conservatrice stricte du max
  // Le mip 1x1 doit valoir 1.0 car le fond (1.0) est présent
  const lastBuffer = pyramidData.mipBuffers[pyramid.depth - 1];
  assert(
    Math.abs(lastBuffer[0] - 1.0) < 1e-5,
    'La valeur racine de la pyramide doit refléter le max absolu du buffer (1.0)'
  );

  // Invariant 3 : Ratio géométrique de mémoire de la pyramide (approx 4/3 de la base)
  const baseBytes = baseW * baseH * 4;
  const theoreticalMaxBytes = baseBytes * 1.34;
  assert(
    cost.totalBytes! <= theoreticalMaxBytes,
    `Overhead mémoire excessif (${cost.totalBytes} vs limite ${theoreticalMaxBytes})`
  );

  // TEST 2 : Requêtes d'occlusion hiérarchique
  // Objet A : Au centre derrière le mur occludeur (profondeur 0.7 > mur 0.35)
  const boxBehind = { x0: 50, y0: 30, x1: 60, y1: 40 };
  const queryBehind = queryHiZ(pyramidData, boxBehind, 0.7, false);
  console.log(
    `  - Requête A (derrière occludeur) : occlus=${queryBehind.occluded} (mip level ${queryBehind.mipLevel})`
  );
  // Note : dans le mur, la profondeur max est 0.35, notre objet est à 0.7 -> occlus
  assert(queryBehind.occluded, 'L objet derrière le mur occludeur doit être déclaré occlus');

  // Objet B : Au centre devant le mur occludeur (profondeur 0.2 < mur 0.35)
  const queryInFront = queryHiZ(pyramidData, boxBehind, 0.2, false);
  console.log(
    `  - Requête B (devant occludeur) : occlus=${queryInFront.occluded} (mip level ${queryInFront.mipLevel})`
  );
  assert(!queryInFront.occluded, 'L objet devant le mur ne doit PAS être occlus');

  console.log('Tests CPU 07-hiz réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHiZSuite();
}
