/**
 * 04-gpu-lod/cpuLodSelector.ts
 *
 * 04B : Sélecteur Screen-Space Error (SSE) sur CPU.
 * Évalue la taille projetée et affecte le palier LOD pour chaque objet.
 *
 * Sert de baseline contractuelle pour mesurer si la sélection GPU (04C)
 * apporte un gain net justifiant la complexité d'un compute shader dédié.
 */

import {
  calculateScreenSpacePixels,
  evaluateLodTier,
  DEFAULT_LOD_THRESHOLDS,
  type LodThresholds,
} from '../shared/math/screenSpaceError.ts';

export interface CpuLodSelectionResult {
  lodCounts: [number, number, number]; // [LOD0, LOD1, LOD2]
  durationMs: number;
  selectedLods: Uint8Array;
}

/**
 * Exécute la sélection continue de LOD sur CPU pour un ensemble d'instances.
 *
 * @param positions Array de positions à plat [x0, y0, z0, x1, y1, z1, ...]
 * @param radii Array de rayons englobants [r0, r1, ...]
 * @param cameraPos Position de la caméra [cx, cy, cz]
 * @param screenHeight Hauteur physique/logique du viewport en pixels
 * @param fovRad Champ de vision vertical en radians
 * @param thresholds Seuils de bascule (défaut: 250 px, 60 px)
 * @returns Résultat de la sélection (distribution et latence CPU)
 */
export function selectLodsOnCpu(
  positions: Float32Array,
  radii: Float32Array,
  cameraPos: [number, number, number],
  screenHeight: number,
  fovRad: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS
): CpuLodSelectionResult {
  const tStart = performance.now();
  const count = radii.length;
  const selectedLods = new Uint8Array(count);
  const lodCounts: [number, number, number] = [0, 0, 0];

  const [cx, cy, cz] = cameraPos;

  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const diameter = radii[i] * 2;
    const projectedPixels = calculateScreenSpacePixels(diameter, distance, screenHeight, fovRad);

    const tier = evaluateLodTier(projectedPixels, thresholds);
    selectedLods[i] = tier;
    lodCounts[tier]++;
  }

  const durationMs = performance.now() - tStart;

  return {
    lodCounts,
    durationMs,
    selectedLods,
  };
}
