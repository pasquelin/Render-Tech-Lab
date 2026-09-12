import * as THREE from 'three';
import { generateTestInstances, createBaseGeometry } from '../../01-indirect-draw/index.ts';
import { GpuDrivenRenderer } from '../../01-indirect-draw/index.ts';
import { TimestampBatch } from '../../shared/gpu/timing.ts';
import { active, bounded, nextFrame, pose, summarize, cadence, compareImages, type ControlConfig } from '../scenarios/protocol.ts';

type Mode = 'direct' | 'indirect';
export interface ControlCallbacks {
  phase(phase: 'prepare' | 'warmup' | 'measure' | 'verify', variant: string, completed: number, total: number): void;
}
async function digest(bytes: Uint8Array): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(value), v => v.toString(16).padStart(2, '0')).join('');
}

async function capture(device: GPUDevice, context: GPUCanvasContext, c: ControlConfig, signal: AbortSignal) {
  active(signal);
  const row = Math.ceil(c.width * 4 / 256) * 256;
  const read = device.createBuffer({ size: row * c.height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const abort = () => read.destroy();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: read, bytesPerRow: row }, [c.width, c.height]);
    device.queue.submit([encoder.finish()]);
    await bounded(read.mapAsync(GPUMapMode.READ), signal);
    active(signal);
    const raw = new Uint8Array(read.getMappedRange()), pixels = new Uint8Array(c.width * c.height * 4);
    for (let y = 0; y < c.height; y++) pixels.set(raw.subarray(y * row, y * row + c.width * 4), y * c.width * 4);
    return pixels;
  } finally {
    signal.removeEventListener('abort', abort);
    if (read.mapState === 'mapped') read.unmap(); read.destroy();
  }
}

/** Same shader/geometry/materials. B only assembles resident instance culling + atomic compaction + indirect. */
export async function runResidentControl(device: GPUDevice, canvas: HTMLCanvasElement, c: ControlConfig,
  signal: AbortSignal, callbacks: ControlCallbacks) {
  active(signal);
  const started = performance.now(), geometry = createBaseGeometry(), instances = generateTestInstances(c.count, c.seed);
  const scene = { generator: '01/generateTestInstances', geometry: 'SphereGeometry(1,16,12)',
    sourceTriangles: geometry.index!.count / 3 * instances.length, materials: 'shared native opaque color shader',
    transforms: instances.map(i => i.matrix.elements), colors: instances.map(i => i.color.toArray()),
    trajectory: Array.from({ length: c.samples }, (_, i) => pose(i, c.samples)) };
  const preparationCpuMs = performance.now() - started;
  const context = canvas.getContext('webgpu');
  if (!context) { geometry.dispose(); throw new Error('No WebGPU canvas context'); }
  const previousSize = [canvas.width, canvas.height];
  const renderers: Partial<Record<Mode, GpuDrivenRenderer>> = {};
  let timer: TimestampBatch | undefined;
  const errors: string[] = [];
  const onError = (event: GPUUncapturedErrorEvent) => errors.push(event.error.message);
  device.addEventListener('uncapturederror', onError);
  const check = () => { active(signal); if (errors.length) throw new Error(errors.join('\n')); };
  const camera = new THREE.PerspectiveCamera(60, c.width / c.height, .1, 1000);
  camera.coordinateSystem = THREE.WebGPUCoordinateSystem; camera.updateProjectionMatrix();
  function setPose(frame: number) { camera.position.set(...pose(frame, c.samples)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); }
  const setupStart = performance.now();
  const quality: Array<{ frame: number; passed: boolean; repeat: ReturnType<typeof compareImages>; candidate: ReturnType<typeof compareImages>; nonUniformPixels: number; idsA: number[]; idsB: number[]; expected: number[]; hashes: { a: string; aa: string; b: string } }> = [];
  const blocks: Array<{ block: number; mode: Mode; raw: Array<{ frame: number; rafTime: number; cpuFrameMs: number; submitMs: number; drawCalls: number; gpuMs: number | null; visibleInstancesFromReplay: number; submittedTrianglesFromReplay: number }>; cpuFrameMs: ReturnType<typeof summarize>; submitMs: ReturnType<typeof summarize>; gpuMs: ReturnType<typeof summarize>; cadence: ReturnType<typeof cadence>; timestampQuality: number[] | null }> = [];
  let gpuPreparationWallMs: number | null = null, firstGpuCompleteMs: number | null = null;
  try {
    canvas.width = c.width; canvas.height = c.height;
    context.configure({ device, format: 'rgba8unorm', alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    for (const mode of ['direct', 'indirect'] as const) {
      callbacks.phase('prepare', mode, 0, 2); check();
      renderers[mode] = new GpuDrivenRenderer(device, context, 'rgba8unorm', instances, geometry, 'atomic', mode);
    }
    await bounded(device.queue.onSubmittedWorkDone(), signal); check();
    gpuPreparationWallMs = performance.now() - setupStart;
    setPose(0); renderers.direct!.renderFrame(camera, 0);
    await bounded(device.queue.onSubmittedWorkDone(), signal); check();
    firstGpuCompleteMs = performance.now() - started;

    // Readback and A/A control replay every measured pose before timing, never inside a frame sample.
    for (let frame = 0; frame < c.samples; frame++) {
      callbacks.phase('verify', 'A/A/B', frame, c.samples); check(); setPose(frame);
      renderers.direct!.renderFrame(camera, frame); const a = await capture(device, context, c, signal);
      const idsA = Array.from(await renderers.direct!.readVisibleIds(signal)).sort((a, b) => a - b);
      renderers.direct!.renderFrame(camera, frame); const aa = await capture(device, context, c, signal);
      renderers.indirect!.renderFrame(camera, frame); const b = await capture(device, context, c, signal);
      const idsB = Array.from(await renderers.indirect!.readVisibleIds(signal)).sort((a, b) => a - b);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
      const expected = instances.filter(i => frustum.intersectsSphere(new THREE.Sphere(i.boundingSphere.center, i.boundingSphere.radius))).map(i => i.id);
      const repeat = compareImages(a, aa), candidate = compareImages(a, b);
      // A blank image cannot certify a renderer, even when both images are identical.
      let nonUniformPixels = 0;
      for (let i = 4; i < a.length; i += 4) if (a[i] !== a[0] || a[i + 1] !== a[1] || a[i + 2] !== a[2]) nonUniformPixels++;
      const passed = !repeat.differentPixels && !candidate.differentPixels && nonUniformPixels > 0
        && JSON.stringify(idsA) === JSON.stringify(expected) && JSON.stringify(idsB) === JSON.stringify(expected);
      quality.push({ frame, passed, repeat, candidate, nonUniformPixels, idsA, idsB, expected,
        hashes: { a: await digest(a), aa: await digest(aa), b: await digest(b) } });
      check();
      if (!passed) return { status: 'failed' as const, reason: 'Image/visibility correctness gate failed', scene, quality, blocks: [],
        preparationCpuMs, gpuPreparationWallMs, firstGpuCompleteMs, errors };
      await nextFrame(signal);
    }
    for (const [block, mode] of (['direct', 'indirect', 'indirect', 'direct'] as const).entries()) {
      callbacks.phase('warmup', mode, block, 4); check();
      for (let i = 0; i < c.warmup; i++) { await nextFrame(signal); setPose(i % c.samples); renderers[mode]!.renderFrame(camera, i); }
      await bounded(device.queue.onSubmittedWorkDone(), signal); check();
      timer = device.features.has('timestamp-query') ? new TimestampBatch(device, c.samples, mode === 'direct' ? 1 : 2) : undefined;
      timer?.begin(c.samples);
      callbacks.phase('measure', mode, block, 4); check();
      const raw: typeof blocks[number]['raw'] = [], intervals: number[] = [];
      const blockRecord: typeof blocks[number] = { block, mode, raw, cpuFrameMs: null, submitMs: null, gpuMs: null,
        cadence: cadence([]), timestampQuality: null };
      blocks.push(blockRecord);
      const windowStart = performance.now();
      let previous: number | null = null;
      for (let frame = 0; frame < c.samples; frame++) {
        const rafTime = await nextFrame(signal); check();
        if (previous !== null) intervals.push(rafTime - previous); previous = rafTime;
        const start = performance.now(); setPose(frame);
        const result = renderers[mode]!.renderFrame(camera, frame, timer, frame);
        raw.push({ frame, rafTime, cpuFrameMs: performance.now() - start, submitMs: result.submitMs,
          drawCalls: result.drawCalls, gpuMs: null as number | null,
          // Deterministic replay readback counts; not a hardware primitive counter.
          visibleInstancesFromReplay: quality[frame].idsB.length,
          submittedTrianglesFromReplay: quality[frame].idsB.length * geometry.index!.count / 3 });
      }
      if (timer) await bounded(timer.collect(), signal); else await bounded(device.queue.onSubmittedWorkDone(), signal);
      check();
      const windowWallMs = performance.now() - windowStart;
      if (timer) raw.forEach((row, i) => {
        const value = timer!.frameSpanMs[i];
        row.gpuMs = Number.isFinite(value) && value >= 0 && value <= windowWallMs ? value : null;
        if (row.gpuMs === null) throw new Error('Invalid GPU timestamp envelope; timing gate failed');
      });
      Object.assign(blockRecord, { cpuFrameMs: summarize(raw.map(v => v.cpuFrameMs)),
        submitMs: summarize(raw.map(v => v.submitMs)), gpuMs: raw.every(v => v.gpuMs !== null) ? summarize(raw.map(v => v.gpuMs!)) : null,
        cadence: cadence(intervals), timestampQuality: timer ? Array.from(timer.quality) : null });
      timer?.destroy(); timer = undefined;
    }
    return { status: 'measured' as const, reason: null, scene, quality, blocks,
      preparationCpuMs, gpuPreparationWallMs, firstGpuCompleteMs, errors };
  } catch (error) {
    errors.push(String(error));
    return { status: 'failed' as const, reason: String(error), scene, quality, blocks,
      preparationCpuMs, gpuPreparationWallMs, firstGpuCompleteMs, errors };
  } finally {
    timer?.destroy();
    renderers.direct?.dispose(); renderers.indirect?.dispose(); geometry.dispose();
    context.unconfigure(); canvas.width = previousSize[0]; canvas.height = previousSize[1];
    device.removeEventListener('uncapturederror', onError);
  }
}
