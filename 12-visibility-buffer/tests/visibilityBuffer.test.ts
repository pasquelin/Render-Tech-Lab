import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKGROUND_VISIBILITY_ID,
  packVisibilityId,
  reconstructVisibilitySample,
  runVisibilityCampaign,
  unpackVisibilityId,
} from '../implementation/visibilityBuffer.ts';

test('reserves zero for background and round-trips maximum valid IDs', () => {
  assert.equal(packVisibilityId(0, 0), 1);
  const packed = packVisibilityId(0xffff - 1, 0xffff);
  assert.deepEqual(unpackVisibilityId(packed), [0xffff - 1, 0xffff]);
  assert.equal(unpackVisibilityId(BACKGROUND_VISIBILITY_ID), null);
});

test('rejects IDs that cannot fit without colliding with the background sentinel', () => {
  assert.throws(() => packVisibilityId(0xffff, 0xffff), /capacity/i);
});

test('reconstructs depth and perspective attributes from the winning triangle', () => {
  const sample = reconstructVisibilitySample({
    pixelCoord: [100 / 3, 100 / 3],
    triangleVertices2D: [[0, 0], [100, 0], [0, 100]],
    clipW: [1, 2, 4],
    clipZ: [0.2, 0.8, 1.6],
    attributes: [[0, 10, 20], [1, 0, 1]],
  });
  assert.ok(Math.abs(sample.attributes[0] - 40 / 7) < 1e-6);
  assert.ok(Number.isFinite(sample.depth));
});

test('campaign validates visibility before shading and reports separate measurements', async () => {
  const stages: string[] = [];
  const result = await runVisibilityCampaign({
    objectCounts: [100], warmup: 1, samples: 2,
    onProgress: (event) => stages.push(event.stage),
    execute: async () => ({
      visibilityMs: null, shadingMs: null, forwardMs: null, materialLookupMs: null,
      expectedIds: new Uint32Array([0, 1]), actualIds: new Uint32Array([0, 1]),
      expectedDepth: new Float32Array([1, 0.5]), actualDepth: new Float32Array([1, 0.5]),
      shadedPixels: 1, forwardFragments: 2,
    }),
  });
  assert.equal(result.records[0].correct, true);
  assert.equal(result.records[0].visibilityMs, null);
  assert.equal(result.records[0].shadingMs, null);
  assert.deepEqual(stages.slice(-2), ['shading', 'complete']);
});

test('campaign refuses to publish measurements when ID correctness fails', async () => {
  await assert.rejects(runVisibilityCampaign({
    objectCounts: [1], warmup: 0, samples: 1,
    execute: async () => ({
      visibilityMs: 1, shadingMs: 1, forwardMs: 2, materialLookupMs: 0,
      expectedIds: new Uint32Array([1]), actualIds: new Uint32Array([2]),
      expectedDepth: new Float32Array([0.5]), actualDepth: new Float32Array([0.5]),
      shadedPixels: 1, forwardFragments: 1,
    }),
  }), /correctness/i);
});
