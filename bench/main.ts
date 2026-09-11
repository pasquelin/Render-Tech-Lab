import { comparisonReport, comparisonChart } from '../shared/benchmark/report.ts';
import { createCompactionStrategies } from './compaction.ts';
import * as THREE from 'three';
import { GpuDrivenRenderer } from '../01-indirect-draw/implementation/gpuDrivenRenderer.ts';
import { generateTestInstances, createBaseGeometry } from '../01-indirect-draw/common/sceneGenerator.ts';
import { compareStrategies, type BenchmarkStrategy, type ComparisonConfig } from '../shared/benchmark/comparison.ts';
import { getSharedDevice, getAdapterInfo, configureCanvas } from '../src/common/gpuContext.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const status = document.querySelector<HTMLElement>('#status')!;
const device = await getSharedDevice();
const errors: string[] = [];
let running = false;
if (device) {
  device.addEventListener('uncapturederror', e => errors.push(e.error.message));
  void device.lost.then(info => errors.push(`Device lost: ${info.reason} ${info.message}`));
}

async function probe() {
  const info = getAdapterInfo();
  return { ready: !!device, adapter: info ? { vendor: info.vendor, architecture: info.architecture,
    device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter } : null,
    features: device ? Array.from(device.features) : [], browser: navigator.userAgent,
    width: canvas.width, height: canvas.height, threeRevision: THREE.REVISION };
}

async function run(options: Partial<ComparisonConfig> & { counts?: number[]; test?: string; pattern?: 'mixed' | 'all' | 'none'; forceFallback?: boolean } = {}) {
  if (running) throw new Error('Campagne déjà active');
  if (!device) return { status: 'not-run', validSamples: 0, reason: 'WebGPU unavailable', records: [] };
  const test = options.test ?? '02-gpu-frustum-culling';
  if (!['01-indirect-draw', '02-gpu-frustum-culling', '09-gpu-compaction'].includes(test)) {
    return { status: 'not-run', validSamples: 0, reason: 'No physical runner for this module', records: [] };
  }
  const counts = options.counts ?? [1000, 10000, 100000];
  if (!counts.length || counts.some(n => !Number.isInteger(n) || n < 0 || n > 100000)) throw new Error('Invalid object counts');
  const config = { warmup: options.warmup ?? 60, samples: options.samples ?? 128, blocks: options.blocks ?? 6, forceFallback: options.forceFallback ?? false };
  running = true;
  const records = [];
  try {
    const { context, format } = configureCanvas(canvas, device);
    for (const count of counts) {
      status.textContent = `${test} — ${count} objets`;
      const instances = generateTestInstances(count, 42), geometry = createBaseGeometry();
      const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
      camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
      camera.updateProjectionMatrix();
      const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
      const variants = test === '01-indirect-draw' ? ['direct', 'indirect'] as const : ['atomic', 'workgroup'] as const;
      const strategies: BenchmarkStrategy[] = [];
      device.pushErrorScope('validation');
      try {
        if (test === '09-gpu-compaction') strategies.push(...createCompactionStrategies(device, count, options.pattern));
        else for (const id of variants) {
          const renderer = new GpuDrivenRenderer(device, context, format, instances, geometry,
            id === 'workgroup' ? 'workgroup' : 'atomic', id === 'direct' ? 'direct' : 'indirect');
          const render: BenchmarkStrategy['render'] = (frame, timer, sample) => {
            const angle = frame * 0.05;
            camera.position.set(Math.sin(angle) * 90, 25, Math.cos(angle) * 90);
            camera.lookAt(0, 0, 0);
            renderer.renderFrame(camera, frame, timer, sample);
          };
          strategies.push({ id, render, dispose: () => renderer.dispose(), verify: async () => {
            render(0);
            const actual = await renderer.readVisibleIds();
            matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(matrix, THREE.WebGPUCoordinateSystem);
            const expected = instances.filter(instance => frustum.intersectsSphere(new THREE.Sphere(instance.boundingSphere.center, instance.boundingSphere.radius))).map(i => i.id).sort((a, b) => a - b);
            const got = Array.from(actual).sort((a, b) => a - b);
            if (got.length !== expected.length || got.some((id, i) => id !== expected[i])) throw new Error(`${id}: CPU/GPU visibility mismatch`);
          } });
        }
        const comparison = await compareStrategies(device, strategies, config);
        for (const result of comparison) records.push({ timestamp: new Date().toISOString(), test, commit: null,
          status: 'measured', verdict: 'not-yet-decided', environment: { gpu: getAdapterInfo()?.description || null, browser: navigator.userAgent, threeVersion: THREE.REVISION, webgpuFeatures: Array.from(device.features) },
          scene: { objects: count, triangles: test === '09-gpu-compaction' ? null : count * geometry.index!.count / 3, materials: 1, lights: 1 },
          cpu: { frameMs: result.cpuMs.reduce((a, b) => a + b, 0) / result.cpuMs.length, submitMs: null },
          gpu: { frameMs: null }, memory: { gpuBytes: null }, draw: { submitted: null, visible: null },
          customMetrics: { execution: 'browser-webgpu', seed: 42, protocol: config,
            gpuScope: test === '09-gpu-compaction' ? 'reset-compaction' : 'reset-cull-raster; excludes uploads and presentation', ...result } });
      } finally {
        for (const strategy of strategies) strategy.dispose();
        geometry.dispose();
        const error = await device.popErrorScope();
        if (error) { errors.push(error.message); throw new Error(error.message); }
      }
      if (errors.length) throw new Error(errors.join('\n'));
    }
    const result = { status: 'measured', validSamples: records.reduce((n, r) => n + r.customMetrics.validSamples, 0),
      validationErrors: errors.slice(), records, report: comparisonReport(records), chart: comparisonChart(records) };
    document.querySelector('#result')!.textContent = result.report;
    document.querySelector('#chart')!.innerHTML = result.chart;
    status.textContent = 'Campagne terminée — verdict à établir à partir des données brutes.';
    return result;
  } finally { running = false; }
}
Object.assign(window, { renderTechLabBench: { probe, run } });
status.textContent = device ? 'Prêt pour les mesures physiques.' : 'WebGPU indisponible — aucun résultat simulé.';

const query = new URLSearchParams(location.search);
if (query.get('run') === '1') void run({ test: query.get('test') ?? undefined }).then(result => {
  if (result.status !== 'measured') status.textContent = ('reason' in result ? result.reason : undefined) ?? 'Non exécuté';
}).catch(error => { status.textContent = `Échec : ${String(error)}`; });
