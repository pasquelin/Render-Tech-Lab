import { createVirtualizedIntegrationRunner } from '../../15-virtualized-integration/index.ts';
import * as THREE from 'three';
import { TimestampBatch } from '../gpu/timing.ts';
import type { BenchmarkStrategy } from './comparison.ts';
import { createSphereMesh } from '../fixtures/sphere.ts';
import { generateTestInstances, createBaseGeometry } from '../../01-indirect-draw/index.ts';
import { GpuDrivenRenderer } from '../../01-indirect-draw/index.ts';
import { buildMeshlets } from '../../05-meshlets/index.ts';
import { cullMeshlets } from '../../06-meshlet-culling/index.ts';
import { buildHiZPyramid } from '../../07-hiz/index.ts';
import { cullMeshletsByOcclusion, type ScreenMeshlet } from '../../08-occlusion-culling/index.ts';
import { createCompactionStrategies } from './compaction.ts';
import { buildMaterialSubmissionPlan } from '../../10-material-batching/index.ts';
import type { MaterialBatchingStrategy } from '../../10-material-batching/index.ts';
import { GeometryStreamingManager } from '../../11-geometry-streaming/index.ts';
import { evaluateVisibilityBuffer, packVisibilityId, reconstructVisibilitySample, unpackVisibilityId } from '../../12-visibility-buffer/index.ts';

import { INTEGRATED_RUNNER_IDS } from '../contracts/integrated.ts';
export { INTEGRATED_RUNNER_IDS } from '../contracts/integrated.ts';
import type { IntegratedRunnerId, IntegratedPhase, IntegratedMetric, IntegratedRunResult, IntegratedRunOptions, IntegratedBenchRunner } from '../contracts/integrated.ts';
export type * from '../contracts/integrated.ts';

function abortError(message = 'Campagne interrompue'): DOMException {
  return new DOMException(message, 'AbortError');
}

function active(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

async function yieldToHost(signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  active(signal);
}

function sampleCount(value: number | undefined): number {
  const count = value ?? 3;
  if (!Number.isSafeInteger(count) || count < 1 || count > 256) throw new RangeError('samples must be between 1 and 256');
  return count;
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function emit(options: IntegratedRunOptions, test: IntegratedRunnerId, phase: IntegratedPhase,
  variant: string | undefined, completed: number, total: number, message: string): void {
  const event = { test, phase, variant, completed, total, message };
  options.onPhase?.(event);
  options.onProgress?.(event);
}

async function executeVariants(
  test: IntegratedRunnerId,
  variants: readonly string[],
  options: IntegratedRunOptions,
  execute: (variant: string, samples: number) => Promise<IntegratedMetric>,
): Promise<IntegratedRunResult> {
  const samples = sampleCount(options.samples);
  const records: IntegratedMetric[] = [];
  emit(options, test, 'prepare', undefined, 0, variants.length, 'Préparation déterministe');
  for (let index = 0; index < variants.length; index++) {
    const variant = variants[index];
    active(options.signal);
    emit(options, test, 'measure', variant, index, variants.length, `Mesure ${variant}`);
    await yieldToHost(options.signal);
    const metric = await execute(variant, samples);
    active(options.signal);
    records.push(metric);
    options.onMetrics?.(metric);
    emit(options, test, 'verify', variant, index + 1, variants.length, `Contrôle ${variant}`);
  }
  emit(options, test, 'complete', undefined, variants.length, variants.length, 'Campagne terminée');
  return { test, status: 'measured', reason: null, records,
    gates: { correctness: true, detail: 'Tous les invariants du runner ont été vérifiés.' } };
}

function cpuMetric(test: IntegratedRunnerId, variant: string, durations: number[],
  custom: IntegratedMetric['custom']): IntegratedMetric {
  return { test, variant, cpuMs: mean(durations), gpuMs: null, custom };
}

function makeDepth(size: number, reversed: boolean): number[][] {
  const near = reversed ? 0.8 : 0.2;
  const far = reversed ? 0.1 : 0.9;
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) =>
    x < size / 2 && y > size / 8 && y < size * 7 / 8 ? near : far));
}

const meshletSizes = ['64', '128', '256', '512'] as const;
const meshletsRunner: IntegratedBenchRunner = {
  id: '05-meshlets', variants: meshletSizes,
  run(options = {}) {
    const meshSizes: Record<string, [number, number]> = { 'plane-1024': [32, 16], 'sphere-4096': [64, 32], 'bunny-16384': [128, 64] };
    const [longBands, latBands] = meshSizes[options.scenario ?? 'sphere-4096'] ?? meshSizes['sphere-4096'];
    const mesh = createSphereMesh({ radius: 2, longBands, latBands });
    return executeVariants(this.id, this.variants, options, async (variant, samples) => {
      const durations: number[] = [];
      let result = buildMeshlets(mesh, Number(variant) as 64 | 128 | 256 | 512);
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now();
        result = buildMeshlets(mesh, Number(variant) as 64 | 128 | 256 | 512);
        durations.push(performance.now() - start);
      }
      const covered = result.meshlets.reduce((sum, meshlet) => sum + meshlet.triangleCount, 0);
      if (covered !== mesh.triangleCount || result.meshlets.some((m) => m.triangleCount > Number(variant))) {
        throw new Error('Meshlet coverage gate failed');
      }
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-partitioning', meshlets: result.meshlets.length,
        triangles: covered, vertexDuplication: result.config.vertexDuplicationFactor ?? null,
        metadataBytes: result.config.metadataMemoryBytes ?? null });
    });
  },
};

const cullingRunner: IntegratedBenchRunner = {
  id: '06-meshlet-culling', variants: ['frustum-cone-subpixel'],
  run(options = {}) {
    const sourceMeshlets = buildMeshlets(createSphereMesh({ longBands: 48, latBands: 32 }), 128).meshlets;
    const selected = ['cone-50', 'backface-100', 'frontface-0'].includes(options.scenario ?? '') ? options.scenario! : 'cone-50';
    return executeVariants(this.id, [selected], options, async (variant, samples) => {
      const expectedRejected = variant === 'backface-100' ? sourceMeshlets.length : variant === 'cone-50' ? Math.floor(sourceMeshlets.length / 2) : 0;
      const meshlets = sourceMeshlets.map((meshlet, index) => ({ ...meshlet, normalCone: {
        ...meshlet.normalCone, apex: [0, 0, 0] as [number, number, number], cosHalfAngle: 1, cullable: true,
        axis: (index < expectedRejected ? [0, 0, -1] : [0, 0, 1]) as [number, number, number],
      } }));
      const input = { meshlets, frustumPlanes: [
        { n: [1, 0, 0] as [number, number, number], d: 3 }, { n: [-1, 0, 0] as [number, number, number], d: 3 },
        { n: [0, 1, 0] as [number, number, number], d: 3 }, { n: [0, -1, 0] as [number, number, number], d: 3 },
        { n: [0, 0, 1] as [number, number, number], d: 6 }, { n: [0, 0, -1] as [number, number, number], d: 6 },
      ], viewPosition: [0, 0, 5] as [number, number, number], screenHeight: 1080, fovRad: Math.PI / 3, subPixelThreshold: 0 };
      const durations: number[] = []; let output = cullMeshlets({ meshlets, frustumPlanes: [], viewPosition: [0, 0, 5],
        screenHeight: 1080, fovRad: Math.PI / 3, subPixelThreshold: 1 });
      for (let warmup = 0; warmup < (options.warmup ?? 2); warmup++) { active(options.signal); cullMeshlets(input); }
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now();
        output = cullMeshlets(input);
        durations.push(performance.now() - start);
      }
      const accounted = output.visible.length + output.rejectCounts.total;
      if (accounted !== meshlets.length || output.rejectReasons.length !== meshlets.length
        || output.rejectCounts.backface !== expectedRejected || output.rejectCounts.frustum !== 0 || output.rejectCounts.subpixel !== 0) {
        throw new Error('Meshlet culling ID/count/oracle gate failed');
      }
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-conservative-oracle', meshlets: meshlets.length,
        visible: output.visible.length, rejected: output.rejectCounts.total,
        frustumRejected: output.rejectCounts.frustum, coneRejected: output.rejectCounts.backface,
        subpixelRejected: output.rejectCounts.subpixel, expectedRejected, warmup: options.warmup ?? 2, samples });
    });
  },
};

const hizVariants = ['512-standard-z', '512-reversed-z', '1024-standard-z', '1024-reversed-z', '2048-standard-z', '2048-reversed-z'] as const;

function verifyHiZPyramid(result: ReturnType<typeof buildHiZPyramid>, reversed: boolean): void {
  const reduce = reversed ? Math.min : Math.max;
  for (let level = 1; level < result.pyramid.mips.length; level++) {
    const previousMip = result.pyramid.mips[level - 1];
    const mip = result.pyramid.mips[level];
    const previous = result.mipBuffers[level - 1];
    const current = result.mipBuffers[level];
    if (current.length !== mip.width * mip.height) throw new Error(`Hi-Z mip ${level} dimensions invalides`);
    for (let y = 0; y < mip.height; y++) for (let x = 0; x < mip.width; x++) {
      const x0 = x * 2, y0 = y * 2;
      const x1 = Math.min(x0 + 1, previousMip.width - 1);
      const y1 = Math.min(y0 + 1, previousMip.height - 1);
      const expected = reduce(previous[y0 * previousMip.width + x0], previous[y0 * previousMip.width + x1],
        previous[y1 * previousMip.width + x0], previous[y1 * previousMip.width + x1]);
      if (current[y * mip.width + x] !== expected) throw new Error(`Hi-Z mip ${level} incorrecte en ${x},${y}`);
    }
  }
  const base = result.mipBuffers[0];
  const root = result.mipBuffers.at(-1);
  const expectedRoot = base.reduce((value, depth) => reduce(value, depth), reversed ? 1 : 0);
  if (root?.length !== 1 || root[0] !== expectedRoot) throw new Error('Hi-Z racine incorrecte');
}

const hizRunner: IntegratedBenchRunner = {
  id: '07-hiz', variants: hizVariants,
  run(options = {}) {
    const selectedVariants = options.scenario ? this.variants.filter(variant => variant.startsWith(`${options.scenario}-`)) : [];
    const variants = selectedVariants.length ? selectedVariants : this.variants;
    return executeVariants(this.id, variants, options, async (variant, samples) => {
      const [sizeText, convention] = variant.split('-', 2); const size = Number(sizeText); const reversed = convention === 'reversed';
      const depth = makeDepth(size, reversed); const durations: number[] = []; let result = buildHiZPyramid(depth, reversed);
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now(); result = buildHiZPyramid(depth, reversed);
        durations.push(performance.now() - start);
      }
      verifyHiZPyramid(result, reversed);
      const tail = result.mipBuffers.at(-1)!;
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-hiz-oracle', resolution: size,
        convention: reversed ? 'reversed-z' : 'standard-z', mips: result.pyramid.depth,
        rootDepth: tail[0], mipValuesVerified: true, logicalBytes: result.cost.totalBytes ?? null, gpuReadbackVerified: false });
    });
  },
};

function dummyScreenMeshlets(total: number, occluded: number): { depth: number[][]; meshlets: ScreenMeshlet[] } {
  const depth = makeDepth(64, false);
  const source = buildMeshlets(createSphereMesh({ longBands: 16, latBands: 8 }), 64).meshlets[0];
  const meshlets = Array.from({ length: total }, (_, index): ScreenMeshlet => ({ meshlet: { ...source, sourceTriangleOffset: index },
    screenBox: index < occluded ? { x0: 4, y0: 16, x1: 12, y1: 24 } : { x0: 48, y0: 16, x1: 56, y1: 24 }, depth: 0.7 }));
  return { depth, meshlets };
}

const occlusionVariants = ['10%', '25%', '50%', '75%', '90%', '99%'] as const;
const occlusionRunner: IntegratedBenchRunner = {
  id: '08-occlusion-culling', variants: occlusionVariants,
  run(options = {}) {
    const selectedScenario = /^\d+-(?:50|75|90)$/.test(options.scenario ?? '') ? options.scenario! : null;
    const [selectedCount, selectedRate] = (selectedScenario ?? '2000-50').split('-').map(Number);
    const variants = selectedScenario ? [`${selectedRate}%`] : this.variants;
    return executeVariants(this.id, variants, options, async (variant, samples) => {
      const rate = Number.parseInt(variant, 10) / 100; const total = selectedScenario ? selectedCount : 100; const expected = Math.round(total * rate);
      const fixture = dummyScreenMeshlets(total, expected); const durations: number[] = [];
      const startHiZ = performance.now(); const hiz = buildHiZPyramid(fixture.depth); const hizMs = performance.now() - startHiZ;
      let result = cullMeshletsByOcclusion(fixture.meshlets, hiz);
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now(); result = cullMeshletsByOcclusion(fixture.meshlets, hiz);
        durations.push(performance.now() - start);
      }
      if (result.occludedMeshlets.length !== expected || result.visibleMeshlets.length + expected !== total) throw new Error('Occlusion correctness gate failed');
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-occlusion-oracle', expectedOcclusionRate: rate,
        actualOcclusionRate: result.occlusionRejectRate, visible: result.visibleMeshlets.length,
        occluded: result.occludedMeshlets.length, cpuHiZMs: hizMs, baselineGpuMs: null, rasterGpuMs: null });
    });
  },
};

const materialStrategies: MaterialBatchingStrategy[] = ['state-switch', 'storage-buffer', 'texture-array', 'pseudo-bindless'];
const materialRunner: IntegratedBenchRunner = {
  id: '10-material-batching', variants: materialStrategies,
  run(options = {}) {
    const objectCount = 2_000; const parsedMaterials = Number(options.scenario); const materialCount = [50, 100, 250].includes(parsedMaterials) ? parsedMaterials : 100; const ids = Array.from({ length: objectCount }, (_, index) => index % materialCount);
    const referenceDigest = ids.join(',');
    return executeVariants(this.id, this.variants, options, async (variant, samples) => {
      const durations: number[] = []; let plan = buildMaterialSubmissionPlan(ids, variant as MaterialBatchingStrategy);
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now(); plan = buildMaterialSubmissionPlan(ids, variant as MaterialBatchingStrategy);
        durations.push(performance.now() - start);
      }
      if (plan.drawMaterialIds.join(',') !== referenceDigest || plan.drawCount !== objectCount) throw new Error('Material output gate failed');
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-submission-plan', objects: objectCount,
        materials: materialCount,
        pipelineTransitions: plan.pipelineStateChanges, bindGroupTransitions: plan.bindGroupChanges,
        shadingReadbackVerified: false });
    });
  },
};

const streamingRunner: IntegratedBenchRunner = {
  id: '11-geometry-streaming', variants: ['cold-load', 'resident-hit', 'eviction', 'fallback-rerequest'],
  run(options = {}) {
    const parsedBudget = Number.parseInt(options.scenario ?? '', 10); const budget = ([32, 64, 128].includes(parsedBudget) ? parsedBudget : 64) * 1024 * 1024; const pageSize = budget / 4;
    const manager = new GeometryStreamingManager({ requestedFraction: 100, vramBudgetBytes: budget }, pageSize * 2);
    manager.registerPages(Array.from({ length: 8 }, (_, id) => ({ id, sizeBytes: pageSize,
      fallbackPageId: id === 0 ? null : 0, pinned: id === 0 })));
    const requests: Record<string, number[]> = { 'cold-load': [0, 1], 'resident-hit': [0, 1], eviction: [2, 3, 4, 5], 'fallback-rerequest': [0, 6, 7] };
    return executeVariants(this.id, this.variants, options, async (variant) => {
      active(options.signal); const start = performance.now(); const frame = manager.processFrame(requests[variant]);
      const cpuMs = performance.now() - start; const cut = manager.resolveCut(requests[variant]);
      if (manager.residentBytes > budget || (variant === 'resident-hit' && !cut.complete)) throw new Error('Streaming residency gate failed');
      return cpuMetric(this.id, variant, [cpuMs], { scope: 'cpu-logical-residency', requestedPages: requests[variant].length,
        resolvedPages: cut.pageIds.length, missingPages: cut.missingPageIds.length,
        logicalResidentBytes: manager.residentBytes, logicalBudgetBytes: budget,
        uploadedBytes: frame.metrics.uploadedBytes ?? null, evictedBytes: frame.metrics.evictedBytes ?? null,
        ramBytes: null, vramBytes: null });
    });
  },
};

const visibilityRunner: IntegratedBenchRunner = {
  id: '12-visibility-buffer', variants: ['1080p', '1440p', '4k'],
  run(options = {}) {
    const sizes: Record<string, [number, number]> = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4k': [3840, 2160] };
    const selectedVariants = options.scenario ? this.variants.filter(variant => variant === options.scenario) : [];
    const variants = selectedVariants.length ? selectedVariants : this.variants;
    return executeVariants(this.id, variants, options, async (variant, samples) => {
      const [width, height] = sizes[variant]; const durations: number[] = [];
      const packed = packVisibilityId(42, 105); const unpacked = unpackVisibilityId(packed);
      const sampleInput = { pixelCoord: [30, 30] as [number, number],
        triangleVertices2D: [[0, 0], [100, 0], [0, 100]] as [number, number][],
        clipW: [1, 2, 4], clipZ: [0.2, 0.4, 0.8], attributes: [[1, 0, 0.5], [0, 1, 0.5]] };
      let reconstruction = reconstructVisibilitySample(sampleInput);
      for (let sample = 0; sample < samples; sample++) {
        active(options.signal); const start = performance.now();
        reconstruction = reconstructVisibilitySample(sampleInput);
        durations.push(performance.now() - start);
      }
      if (!unpacked || unpacked[0] !== 42 || unpacked[1] !== 105 || !Number.isFinite(reconstruction.depth)) throw new Error('Visibility ID/depth/reconstruction gate failed');
      const memory = evaluateVisibilityBuffer({ sceneObjectCount: 2_000, viewportWidth: width, viewportHeight: height });
      return cpuMetric(this.id, variant, durations, { scope: 'cpu-reconstruction-oracle', width, height,
        packedId: packed, reconstructedDepth: reconstruction.depth,
        visibilityBytes: memory.deferredBufferBytes ?? null, forwardBytes: memory.forwardBufferBytes ?? null,
        visibilityGpuMs: null, shadingGpuMs: null, imageReadbackVerified: false });
    });
  },
};

async function runGpuStrategies(test: IntegratedRunnerId, strategies: BenchmarkStrategy[], options: IntegratedRunOptions): Promise<IntegratedRunResult> {
  const device = options.device; if (!device) return { test, status: 'not-run', reason: 'WebGPU device absent', records: [],
    gates: { correctness: null, detail: 'Aucune mesure ni verdict sans WebGPU physique.' } };
  const samples = sampleCount(options.samples), warmup = Math.max(0, options.warmup ?? 2), records: IntegratedMetric[] = [];
  try {
    emit(options, test, 'prepare', undefined, 0, strategies.length, 'Préparation WebGPU');
    for (let index = 0; index < strategies.length; index++) {
      const strategy = strategies[index]; active(options.signal);
      await yieldToHost(options.signal);
      emit(options, test, 'verify', strategy.id, index, strategies.length, 'Oracle avant mesure'); await strategy.verify();
      emit(options, test, 'warmup', strategy.id, index, strategies.length, 'Préchauffage hors mesure');
      for (let frame = 0; frame < warmup; frame++) { active(options.signal); strategy.render(frame); }
      await device.queue.onSubmittedWorkDone(); active(options.signal);
      const cpu: number[] = []; const timer = device.features.has('timestamp-query') ? new TimestampBatch(device, samples, 2) : undefined;
      try {
        timer?.begin(samples); emit(options, test, 'measure', strategy.id, index, strategies.length, 'Fenêtre de mesure');
        for (let frame = 0; frame < samples; frame++) {
          active(options.signal); const start = performance.now(); strategy.render(frame, timer, frame); cpu.push(performance.now() - start);
        }
        if (timer) await timer.collect(); else await device.queue.onSubmittedWorkDone();
        active(options.signal); emit(options, test, 'verify', strategy.id, index + 1, strategies.length, 'Readback hors mesure'); await strategy.verify();
        const gpu = timer && timer.frameSpanMs.every(Number.isFinite) ? mean(Array.from(timer.frameSpanMs)) : null;
        const metric: IntegratedMetric = { test, variant: strategy.id, cpuMs: mean(cpu), gpuMs: gpu,
          custom: { scope: 'webgpu-physical', samples, timing: timer ? 'timestamp-query' : 'queue-completion-no-gpu-duration', correctnessReadback: true } };
        records.push(metric); options.onMetrics?.(metric);
      } finally { timer?.destroy(); }
    }
    emit(options, test, 'complete', undefined, strategies.length, strategies.length, 'Campagne terminée');
    return { test, status: 'measured', reason: null, records, gates: { correctness: true, detail: 'Readback physique conforme avant et après chaque variante.' } };
  } finally { for (const strategy of strategies) strategy.dispose(); }
}

const frustumRunner: IntegratedBenchRunner = {
  id: '02-gpu-frustum-culling', variants: ['atomic', 'workgroup'],
  async run(options = {}) {
    if (!options.device || !options.canvas) return { test: this.id, status: 'not-run', reason: 'WebGPU device/canvas absent', records: [],
      gates: { correctness: null, detail: 'Aucune mesure ni verdict sans canvas et device physiques.' } };
    const context = options.canvas.getContext('webgpu'); if (!context) return { test: this.id, status: 'not-run', reason: 'WebGPU canvas context absent', records: [], gates: { correctness: null, detail: 'Contexte WebGPU indisponible.' } };
    const format = navigator.gpu.getPreferredCanvasFormat(); context.configure({ device: options.device, format, alphaMode: 'opaque' });
    const instanceCount = Number(options.scenario ?? 2_000); const instances = generateTestInstances(instanceCount, 42), geometry = createBaseGeometry();
    const camera = new THREE.PerspectiveCamera(60, Math.max(1, options.canvas.width) / Math.max(1, options.canvas.height), 0.1, 1_000);
    camera.coordinateSystem = THREE.WebGPUCoordinateSystem; camera.position.set(0, 25, 90); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    const matrix = new THREE.Matrix4(), frustum = new THREE.Frustum();
    const strategies = this.variants.map((variant): BenchmarkStrategy => {
      const renderer = new GpuDrivenRenderer(options.device!, context, format, instances, geometry, variant as 'atomic' | 'workgroup');
      const render = (frame: number, timer?: TimestampBatch, sample?: number) => { const angle = frame * 0.05;
        camera.position.set(Math.sin(angle) * 90, 25, Math.cos(angle) * 90); camera.lookAt(0, 0, 0); renderer.renderFrame(camera, frame, timer, sample); };
      return { id: variant, render, dispose: () => renderer.dispose(), verify: async () => {
        render(0); const actual = Array.from(await renderer.readVisibleIds()).sort((a, b) => a - b);
        camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix, THREE.WebGPUCoordinateSystem);
        const expected = instances.filter((item) => frustum.intersectsSphere(new THREE.Sphere(item.boundingSphere.center, item.boundingSphere.radius))).map((item) => item.id).sort((a, b) => a - b);
        if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) throw new Error(`${variant}: CPU/GPU visibility ID gate failed`);
      } };
    });
    try {
      const result = await runGpuStrategies(this.id, strategies, options);
      return { ...result, records: result.records.map(record => ({ ...record, custom: { ...record.custom, instances: instanceCount } })) };
    } finally { geometry.dispose(); }
  },
};

const compactionRunner: IntegratedBenchRunner = {
  id: '09-gpu-compaction', variants: ['serial', 'atomic', 'workgroup'],
  run(options = {}) {
    if (!options.device) return Promise.resolve({ test: this.id, status: 'not-run' as const, reason: 'WebGPU device absent', records: [],
      gates: { correctness: null, detail: 'Aucune mesure ni verdict sans WebGPU physique.' } });
    const instances = Number(options.scenario ?? 100_000);
    return runGpuStrategies(this.id, createCompactionStrategies(options.device, instances, 'mixed'), options).then(result => ({ ...result, records: result.records.map(record => ({ ...record, custom: { ...record.custom, instances } })) }));
  },
};

// Initialize after module loading: public bench facades can depend on this registry.
let integrationRunner: IntegratedBenchRunner | undefined;
const runners: Record<IntegratedRunnerId, IntegratedBenchRunner> = {
  get '15-virtualized-integration'() { return integrationRunner ??= createVirtualizedIntegrationRunner(); },
  '02-gpu-frustum-culling': frustumRunner, '05-meshlets': meshletsRunner,
  '06-meshlet-culling': cullingRunner, '07-hiz': hizRunner, '08-occlusion-culling': occlusionRunner,
  '09-gpu-compaction': compactionRunner, '10-material-batching': materialRunner,
  '11-geometry-streaming': streamingRunner, '12-visibility-buffer': visibilityRunner,
};

export function createIntegratedRunner(id: IntegratedRunnerId): IntegratedBenchRunner {
  return runners[id];
}

export function isIntegratedRunnerId(value: string): value is IntegratedRunnerId {
  return (INTEGRATED_RUNNER_IDS as readonly string[]).includes(value);
}
