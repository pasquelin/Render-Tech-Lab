/**
 * 04-gpu-lod/lodWorker.ts
 *
 * Web Worker de décimation géométrique asynchrone hors du thread UI.
 * Intègre la bibliothèque industrielle `meshoptimizer` (MeshoptSimplifier).
 *
 * Invariant d'architecture n° 6 : Tout calcul lourd s'exécute hors du thread UI
 * avec tampons transférables (`Transferable ArrayBuffer`).
 */

import { MeshoptSimplifier } from 'meshoptimizer';
import type { LodGenerationRequest, LodGenerationResult, LodLevelData } from './types.ts';

/**
 * Fonction pure asynchrone de génération des niveaux de détail géométriques.
 * Utilisable en Web Worker comme en appel direct (Node / tests).
 */
export async function generateLodsAsync(
  request: LodGenerationRequest
): Promise<LodGenerationResult> {
  const tStart = performance.now();
  await MeshoptSimplifier.ready;

  const { geometryId, positions, indices, ratios } = request;
  const targetErrors = request.targetErrors || ratios.map(() => 0.05);

  const lods: LodLevelData[] = [
    // LOD 0 : maillage d'origine intact (100%)
    {
      tier: 0,
      ratio: 1.0,
      indices: new Uint32Array(indices),
      indexCount: indices.length,
      simplificationError: 0.0,
    },
  ];

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    const targetCount = Math.floor(indices.length * ratio);
    const targetError = targetErrors[i] ?? 0.05;

    // Décimation via meshoptimizer : indices, positions, stride=3, targetCount, targetError
    const [simplified, error] = MeshoptSimplifier.simplify(
      indices,
      positions,
      3,
      targetCount,
      targetError
    );

    lods.push({
      tier: i + 1,
      ratio,
      indices: simplified,
      indexCount: simplified.length,
      simplificationError: error,
    });
  }

  const durationMs = performance.now() - tStart;

  return {
    geometryId,
    originalTriangles: indices.length / 3,
    lods,
    durationMs,
  };
}

// Branchement Web Worker (navigateur)
if (typeof self !== 'undefined' && 'postMessage' in self && typeof (self as any).importScripts === 'function') {
  self.onmessage = async (e: MessageEvent<LodGenerationRequest>) => {
    try {
      const result = await generateLodsAsync(e.data);
      // Transfert direct des buffers de chaque niveau LOD sans copie mémoire
      const transferables: ArrayBuffer[] = result.lods
        .map((l) => l.indices.buffer)
        .filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);

      (self as any).postMessage({ type: 'LOD_SUCCESS', result }, transferables);
    } catch (err: any) {
      (self as any).postMessage({ type: 'LOD_ERROR', error: err.message });
    }
  };
}
