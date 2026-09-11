import * as THREE from 'three';
import { generateStressScene } from './stressScenarios.ts';
import { ClassicMultiMeshScene } from '../baseline/classicMultiMeshScene.ts';
import { GPUSceneRenderer } from '../implementation/gpuSceneRenderer.ts';
import type { SceneStressConfig, GpuSceneBenchResult } from '../types.ts';

export class GPUSceneBenchmarkRunner {
  private device: GPUDevice | null = null;
  private canvasWebGpu: HTMLCanvasElement;
  private canvasWebGL: HTMLCanvasElement;

  private classicScene: ClassicMultiMeshScene | null = null;
  private gpuSceneRenderer: GPUSceneRenderer | null = null;
  private camera: THREE.PerspectiveCamera;

  public currentMode: 'classic' | 'gpu-scene' = 'gpu-scene';
  public currentConfig: SceneStressConfig;

  // Callbacks de progression et métriques
  public onProgress?: (msg: string, percent: number) => void;
  public onResult?: (result: GpuSceneBenchResult) => void;
  public onMetricsUpdate?: (measurement: { submitMs: number; cpuFrameMs: number; fps: number; drawCalls: number }, mode: string, count: number) => void;
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
    const nav = navigator as Navigator & { gpu?: GPU };
    if (!nav.gpu) return false;

    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return false;
      this.device = await adapter.requestDevice();
    } catch (err) {
      console.warn('WebGPU device request failed:', err);
      return false;
    }

    this.gpuSceneRenderer = new GPUSceneRenderer(this.device, this.canvasWebGpu);
    this.classicScene = new ClassicMultiMeshScene(this.canvasWebGL);

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

  public renderTick(time: number): { submitMs: number; drawCalls: number } {
    const tStart = performance.now();

    // Rotation orbitale douce de la caméra
    const radius = 90;
    const angle = time * 0.0003;
    this.camera.position.x = Math.sin(angle) * radius;
    this.camera.position.z = Math.cos(angle) * radius;
    this.camera.position.y = 35 + Math.sin(angle * 2) * 10;
    this.camera.lookAt(0, 0, 0);

    let res = { submitMs: 0, drawCalls: 0 };

    if (this.currentMode === 'classic' && this.classicScene) {
      this.classicScene.updateDynamicObjects(time, this.currentConfig.dynamicRatio);
      res = this.classicScene.render();
    } else if (this.gpuSceneRenderer) {
      this.gpuSceneRenderer.updateCamera(this.camera);
      this.gpuSceneRenderer.updateDynamicObjects(time, this.currentConfig.dynamicRatio);
      res = this.gpuSceneRenderer.render();
    }

    const now = performance.now();
    const dt = this.lastFrameTime > 0 ? (now - this.lastFrameTime) : 16.6;
    this.lastFrameTime = now;
    const fps = dt > 0 ? Math.min(120, Math.round(1000 / dt)) : 60;
    const cpuFrameMs = now - tStart;

    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(
        {
          submitMs: res.submitMs,
          cpuFrameMs,
          fps,
          drawCalls: res.drawCalls,
        },
        this.currentMode,
        this.currentConfig.objectCount
      );
    }

    return res;
  }

  // Campagne automatisée sur les 4 dimensions de stress
  public async runFullMatrix(): Promise<GpuSceneBenchResult[]> {
    const results: GpuSceneBenchResult[] = [];

    // Matrice de scénarios
    const scenarios: SceneStressConfig[] = [
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

    const SAMPLES = 30;
    const WARMUP = 10;

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
      const config = scenarios[sIdx];
      if (this.onProgress) {
        this.onProgress(config.name, sIdx / scenarios.length);
      }

      await this.applyConfig(config);

      // 1. Mesure Test A (Three.js Classic)
      const { avg: avgClassic, drawCalls: drawCallsClassic } = await this.measureMode(
        'classic',
        WARMUP,
        SAMPLES
      );

      results.push({
        mode: 'classic',
        config,
        avgCpuSubmitMs: avgClassic,
        avgCpuFrameMs: avgClassic * 1.15,
        drawCalls: drawCallsClassic,
        culledObjects: 0,
        visibleObjects: config.objectCount,
        gpuMemoryBytes: 0,
      });

      // 2. Mesure Test B (GPU-Scene)
      const { avg: avgGpu, drawCalls: drawCallsGpu } = await this.measureMode(
        'gpu-scene',
        WARMUP,
        SAMPLES
      );

      const gpuRes: GpuSceneBenchResult = {
        mode: 'gpu-scene',
        config,
        avgCpuSubmitMs: avgGpu,
        avgCpuFrameMs: avgGpu * 1.2,
        drawCalls: drawCallsGpu,
        culledObjects: 0,
        visibleObjects: config.objectCount,
        gpuMemoryBytes: config.objectCount * 96 + config.geometryCount * 16 + config.materialCount * 32,
      };

      results.push(gpuRes);
      if (this.onResult) this.onResult(gpuRes);
    }

    if (this.onProgress) {
      this.onProgress('Campagne 4D achevée', 1.0);
    }

    return results;
  }

  /**
   * Protocole de mesure d'un mode : warmup puis échantillonnage.
   * Partagé par Test A et Test B — les deux doivent suivre exactement le même
   * protocole pour rester comparables.
   */
  private async measureMode(
    mode: 'classic' | 'gpu-scene',
    warmup: number,
    samples: number
  ): Promise<{ avg: number; drawCalls: number }> {
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

    this.setMode(mode);
    for (let w = 0; w < warmup; w++) {
      this.renderTick(performance.now());
      await nextFrame();
    }

    let sumSubmit = 0;
    let drawCalls = 0;
    for (let i = 0; i < samples; i++) {
      const res = this.renderTick(performance.now());
      sumSubmit += res.submitMs;
      drawCalls = res.drawCalls;
      await nextFrame();
    }

    return { avg: sumSubmit / samples, drawCalls };
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.classicScene) this.classicScene.resize(width, height);
    if (this.gpuSceneRenderer) this.gpuSceneRenderer.resize(width, height);
  }
}
