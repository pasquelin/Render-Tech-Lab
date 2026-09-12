import assert from 'node:assert/strict';
import test from 'node:test';
import { configuration, blockedScenarios, pose, cadence, compareImages, summarize, nextFrame } from '../scenarios/protocol.ts';
import { generateTestInstances } from '../../01-indirect-draw/index.ts';
import { createVirtualizedIntegrationRunner } from '../runner/index.ts';

test('all ten architecture scenarios are blocked with null measurements', () => {
  const scenarios = blockedScenarios(); assert.equal(scenarios.length, 10);
  for (const s of scenarios) { assert.equal(s.status, 'not-run'); assert.ok(s.reason); assert.ok(Object.values(s.metrics).every(v => v === null)); }
  scenarios[0].reason = scenarios[1].reason; assert.notEqual(blockedScenarios()[0].reason, scenarios[1].reason);
});
test('bounded configuration rejects unbounded and invalid work', () => {
  for (const key of Object.keys(configuration())) for (const value of [NaN, Infinity, -1, .5, 1e10])
    assert.throws(() => configuration({ [key]: value }), RangeError);
});
test('identical seeds and frame indices reconstruct identical inputs; input size changes matter', () => {
  const scene = () => generateTestInstances(16, 42).map(i => ({ matrix: i.matrix.elements, color: i.color.toArray() }));
  assert.deepEqual(scene(), scene());
  assert.notDeepEqual(generateTestInstances(2, 42), generateTestInstances(2, 43));
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => pose(i, 8)), Array.from({ length: 8 }, (_, i) => pose(i, 8)));
  assert.notDeepEqual(pose(0, 8), pose(7, 8));
});
test('durations, percentiles and cadence have distinct provenance', () => {
  assert.equal(cadence([10, 20, 60]).fps, 1000 / 30);
  assert.equal(cadence([10, 20, 60]).stuttersOver50Ms, 1);
  assert.equal(cadence([]).fps, null); assert.equal(cadence([NaN]).fps, null);
  assert.equal(summarize([1, 2, 3, 100])?.p95, 100);
});
test('image comparison detects a single channel hole rather than hiding it in the mean', () => {
  const a = new Uint8Array([0, 0, 0, 255, 10, 20, 30, 255]), b = a.slice(); b[4] = 0;
  assert.equal(compareImages(a, a).differentPixels, 0);
  assert.equal(compareImages(a, b).differentPixels, 1); assert.equal(compareImages(a, b).maxChannelError, 10);
  assert.throws(() => compareImages(a, new Uint8Array(1)));
});
test('missing GPU produces no diagnostic measures and preserves the scenario matrix', async () => {
  const result = await createVirtualizedIntegrationRunner().run();
  assert.equal(result.status, 'not-run'); assert.equal(result.archive.control, null);
  assert.equal(result.records.length, 0); assert.equal(result.archive.scenarios.length, 10);
});
test('pre-abort archives interruption and runner can run again', async () => {
  const controller = new AbortController(); controller.abort(); const runner = createVirtualizedIntegrationRunner();
  const result = await runner.run({ signal: controller.signal });
  assert.equal(result.status, 'not-run'); assert.match(result.archive.errors[0], /AbortError/);
  assert.equal((await runner.run()).archive.errors.length, 0);
});
test('RAF cancellation removes pending callback', async () => {
  const oldRAF = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  let cancelled: number | null = null;
  globalThis.requestAnimationFrame = () => 123;
  globalThis.cancelAnimationFrame = id => { cancelled = id; };
  try {
    const controller = new AbortController(), pending = nextFrame(controller.signal); controller.abort();
    await assert.rejects(pending, { name: 'AbortError' }); assert.equal(cancelled, 123);
  } finally { globalThis.requestAnimationFrame = oldRAF; globalThis.cancelAnimationFrame = oldCancel; }
});

test('aborting an in-flight GPU ID readback destroys the mapping buffer', async () => {
  const { GpuDrivenRenderer } = await import('../../01-indirect-draw/index.ts');
  let rejectMap: (reason: Error) => void = () => {}, destroyed = 0;
  const read = { mapState: 'pending', destroy() { destroyed++; rejectMap(new Error('mapping cancelled')); },
    mapAsync() { return new Promise<void>((_, reject) => { rejectMap = reject; }); } };
  const renderer = Object.assign(Object.create(GpuDrivenRenderer.prototype) as object, {
    instances: [], indirectBuffer: {}, device: { createBuffer: () => read,
      createCommandEncoder: () => ({ copyBufferToBuffer() {}, finish() { return {}; } }), queue: { submit() {} } },
  }) as unknown as InstanceType<typeof GpuDrivenRenderer>;
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousUsage = globals.GPUBufferUsage, previousMap = globals.GPUMapMode;
  globals.GPUBufferUsage = { COPY_DST: 1, MAP_READ: 2 }; globals.GPUMapMode = { READ: 1 };
  try {
    const controller = new AbortController(), result = renderer.readVisibleIds(controller.signal); controller.abort();
    await assert.rejects(result, /mapping cancelled/); assert.ok(destroyed >= 1);
  } finally { globals.GPUBufferUsage = previousUsage; globals.GPUMapMode = previousMap; }
});
