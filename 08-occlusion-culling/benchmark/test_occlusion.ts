/**
 * 08-occlusion-culling/benchmark/test_occlusion.ts
 *
 * Banc de test et benchmark de l'équation de gain net pour 08-occlusion-culling.
 * Valide les scénarios de stress contractuels : 10%, 25%, 50%, 75%, 90%, 99% d'occlusion.
 */

import { buildHiZPyramid } from '../../07-hiz/implementation/hizPyramid.ts';
import {
  cullMeshletsByOcclusion,
  evaluateOcclusionGain,
  type ScreenMeshlet,
} from '../implementation/occlusionCuller.ts';
import type { Meshlet } from '../../05-meshlets/types.ts';
import type { OcclusionGainEquation } from '../types.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[08-occlusion-culling] Échec d'assertion : ${message}`);
  }
}

export function runOcclusionSuite() {
  console.log('🚀 Lancement du banc 08-occlusion-culling (Frustum + Hi-Z & Gain Net)...');

  // Construction d'un tampon Hi-Z avec un occludeur rectangulaire couvrant 50% de la surface
  const w = 128;
  const h = 72;
  const depthBuffer: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      // Occludeur à gauche [0..64, 0..72] à depth 0.3, fond à droite à depth 1.0
      row.push(x < 64 ? 0.3 : 1.0);
    }
    depthBuffer.push(row);
  }
  const hiZData = buildHiZPyramid(depthBuffer, false);

  // TEST 1 : Vérification d'occlusion géométrique sur un lot de meshlets synthétiques
  const dummyMeshlet = (_id: number): Meshlet => ({
    boundingSphere: { center: [0, 0, 0], radius: 1 },
    normalCone: { apex: [0, 0, 0], axis: [0, 0, 1], cosHalfAngle: 0.5 },
    vertexOffset: 0,
    vertexCount: 64,
    indexOffset: 0,
    indexCount: 384,
    triangleCount: 128,
  });

  const testMeshlets: ScreenMeshlet[] = [
    // 4 meshlets derrière l'occludeur (x < 64, depth = 0.8 > 0.3) -> occlus
    { meshlet: dummyMeshlet(1), screenBox: { x0: 10, y0: 10, x1: 20, y1: 20 }, depth: 0.8 },
    { meshlet: dummyMeshlet(2), screenBox: { x0: 30, y0: 10, x1: 40, y1: 20 }, depth: 0.8 },
    { meshlet: dummyMeshlet(3), screenBox: { x0: 10, y0: 30, x1: 20, y1: 40 }, depth: 0.8 },
    { meshlet: dummyMeshlet(4), screenBox: { x0: 30, y0: 30, x1: 40, y1: 40 }, depth: 0.8 },
    // 4 meshlets dans la zone ouverte (x > 64, depth = 0.8 < 1.0) -> visibles
    { meshlet: dummyMeshlet(5), screenBox: { x0: 70, y0: 10, x1: 80, y1: 20 }, depth: 0.8 },
    { meshlet: dummyMeshlet(6), screenBox: { x0: 90, y0: 10, x1: 100, y1: 20 }, depth: 0.8 },
    { meshlet: dummyMeshlet(7), screenBox: { x0: 70, y0: 30, x1: 80, y1: 40 }, depth: 0.8 },
    { meshlet: dummyMeshlet(8), screenBox: { x0: 90, y0: 30, x1: 100, y1: 40 }, depth: 0.8 },
  ];

  const occResult = cullMeshletsByOcclusion(testMeshlets, hiZData, false);
  console.log(
    `  - Test géométrique : ${occResult.totalMeshlets} soumis -> ${occResult.visibleMeshlets.length} visibles, ${occResult.occludedMeshlets.length} occlus (${(occResult.occlusionRejectRate * 100).toFixed(0)}%)`
  );

  assert(occResult.occludedMeshlets.length === 4, '4 meshlets derrière l occludeur doivent être rejetés');
  assert(occResult.visibleMeshlets.length === 4, '4 meshlets dans la zone ouverte doivent être conservés');

  // TEST 2 : Évaluation des 6 scénarios de stress de l'Équation de Gain Net
  const stressTiers = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99];
  const totalTriangles = 1_000_000; // 1 million de triangles dans la scène
  const gainReports: { occlusionPercent: number; equation: OcclusionGainEquation; verdict: string }[] = [];

  for (const rate of stressTiers) {
    const eq = evaluateOcclusionGain({
      totalTriangles,
      occlusionRate: rate,
      rasterCostPerKTriMs: 0.005,
      baselineSubmitMs: 3.35, // Baseline S3
      hiZGenerationMs: 0.15,
      cullingMs: 0.08,
    });

    const verdict = eq.gainNet! > 2.0 ? 'INTEGRATE' : eq.gainNet! > 0 ? 'WATCHLIST' : 'REJECT';
    gainReports.push({
      occlusionPercent: Math.round(rate * 100),
      equation: eq,
      verdict,
    });

    console.log(
      `  Stress ${(rate * 100).toFixed(0).padStart(2)}% occlusion : Baseline = ${eq.baselineCost} ms | Hi-Z + Culling + Raster = ${(eq.hiZGenerationCost! + eq.cullingCost! + eq.rasterCost!).toFixed(3)} ms | Gain Net = +${eq.gainNet} ms -> ${verdict}`
    );
  }

  // Vérification de la rentabilité croissante avec l'occlusion
  const tier10 = gainReports.find((r) => r.occlusionPercent === 10)!;
  const tier90 = gainReports.find((r) => r.occlusionPercent === 90)!;
  assert(
    tier90.equation.gainNet! > tier10.equation.gainNet!,
    'Le gain net doit être strictement supérieur à 90% d occlusion vs 10%'
  );

  console.log('Tests CPU 08-occlusion-culling réussis — aucune mesure GPU ni export de campagne.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOcclusionSuite();
}
