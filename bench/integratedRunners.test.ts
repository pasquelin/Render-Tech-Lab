import { createVirtualizedIntegrationRunner } from '../15-virtualized-integration/runner/index.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntegratedRunner, INTEGRATED_RUNNER_IDS } from '../shared/benchmark/integratedRunners.ts';
import { createFrustumCullingRunner } from '../02-gpu-frustum-culling/index.ts';
import { createMeshletsRunner } from '../05-meshlets/runner/index.ts';
import { createMeshletCullingRunner } from '../06-meshlet-culling/runner/index.ts';
import { createHiZRunner } from '../07-hiz/runner/index.ts';
import { createOcclusionCullingRunner } from '../08-occlusion-culling/runner/index.ts';
import { createGpuCompactionRunner } from '../09-gpu-compaction/runner/index.ts';
import { createMaterialBatchingRunner } from '../10-material-batching/runner/index.ts';
import { createGeometryStreamingRunner } from '../11-geometry-streaming/runner/index.ts';
import { createVisibilityBufferRunner } from '../12-visibility-buffer/runner/index.ts';

test('all requested modules expose an importable bounded runner', async () => {
  assert.deepEqual(INTEGRATED_RUNNER_IDS, [
    '02-gpu-frustum-culling',
    '05-meshlets',
    '06-meshlet-culling',
    '07-hiz',
    '08-occlusion-culling',
    '09-gpu-compaction',
    '10-material-batching',
    '11-geometry-streaming',
    '12-visibility-buffer',
    '15-virtualized-integration',
  ]);

  for (const id of INTEGRATED_RUNNER_IDS) {
    const runner = createIntegratedRunner(id);
    assert.equal(runner.id, id);
    assert.ok(runner.variants.length > 0);
    assert.equal(typeof runner.run, 'function');
  }
});

test('every module exposes its own shell-facing factory', () => {
  assert.deepEqual([
    createFrustumCullingRunner(), createMeshletsRunner(), createMeshletCullingRunner(),
    createHiZRunner(), createOcclusionCullingRunner(), createGpuCompactionRunner(),
    createMaterialBatchingRunner(), createGeometryStreamingRunner(), createVisibilityBufferRunner(), createVirtualizedIntegrationRunner(),
  ].map((runner) => runner.id), INTEGRATED_RUNNER_IDS);
});

test('CPU-backed runners publish real values, preserve null GPU timing and finish', async () => {
  const phases: string[] = [];
  const metrics: string[] = [];
  const result = await createIntegratedRunner('05-meshlets').run({
    samples: 2,
    onPhase: (event) => phases.push(event.phase),
    onMetrics: (event) => metrics.push(event.variant),
  });

  assert.equal(result.status, 'measured');
  assert.equal(result.gates.correctness, true);
  assert.equal(result.records.length, 4);
  assert.ok(result.records.every((record) => record.cpuMs !== null && record.cpuMs >= 0));
  assert.ok(result.records.every((record) => record.gpuMs === null));
  assert.deepEqual(metrics, ['64', '128', '256', '512']);
  assert.equal(phases.at(-1), 'complete');
});

test('variants are completed sequentially and abort prevents further work', async () => {
  const controller = new AbortController();
  const events: string[] = [];
  const runner = createIntegratedRunner('07-hiz');

  await assert.rejects(runner.run({
    samples: 1,
    signal: controller.signal,
    onPhase: (event) => {
      events.push(`${event.variant ?? '-'}:${event.phase}`);
      if (event.variant === '512-standard-z' && event.phase === 'measure') controller.abort();
    },
  }), { name: 'AbortError' });

  assert.ok(events.includes('512-standard-z:measure'));
  assert.ok(!events.some((event) => event.startsWith('1024-')));
});

test('GPU-only runners do not claim measurements without a physical WebGPU device', async () => {
  for (const id of ['02-gpu-frustum-culling', '09-gpu-compaction'] as const) {
    const result = await createIntegratedRunner(id).run({ samples: 1 });
    assert.equal(result.status, 'not-run');
    assert.equal(result.gates.correctness, null);
    assert.ok(result.records.every((record) => record.gpuMs === null));
  }
});

test('every CPU form selection changes the configuration actually executed', async () => {
  const meshlets = await createIntegratedRunner('05-meshlets').run({ samples: 1, scenario: 'plane-1024' });
  assert.ok(meshlets.records.every(record => record.custom.triangles === 1024));

  const culling = await createIntegratedRunner('06-meshlet-culling').run({ samples: 1, scenario: 'backface-100' });
  assert.deepEqual(culling.records.map(record => record.variant), ['backface-100']);

  const hiz = await createIntegratedRunner('07-hiz').run({ samples: 1, scenario: '2048' });
  assert.deepEqual(hiz.records.map(record => record.variant), ['2048-standard-z', '2048-reversed-z']);

  const occlusion = await createIntegratedRunner('08-occlusion-culling').run({ samples: 1, scenario: '5000-75' });
  assert.equal(occlusion.records[0].custom.expectedOcclusionRate, 0.75);
  assert.equal(Number(occlusion.records[0].custom.visible) + Number(occlusion.records[0].custom.occluded), 5000);

  const materials = await createIntegratedRunner('10-material-batching').run({ samples: 1, scenario: '250' });
  assert.ok(materials.records.every(record => record.custom.materials === 250));

  const streaming = await createIntegratedRunner('11-geometry-streaming').run({ samples: 1, scenario: '32mb' });
  assert.ok(streaming.records.every(record => record.custom.logicalBudgetBytes === 32 * 1024 * 1024));

  const visibility = await createIntegratedRunner('12-visibility-buffer').run({ samples: 1, scenario: '4k' });
  assert.deepEqual(visibility.records.map(record => [record.variant, record.custom.width, record.custom.height]), [['4k', 3840, 2160]]);
});

test('Hi-Z variant names select their exact depth convention', async () => {
  const reversed = await createIntegratedRunner('07-hiz').run({ samples: 1, scenario: '512' });
  assert.deepEqual(reversed.records.map(record => [record.variant, record.custom.convention]), [
    ['512-standard-z', 'standard-z'], ['512-reversed-z', 'reversed-z'],
  ]);
  assert.ok(Math.abs(Number(reversed.records[0].custom.rootDepth) - 0.9) < 1e-6);
  assert.ok(Math.abs(Number(reversed.records[1].custom.rootDepth) - 0.1) < 1e-6);
  const standard = await createIntegratedRunner('07-hiz').run({ samples: 1, scenario: '1024' });
  assert.deepEqual(standard.records.map(record => [record.variant, record.custom.convention]), [
    ['1024-standard-z', 'standard-z'],
    ['1024-reversed-z', 'reversed-z'],
  ]);
});
