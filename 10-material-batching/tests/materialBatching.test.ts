import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMaterialSubmissionPlan,
  runMaterialBatchingCampaign,
} from '../implementation/materialBatcher.ts';

test('state-switch counts transitions from the deterministic draw order', () => {
  const plan = buildMaterialSubmissionPlan([0, 0, 2, 2, 0], 'state-switch');
  assert.equal(plan.drawCount, 5);
  assert.equal(plan.pipelineStateChanges, 3);
  assert.equal(plan.bindGroupChanges, 3);
  assert.deepEqual(plan.batches.map((batch) => batch.materialId), [0, 2, 0]);
});

test('indexed strategies keep one pipeline and preserve every draw', () => {
  for (const strategy of ['storage-buffer', 'texture-array', 'pseudo-bindless'] as const) {
    const plan = buildMaterialSubmissionPlan([2, 0, 2, 1], strategy);
    assert.equal(plan.pipelineStateChanges, 1);
    assert.equal(plan.bindGroupChanges, 1);
    assert.deepEqual(plan.drawMaterialIds, [2, 0, 2, 1]);
  }
});

test('campaign is bounded, reports progress, and keeps unavailable metrics null', async () => {
  const progress: number[] = [];
  const result = await runMaterialBatchingCampaign({
    materialCounts: [1, 10],
    objectCount: 20,
    strategies: ['state-switch', 'storage-buffer'],
    warmup: 1,
    samples: 2,
    onProgress: (event) => progress.push(event.completed / event.total),
    measure: async ({ plan }) => ({
      cpuFrameMs: null,
      gpuFrameMs: null,
      submittedDraws: plan.drawCount,
      correctnessDigest: 'same-pixels',
    }),
  });

  assert.equal(result.records.length, 4);
  assert.equal(result.completed, 4);
  assert.equal(progress.at(-1), 1);
  assert.ok(result.records.every((record) => record.cpuFrameMs === null));
});

test('campaign stops before another scenario after cancellation', async () => {
  const controller = new AbortController();
  let measurements = 0;
  await assert.rejects(
    runMaterialBatchingCampaign({
      materialCounts: [1, 10], objectCount: 10, strategies: ['state-switch'], warmup: 0, samples: 1,
      signal: controller.signal,
      measure: async () => { measurements++; controller.abort(); return { cpuFrameMs: null, gpuFrameMs: null, submittedDraws: 10, correctnessDigest: 'same-pixels' }; },
    }),
    { name: 'AbortError' },
  );
  assert.equal(measurements, 1);
});

test('campaign rejects a strategy whose output differs from the baseline', async () => {
  await assert.rejects(runMaterialBatchingCampaign({
    materialCounts: [2], objectCount: 4, strategies: ['state-switch', 'storage-buffer'], warmup: 0, samples: 1,
    measure: async ({ plan }) => ({ cpuFrameMs: null, gpuFrameMs: null, submittedDraws: 4,
      correctnessDigest: plan.strategy === 'state-switch' ? 'reference' : 'different' }),
  }), /correctness/i);
});
