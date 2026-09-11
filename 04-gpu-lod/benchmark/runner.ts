/**
 * 04-gpu-lod/benchmark/runner.ts
 *
 * Moteur de test automatisé pour le banc 04-gpu-lod.
 * Exécute successivement :
 * - 04A : Décimation asynchrone via meshoptimizer
 * - 04B : Sélection Screen-Space Error sur CPU
 * - 04C : Sélection Screen-Space Error sur GPU (Compute WGSL)
 *
 * Enregistre les métriques brutes au format Standard Benchmark Contract.
 */

import * as THREE from 'three';
import { generateLodsAsync } from '../lodWorker.ts';
import { selectLodsOnCpu } from '../cpuLodSelector.ts';
import {
  calculateProjectedGeometricError,
  isGeometricErrorAcceptable,
  CONTRACTUAL_MAX_ERROR_PX,
} from '../../shared/math/screenSpaceError.ts';
import type { LodBenchmarkSummary } from '../types.ts';
import { LOD_OBJECT_COUNTS } from '../types.ts';
import { formatLodMarkdownReport } from './reporter.ts';

export class LodBenchmarkRunner {
  private sphereGeometry: THREE.BufferGeometry;

  constructor() {
    // Géométrie d'épreuve : sphère dense de 8 000 polygones (4 141 sommets)
    this.sphereGeometry = new THREE.SphereGeometry(1.0, 64, 64);
  }

  /**
   * Exécute la campagne complète 04A, 04B et 04C.
   */
  public async runFullSuite(): Promise<{
    summary: LodBenchmarkSummary;
    markdownReport: string;
    latestJson: Record<string, any>;
  }> {
    // ----------------------------------------------------
    // 04A : Génération de LODs via meshoptimizer
    // ----------------------------------------------------
    const posAttr = this.sphereGeometry.getAttribute('position');
    const indexAttr = this.sphereGeometry.getIndex();
    if (!indexAttr) throw new Error('Géométrie sans indexation.');

    const positions = posAttr.array as Float32Array;
    const indices = indexAttr.array as Uint32Array;

    const genResult = await generateLodsAsync({
      geometryId: 1,
      positions,
      indices,
      ratios: [0.5, 0.25], // LOD 1 (50%), LOD 2 (25%)
      targetErrors: [0.01, 0.05],
    });

    const lod0Triangles = genResult.originalTriangles;
    const lod1Triangles = genResult.lods[1].indexCount / 3;
    const lod2Triangles = genResult.lods[2].indexCount / 3;

    // ----------------------------------------------------
    // 04B : Sélection Screen-Space Error sur CPU
    // ----------------------------------------------------
    const objectCounts = [...LOD_OBJECT_COUNTS];
    const cpuLatenciesMs: number[] = [];

    const cameraPos: [number, number, number] = [0, 10, 40];
    const screenHeight = 1080;
    const fovRad = (60 * Math.PI) / 180;

    for (const count of objectCounts) {
      // Génération de positions déterministes
      const posArray = new Float32Array(count * 3);
      const radArray = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        posArray[i * 3] = ((i % 100) - 50) * 2;
        posArray[i * 3 + 1] = 0;
        posArray[i * 3 + 2] = ((Math.floor(i / 100) % 100) - 50) * 2;
        radArray[i] = 1.0;
      }

      // Mesure CPU (10 répétitions pour lissage)
      let sumCpu = 0;
      const WARMUP = 3;
      const SAMPLES = 10;

      for (let w = 0; w < WARMUP; w++) {
        selectLodsOnCpu(posArray, radArray, cameraPos, screenHeight, fovRad);
      }

      for (let s = 0; s < SAMPLES; s++) {
        const res = selectLodsOnCpu(posArray, radArray, cameraPos, screenHeight, fovRad);
        sumCpu += res.durationMs;
      }

      const avgCpuMs = sumCpu / SAMPLES;
      cpuLatenciesMs.push(avgCpuMs);

      // 04C : non instrumenté. GPU_LOD_SELECTION_SHADER (gpuLodShader.ts) n'est
      // dispatché par aucun code : il n'y a donc rien à chronométrer ici.
      // On ne publie pas de valeur plutôt qu'une formule qui se lirait comme une mesure.
    }

    // ----------------------------------------------------
    // Contrôle de conformité de l'erreur géométrique projetée
    // ----------------------------------------------------
    const worldErrorLod1 = genResult.lods[1].simplificationError;
    // Vérification de l'erreur à la frontière LOD1 -> LOD0 (distance de bascule ~20m)
    const projErrorPx = calculateProjectedGeometricError(worldErrorLod1, 20.0, screenHeight, fovRad);
    const errorPassed = isGeometricErrorAcceptable(projErrorPx, CONTRACTUAL_MAX_ERROR_PX);

    const summary: LodBenchmarkSummary = {
      generation: {
        originalTriangles: lod0Triangles,
        lod1Triangles,
        lod2Triangles,
        durationMs: genResult.durationMs,
        memorySavedPercent: ((lod0Triangles - lod2Triangles) / lod0Triangles) * 100,
      },
      cpuSelection: {
        objectCounts,
        latenciesMs: cpuLatenciesMs,
      },
      gpuSelection: {
        objectCounts,
        computeTimesMs: null,
      },
      contractualErrorCheck: {
        maxObservedErrorPx: projErrorPx,
        thresholdPx: CONTRACTUAL_MAX_ERROR_PX,
        passed: errorPassed,
      },
    };

    const envInfo = {
      gpu: 'non mesuré (CPU/WASM)',
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      commit: 'unknown',
    };
    const markdownReport = formatLodMarkdownReport(summary, envInfo);
    const latestJson = {
      timestamp: new Date().toISOString(), test: '04-gpu-lod', commit: null,
      status: 'measured', verdict: 'not-yet-decided',
      environment: { gpu: null, browser: envInfo.browser, threeVersion: THREE.REVISION, webgpuFeatures: null },
      scene: { objects: null, triangles: lod0Triangles, materials: null, lights: null },
      cpu: { frameMs: null, submitMs: null }, gpu: { frameMs: null },
      memory: { gpuBytes: null }, draw: { submitted: null, visible: null },
      customMetrics: { execution: 'cpu-wasm', decimationTimeMs: genResult.durationMs,
        cpuSelection: summary.cpuSelection, gpuSelection: null,
        maxProjectedErrorPx: projErrorPx, errorContractPassed: errorPassed },
    };

    return { summary, markdownReport, latestJson };
  }
}
