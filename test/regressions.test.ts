import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createBenchRunner } from '../shared/benchmark/runner.ts';
import { extractSeries } from '../shared/benchmark/chart.ts';
import * as hiz from '../shared/math/hiz.ts';
import * as compaction from '../shared/math/compaction.ts';
import { buildHiZPyramid, queryHiZ } from '../07-hiz/implementation/hizPyramid.ts';
import { LodBenchmarkRunner } from '../04-gpu-lod/benchmark/runner.ts';

test('empty observations cannot become a measured benchmark', async () => {
  const runner = createBenchRunner({ test: 'test' });
  const [record] = await runner.runTiers([{ label: 'empty', value: 1 }], () => ({}));
  assert.equal(record.status, 'not-run');
  assert.equal(record.gpu.frameMs, null);
});

test('charts never plot an unexecuted record even when an old value remains', async () => {
  const runner = createBenchRunner({ test: 'test' });
  const [record] = await runner.runTiers([{ label: 'missing', value: 1 }], () => null);
  record.gpu.frameMs = 42;
  assert.equal(extractSeries([record], () => 1, r => r.gpu.frameMs)[0].value, null);
});

test('equal depth cannot reject a visible surface', () => {
  for (const reversed of [false, true]) {
    const p = buildHiZPyramid([[0.5, 0.5], [0.5, 0.5]], reversed);
    assert.equal(queryHiZ(p, { x0: 0, y0: 0, x1: 2, y1: 2 }, 0.5, reversed).occluded, false);
  }
});

test('typed Hi-Z keeps every NPOT border and rejects invalid capacities', () => {
  const reduce = (hiz as Record<string, unknown>).hizReduceInto as Function;
  assert.equal(typeof reduce, 'function');
  assert.throws(() => reduce(new Float32Array(4), 2, 2, new Float32Array(0)));
  assert.throws(() => reduce(new Float32Array(4), 0, 2, new Float32Array(1)));
  for (let w = 1; w <= 17; w++) for (let h = 1; h <= 17; h++) {
    const src = Float32Array.from({ length: w * h }, (_, i) => (i * 71 % 101) / 100);
    const matrix = Array.from({ length: h }, (_, y) => [...src.subarray(y * w, (y + 1) * w)]);
    for (const reversed of [false, true]) {
      const out = new Float32Array(Math.ceil(w / 2) * Math.ceil(h / 2));
      reduce(src, w, h, out, reversed);
      assert.deepEqual([...out], hiz.hizReduceCeil(matrix, reversed).flat());
    }
  }
});

test('typed compaction preserves ordering and rejects nonbinary flags', () => {
  const compact = (compaction as Record<string, unknown>).compactIdsInto as Function;
  assert.equal(typeof compact, 'function');
  assert.throws(() => compact(new Uint32Array([9]), new Uint32Array([2]), new Uint32Array(1)));
  for (const n of [0, 1, 127, 128, 129, 1025]) {
    const ids = Uint32Array.from({ length: n }, (_, i) => i + 20);
    const flags = Uint32Array.from({ length: n }, (_, i) => Number(i % 3 === 0));
    const out = new Uint32Array(n);
    const count = compact(ids, flags, out);
    assert.deepEqual([...out.subarray(0, count)], [...ids].filter((_, i) => flags[i] === 1));
  }
});

test('CPU/WASM LOD measurements never claim GPU execution', async () => {
  const { latestJson } = await new LodBenchmarkRunner().runFullSuite();
  assert.equal(latestJson.gpu.frameMs, null);
  assert.equal(latestJson.environment.gpu, null);
  assert.equal(latestJson.status, 'measured');
  assert.equal(latestJson.customMetrics.execution, 'cpu-wasm');
});

test('unit suites cannot overwrite physical benchmark artifacts', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rtl-unit-artifacts-'));
  try {
    const script = fileURLToPath(new URL('./run_all_tests.ts', import.meta.url));
    const result = spawnSync(process.execPath, ['--experimental-strip-types', script], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(cwd), [], 'Unit tests wrote campaign artifacts');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('unexecuted pipeline never returns a fabricated gain or integration verdict', async () => {
  const { executeFullPipeline } = await import('../13-full-gpu-driven/implementation/fullPipeline.ts');
  const r = executeFullPipeline({ instanceCount: 100000, trianglesPerInstance: 384, viewportWidth: 1920, viewportHeight: 1080 });
  assert.equal(r.totalGainMs, null);
  assert.equal(r.verdict, 'not-yet-decided');
  assert(r.stages.every(stage => stage.durationMs === null));
});

test('timestamp batches enforce query lifecycle and reject invalid chronology', async () => {
  const { TimestampBatch } = await import('../shared/gpu/timing.ts');
  Object.assign(globalThis, { GPUBufferUsage: { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 }, GPUMapMode: { READ: 1 } });
  let unmaps = 0, payload = new BigUint64Array([100n, 110n, 120n, 150n]);
  const device = { features: new Set(['timestamp-query']), lost: new Promise(() => {}),
    createQuerySet: () => ({ destroy() {} }), createBuffer: () => ({ mapAsync: async () => {},
      getMappedRange: () => payload.buffer, unmap: () => { unmaps++; }, destroy() {} }) } as unknown as GPUDevice;
  const encoder = { resolveQuerySet() {}, copyBufferToBuffer() {} } as unknown as GPUCommandEncoder;
  const timer = new TimestampBatch(device, 1, 2);
  assert.throws(() => timer.writes(0, 0));
  timer.begin(1); timer.writes(0, 0);
  assert.throws(() => timer.writes(0, 0));
  assert.throws(() => timer.resolve(encoder));
  timer.writes(0, 1); timer.resolve(encoder); timer.submitted(); await timer.collect();
  assert.equal(timer.frameSpanMs[0], 0.00005);
  assert.equal(unmaps, 1);
  payload = new BigUint64Array([110n, 100n, 120n, 150n]);
  timer.begin(1); timer.writes(0, 0); timer.writes(0, 1); timer.resolve(encoder); timer.submitted(); await timer.collect();
  assert(Number.isNaN(timer.frameSpanMs[0]));
  assert(Number.isNaN(timer.passMs[0]));
  assert.equal(timer.quality[0], 2);
  assert.equal(unmaps, 2);
  timer.destroy(); assert.throws(() => timer.begin(1));
});

test('fallback reports latency without inventing GPU chart points', async () => {
  const { comparisonReport, comparisonChart } = await import('../shared/benchmark/report.ts');
  const records = [{ scene: { objects: 129 }, customMetrics: { variant: 'workgroup', method: 'queue-completion' as const,
    cpuMs: [1, 2, 3], gpuMs: [null, null, null], completionMs: [4, 5, 6], validSamples: 3, resolutionLimitedSamples: 0 } }];
  assert.match(comparisonReport(records), /queue-completion.*n\/a.*5.0000/);
  assert(!comparisonChart(records).includes('<circle'));
});

test('scan rejects overlapping shifted views before corrupting unread flags', () => {
  const flags = new Uint32Array([1, 0, 1, 1]);
  assert.throws(() => compaction.exclusiveScanInto(flags.subarray(0, 3), flags.subarray(1)));
  const same = new Uint32Array([1, 0, 1]);
  assert.equal(compaction.exclusiveScanInto(same, same), 2);
  assert.deepEqual([...same], [0, 1, 1]);
});
