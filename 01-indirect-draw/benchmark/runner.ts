import { TimestampBatch } from '../../shared/gpu/timing.ts';
import { runFrames } from '../../shared/benchmark/comparison.ts';
import * as THREE from 'three';
import type {
  BenchmarkResult,
  CrossoverReport,
  FrameMeasurement,
} from '../types.ts';
import { generateTestInstances, createBaseGeometry } from '../common/sceneGenerator.ts';
import { ClassicThreeScene } from '../baseline/classicScene.ts';
import { GpuDrivenRenderer } from '../implementation/gpuDrivenRenderer.ts';
import { CrossoverChart } from './chart.ts';
import { getSharedDevice, getSharedGLRenderer, configureCanvas } from '../../src/common/gpuContext.ts';

export class BenchmarkRunner {
  private device: GPUDevice | null = null;
  private canvasWebGpu: HTMLCanvasElement;
  private canvasWebGL: HTMLCanvasElement;
  public readonly chart: CrossoverChart;

  private classicScene: ClassicThreeScene | null = null;
  private gpuDrivenRenderer: GpuDrivenRenderer | null = null;
  private classicRenderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera;
  private baseGeometry: THREE.BufferGeometry;

  public currentMode: 'classic' | 'gpu-driven' = 'gpu-driven';
  private currentCount: number = 2000;
  private isBenchmarking: boolean = false;
  private frameCount: number = 0;
  private lastTick: number | null = null;

  // Callbacks d'interface
  public onMetricsUpdate?: (m: FrameMeasurement, mode: string, count: number) => void;
  public onBenchmarkProgress?: (stage: string, progress: number) => void;
  public onBenchmarkComplete?: (report: CrossoverReport) => void;

  constructor(
    canvasWebGpu: HTMLCanvasElement,
    canvasWebGL: HTMLCanvasElement,
    chartCanvas: HTMLCanvasElement
  ) {
    this.canvasWebGpu = canvasWebGpu;
    this.canvasWebGL = canvasWebGL;
    this.chart = new CrossoverChart(chartCanvas);

    this.baseGeometry = createBaseGeometry();
    this.camera = new THREE.PerspectiveCamera(60, 1.0, 0.1, 1000);
    this.camera.position.set(0, 30, 85);
  }

  public async init(): Promise<boolean> {
    // 1. Device WebGPU partagé pour le Test B (un seul device pour tout le banc)
    this.device = await getSharedDevice();

    // 2. WebGLRenderer Three.js partagé pour le Test A (un seul contexte par canvas)
    this.classicRenderer = getSharedGLRenderer(this.canvasWebGL);
    this.classicRenderer.setSize(this.canvasWebGL.clientWidth, this.canvasWebGL.clientHeight, false);

    this.resize(this.canvasWebGpu.clientWidth, this.canvasWebGpu.clientHeight);
    await this.setupTier(this.currentCount);

    return !!this.device;
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (this.classicRenderer) {
      this.classicRenderer.setSize(width, height, false);
    }

    if (this.gpuDrivenRenderer) {
      this.gpuDrivenRenderer.createDepthTexture();
    }
  }

  public async setupTier(count: number) {
    this.currentCount = count;

    // Libération précédente
    if (this.classicScene) {
      this.classicScene.dispose();
      this.classicScene = null;
    }
    if (this.gpuDrivenRenderer) {
      this.gpuDrivenRenderer.dispose();
      this.gpuDrivenRenderer = null;
    }

    const instances = generateTestInstances(count, 42);

    // Initialisation Test A
    this.classicScene = new ClassicThreeScene(instances);

    // Initialisation Test B
    if (this.device) {
      const { context: ctx, format } = configureCanvas(this.canvasWebGpu, this.device);

      this.gpuDrivenRenderer = new GpuDrivenRenderer(
        this.device,
        ctx,
        format,
        instances,
        this.baseGeometry
      );
    }
  }

  public setMode(mode: 'classic' | 'gpu-driven') {
    this.currentMode = mode;
    this.canvasWebGL.style.display = mode === 'classic' ? 'block' : 'none';
    this.canvasWebGpu.style.display = mode === 'gpu-driven' ? 'block' : 'none';
  }

  public renderTick(time: number): FrameMeasurement | null {
    if (this.isBenchmarking) return null;

    this.frameCount++;
    // Trajectoire orbitale de la caméra pour forcer le culling dynamique
    const radius = 95;
    const angle = time * 0.00035;
    this.camera.position.x = Math.sin(angle) * radius;
    this.camera.position.z = Math.cos(angle) * radius;
    this.camera.position.y = 25 + Math.sin(angle * 1.5) * 15;
    this.camera.lookAt(0, 0, 0);

    let measurement: FrameMeasurement | null = null;

    if (this.currentMode === 'classic' && this.classicScene && this.classicRenderer) {
      measurement = this.classicScene.renderFrame(this.classicRenderer, this.camera, this.frameCount);
    } else if (this.currentMode === 'gpu-driven' && this.gpuDrivenRenderer) {
      measurement = this.gpuDrivenRenderer.renderFrame(this.camera, this.frameCount);
    }

    if (measurement) measurement.fps = this.lastTick !== null && time > this.lastTick ? 1000 / (time - this.lastTick) : null;
    this.lastTick = time;
    if (measurement && this.onMetricsUpdate) {
      this.onMetricsUpdate(measurement, this.currentMode, this.currentCount);
    }

    return measurement;
  }

  /**
   * Lance la campagne de banc automatisée incluant les tiers standards et les tests de douleur
   * (500, 1 000, 2 000, 5 000, 10 000, 25 000, 50 000, 100 000 objets)
   */
  public async runAutomatedBenchmark(customTiers?: number[]): Promise<CrossoverReport> {
    if (!this.device || !this.classicRenderer) throw new Error('WebGPU indisponible : aucune mesure simulée');
    if (this.isBenchmarking) throw new Error('Une campagne est déjà active');
    this.isBenchmarking = true;
    const tiers = customTiers ?? [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
    const classicResults: BenchmarkResult[] = [], gpuDrivenResults: BenchmarkResult[] = [];
    const warmup = 60, samples = 128;
    try {
      for (let tier = 0; tier < tiers.length; tier++) {
        const count = tiers[tier];
        await this.setupTier(count);
        for (const mode of (tier % 2 ? ['gpu-driven', 'classic'] : ['classic', 'gpu-driven']) as ('classic' | 'gpu-driven')[]) {
          this.setMode(mode);
          this.onBenchmarkProgress?.(`${mode} — ${count}`, tier / tiers.length);
          const cpu = new Float64Array(samples), submit = new Float64Array(samples);
          const timer = mode === 'gpu-driven' && this.device.features.has('timestamp-query')
            ? new TimestampBatch(this.device, samples, 2) : undefined;
          let calls = 0;
          const render = (i: number, measured: boolean) => {
            const angle = i * 0.05;
            this.camera.position.set(Math.sin(angle) * 90, 25, Math.cos(angle) * 90);
            this.camera.lookAt(0, 0, 0);
            const m = mode === 'classic'
              ? this.classicScene!.renderFrame(this.classicRenderer!, this.camera, i)
              : this.gpuDrivenRenderer!.renderFrame(this.camera, i, measured ? timer : undefined, i);
            if (measured) { cpu[i] = m.cpuFrameMs; submit[i] = m.submitMs; calls = m.drawCalls; }
          };
          try {
            await runFrames(warmup, i => render(i, false));
            await this.device.queue.onSubmittedWorkDone();
            timer?.begin(samples);
            await runFrames(samples, i => render(i, true));
            if (timer) await timer.collect();
            const average = (a: Float64Array) => a.reduce((sum, x) => sum + x, 0) / a.length;
            const sorted = submit.slice().sort();
            const gpu = timer && timer.frameSpanMs.every(Number.isFinite) ? average(timer.frameSpanMs) : null;
            const result: BenchmarkResult = { mode, objectCount: count, samplesCount: samples,
              avgCpuFrameMs: average(cpu), avgSubmitMs: average(submit),
              p95SubmitMs: sorted[Math.ceil(samples * .95) - 1], p99SubmitMs: sorted[Math.ceil(samples * .99) - 1],
              avgFps: null, gpuFrameMs: gpu, drawCalls: calls };
            (mode === 'classic' ? classicResults : gpuDrivenResults).push(result);
          } finally { timer?.destroy(); }
        }
      }
      classicResults.sort((a, b) => a.objectCount - b.objectCount);
      gpuDrivenResults.sort((a, b) => a.objectCount - b.objectCount);
      // A WebGL/Three.js vs native WebGPU comparison cannot isolate an algorithm crossover.
      const report: CrossoverReport = { timestamp: new Date().toISOString(), tiers, classicResults, gpuDrivenResults,
        crossoverObjectCount: null,
        analysis: 'Comparaison système WebGL/Three.js contre WebGPU natif. Aucun crossover algorithmique ni verdict automatique ; GPU mesuré uniquement si timestamp-query disponible.' };
      this.chart.render(classicResults, gpuDrivenResults, null);
      this.onBenchmarkComplete?.(report);
      return report;
    } finally { this.isBenchmarking = false; this.lastTick = null; }
  }
}
