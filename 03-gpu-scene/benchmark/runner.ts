import { TimestampBatch } from '../../shared/gpu/timing.ts';
import { runFrames } from '../../shared/benchmark/comparison.ts';
import * as THREE from 'three';
import { generateStressScene } from './stressScenarios.ts';
import { ClassicMultiMeshScene } from '../baseline/classicMultiMeshScene.ts';
import { GPUSceneRenderer } from '../implementation/gpuSceneRenderer.ts';
import type { SceneStressConfig, GpuSceneBenchResult } from '../types.ts';
import { getSharedDevice, getSharedGLRenderer } from '../../src/common/gpuContext.ts';

/** Mesures d'une frame rendue. */
export interface FrameSample {
  submitMs: number;
  drawCalls: number;
  cpuFrameMs: number;
}

/** Matrice 4D complète : campagne standard du module. */
export const FULL_MATRIX: SceneStressConfig[] = [
  // Dimension A : Diversité géométrique
  { name: 'Dim A : 1 topologie', dimension: 'A-geometry', objectCount: 2000, geometryCount: 1, materialCount: 10, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim A : 10 topologies', dimension: 'A-geometry', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim A : 50 topologies', dimension: 'A-geometry', objectCount: 2000, geometryCount: 50, materialCount: 10, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim A : 100 topologies', dimension: 'A-geometry', objectCount: 2000, geometryCount: 100, materialCount: 10, dynamicRatio: 0, targetVisibility: 1 },

  // Dimension B : Diversité matériaux
  { name: 'Dim B : 1 matériau', dimension: 'B-material', objectCount: 2000, geometryCount: 10, materialCount: 1, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim B : 10 matériaux', dimension: 'B-material', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim B : 50 matériaux', dimension: 'B-material', objectCount: 2000, geometryCount: 10, materialCount: 50, dynamicRatio: 0, targetVisibility: 1 },
  { name: 'Dim B : 100 matériaux', dimension: 'B-material', objectCount: 2000, geometryCount: 10, materialCount: 100, dynamicRatio: 0, targetVisibility: 1 },

  // Dimension C : Dynamique
  { name: 'Dim C : 0% dynamique', dimension: 'C-dynamic', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0.0, targetVisibility: 1 },
  { name: 'Dim C : 25% dynamique', dimension: 'C-dynamic', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0.25, targetVisibility: 1 },
  { name: 'Dim C : 50% dynamique', dimension: 'C-dynamic', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0.50, targetVisibility: 1 },
  { name: 'Dim C : 100% dynamique', dimension: 'C-dynamic', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 1.0, targetVisibility: 1 },
];

/** Montée en topologies distinctes : campagne « douleur » du module. */
export const PAIN_MATRIX: SceneStressConfig[] = [
  { name: '10 topologies', dimension: 'A-geometry', objectCount: 2000, geometryCount: 10, materialCount: 10, dynamicRatio: 0.1, targetVisibility: 1 },
  { name: '100 topologies', dimension: 'A-geometry', objectCount: 2000, geometryCount: 100, materialCount: 10, dynamicRatio: 0.1, targetVisibility: 1 },
  { name: '500 topologies', dimension: 'A-geometry', objectCount: 5000, geometryCount: 500, materialCount: 50, dynamicRatio: 0.1, targetVisibility: 1 },
  { name: '1 000 topologies', dimension: 'A-geometry', objectCount: 10000, geometryCount: 1000, materialCount: 100, dynamicRatio: 0.1, targetVisibility: 1 },
];

export class GPUSceneBenchmarkRunner {
  private device: GPUDevice | null = null;
  private canvasWebGpu: HTMLCanvasElement;
  private canvasWebGL: HTMLCanvasElement;

  private classicScene: ClassicMultiMeshScene | null = null;
  private gpuSceneRenderer: GPUSceneRenderer | null = null;
  private camera: THREE.PerspectiveCamera;

  public currentMode: 'classic' | 'gpu-scene' = 'gpu-scene';
  public currentConfig: SceneStressConfig;
  private isBenchmarking: boolean = false;

  // Callbacks de progression et métriques
  public onProgress?: (msg: string, percent: number) => void;
  public onResult?: (result: GpuSceneBenchResult) => void;
  public onMetricsUpdate?: (measurement: { submitMs: number; cpuFrameMs: number; fps: number | null; drawCalls: number }, mode: string, count: number) => void;
  private readonly measurement = { submitMs: 0, cpuFrameMs: 0, fps: null as number | null, drawCalls: 0 };
  private readonly emptyMeasurement = { submitMs: 0, drawCalls: 0 };
  private lastFrameTime: number = 0;

  constructor(canvasWebGpu: HTMLCanvasElement, canvasWebGL: HTMLCanvasElement) {
    this.canvasWebGpu = canvasWebGpu;
    this.canvasWebGL = canvasWebGL;

    this.camera = new THREE.PerspectiveCamera(60, 1.0, 0.1, 1000);
    this.camera.position.set(0, 30, 85);

    this.currentConfig = {
      name: 'Initial Tier',
      dimension: 'A-geometry',
      objectCount: 2000,
      geometryCount: 10,
      materialCount: 10,
      dynamicRatio: 0.1,
      targetVisibility: 1.0,
    };
  }

  public async init(): Promise<boolean> {
    // Device partagé avec les autres modules : deux devices sur un même canvas
    // reconfigureraient le contexte et casseraient le module précédent.
    this.device = await getSharedDevice();
    if (!this.device) return false;

    if (!this.device.features.has('indirect-first-instance')) {
      console.error(
        "[02-gpu-scene] La feature WebGPU 'indirect-first-instance' est requise " +
          'pour le tir indirect multi-topologies et absente sur cet adaptateur.'
      );
      return false;
    }

    this.gpuSceneRenderer = new GPUSceneRenderer(this.device, this.canvasWebGpu);
    this.classicScene = new ClassicMultiMeshScene(getSharedGLRenderer(this.canvasWebGL), this.canvasWebGL);

    await this.applyConfig(this.currentConfig);
    return true;
  }

  public async applyConfig(config: SceneStressConfig) {
    this.currentConfig = config;
    const sceneData = generateStressScene(config);

    if (this.gpuSceneRenderer) {
      this.gpuSceneRenderer.setScene(sceneData);
    }
    if (this.classicScene) {
      this.classicScene.populate(sceneData.threeMeshes);
    }
  }

  public setMode(mode: 'classic' | 'gpu-scene') {
    this.currentMode = mode;
    if (mode === 'classic') {
      this.canvasWebGL.style.display = 'block';
      this.canvasWebGpu.style.display = 'none';
    } else {
      this.canvasWebGpu.style.display = 'block';
      this.canvasWebGL.style.display = 'none';
    }
  }

  /**
   * Frame pilotée par la boucle d'animation de l'application.
   * Neutralisée pendant une campagne : sinon le rAF et la boucle de mesure
   * soumettent chacun une frame, ce qui double le travail GPU mesuré et fait
   * sauter la caméra entre deux temps différents dans la même frame.
   */
  public renderTick(time: number): FrameSample | null {
    if (this.isBenchmarking) return null;
    return this.renderFrame(time);
  }

  /** Rendu effectif d'une frame, appelé par le rAF comme par la boucle de mesure. */
  private renderFrame(time: number, timer?: TimestampBatch, sample = 0): FrameSample {
    const tStart = performance.now();

    // Rotation orbitale douce de la caméra
    const radius = 90;
    const angle = time * 0.0003;
    this.camera.position.x = Math.sin(angle) * radius;
    this.camera.position.z = Math.cos(angle) * radius;
    this.camera.position.y = 35 + Math.sin(angle * 2) * 10;
    this.camera.lookAt(0, 0, 0);

    let res = this.emptyMeasurement;

    if (this.currentMode === 'classic' && this.classicScene) {
      this.classicScene.camera.copy(this.camera);
      this.classicScene.camera.coordinateSystem = THREE.WebGLCoordinateSystem;
      this.classicScene.camera.updateProjectionMatrix();
      this.classicScene.updateDynamicObjects(time, this.currentConfig.dynamicRatio);
      res = this.classicScene.render();
    } else if (this.gpuSceneRenderer) {
      this.gpuSceneRenderer.updateCamera(this.camera);
      this.gpuSceneRenderer.updateDynamicObjects(time, this.currentConfig.dynamicRatio);
      res = this.gpuSceneRenderer.render(timer, sample);
    }

    const now = performance.now();
    const dt = this.lastFrameTime > 0 ? (now - this.lastFrameTime) : 0;
    this.lastFrameTime = now;
    const fps = dt > 0 ? 1000 / dt : null;
    const cpuFrameMs = now - tStart;

    const measurement = this.measurement;
    measurement.submitMs = res.submitMs; measurement.cpuFrameMs = cpuFrameMs;
    measurement.fps = fps; measurement.drawCalls = res.drawCalls;
    if (this.onMetricsUpdate && !this.isBenchmarking) {
      this.onMetricsUpdate(
        measurement,
        this.currentMode,
        this.currentConfig.objectCount
      );
    }

    return measurement;
  }

  /** Campagne complète sur les 4 dimensions de stress. */
  public runFullMatrix(): Promise<GpuSceneBenchResult[]> {
    return this.runCampaign(FULL_MATRIX, 'Campagne 4D achevée');
  }

  /**
   * Exécute une campagne A/B sur la liste de scénarios fournie.
   * Toute mesure publiée passe par ici : aucun appelant ne fabrique de métrique.
   */
  public async runCampaign(
    scenarios: SceneStressConfig[],
    doneLabel = 'Campagne achevée'
  ): Promise<GpuSceneBenchResult[]> {
    const results: GpuSceneBenchResult[] = [];

    const SAMPLES = 30;
    const WARMUP = 10;

    this.isBenchmarking = true;
    try {
      for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const config = scenarios[sIdx];
        if (this.onProgress) {
          this.onProgress(config.name, sIdx / scenarios.length);
        }

        await this.applyConfig(config);

        // 1. Mesure Test A (Three.js Classic)
        const classic = await this.measureMode('classic', WARMUP, SAMPLES);

        results.push({
          mode: 'classic',
          config,
          avgCpuSubmitMs: classic.avgSubmitMs,
          avgCpuFrameMs: classic.avgFrameMs,
          drawCalls: classic.drawCalls,
          // Le culling du baseline est fait par Three.js côté CPU : on ne
          // l'instrumente pas, d'où des compteurs non renseignés (null).
          culledObjects: null,
          visibleObjects: null,
          gpuMemoryBytes: null,
        });

        // 2. Mesure Test B (GPU-Scene)
        await this.applyConfig(config); // Reset mutable transforms before the second variant.
        const gpu = await this.measureMode('gpu-scene', WARMUP, SAMPLES);
        const counters = await this.gpuSceneRenderer?.readCullingCounters();

        const gpuRes: GpuSceneBenchResult = {
          mode: 'gpu-scene',
          config,
          avgCpuSubmitMs: gpu.avgSubmitMs,
          avgCpuFrameMs: gpu.avgFrameMs,
          drawCalls: gpu.drawCalls,
          culledObjects: counters ? counters.culled : null,
          visibleObjects: counters ? counters.visible : null,
          gpuMemoryBytes: this.gpuSceneRenderer?.getSceneBufferBytes() ?? null,
          gpuFrameMs: gpu.gpuFrameMs,
        };

        results.push(gpuRes);
        if (this.onResult) this.onResult(gpuRes);
      }
    } finally {
      this.isBenchmarking = false;
    }

    if (this.onProgress) {
      this.onProgress(doneLabel, 1.0);
    }

    return results;
  }

  /**
   * Protocole de mesure d'un mode : warmup puis échantillonnage.
   * Partagé par Test A et Test B — les deux doivent suivre exactement le même
   * protocole pour rester comparables.
   */
  private async measureMode(mode: 'classic' | 'gpu-scene', warmup: number, samples: number)
    : Promise<{ avgSubmitMs: number; avgFrameMs: number; drawCalls: number; gpuFrameMs: number | null }> {
    if (!this.device || !this.classicScene || !this.gpuSceneRenderer) throw new Error('Renderer indisponible');
    this.setMode(mode);
    const timer = mode === 'gpu-scene' && this.device.features.has('timestamp-query')
      ? new TimestampBatch(this.device, samples, 2) : undefined;
    try {
      await runFrames(warmup, i => { this.renderFrame(i * 16.6667); });
      await this.device.queue.onSubmittedWorkDone();
      let sumSubmit = 0, sumFrame = 0, drawCalls = 0;
      timer?.begin(samples);
      await runFrames(samples, i => {
        const res = this.renderFrame((warmup + i) * 16.6667, timer, i);
        sumSubmit += res.submitMs; sumFrame += res.cpuFrameMs; drawCalls = res.drawCalls;
      });
      if (timer) await timer.collect();
      const gpuFrameMs = timer && timer.frameSpanMs.every(Number.isFinite)
        ? timer.frameSpanMs.reduce((a, b) => a + b, 0) / samples : null;
      return { avgSubmitMs: sumSubmit / samples, avgFrameMs: sumFrame / samples, drawCalls, gpuFrameMs };
    } finally { timer?.destroy(); }
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.classicScene) this.classicScene.resize(width, height);
    if (this.gpuSceneRenderer) this.gpuSceneRenderer.resize(width, height);
  }
}
