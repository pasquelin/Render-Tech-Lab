import assert from 'node:assert/strict';
import test from 'node:test';

import { GeometryStreamingManager, runStreamingCampaign } from '../implementation/streamingLifecycle.ts';

const pages = [
  { id: 0, sizeBytes: 4, fallbackPageId: null, pinned: true },
  { id: 1, sizeBytes: 6, fallbackPageId: 0, pinned: false },
  { id: 2, sizeBytes: 6, fallbackPageId: 0, pinned: false },
];

test('never publishes a page before its matching generation completes', () => {
  const manager = new GeometryStreamingManager({ requestedFraction: 100, vramBudgetBytes: 10 }, 6);
  manager.registerPages(pages);
  const request = manager.requestPages([0, 1]);
  manager.completeUpload(1, request.generation - 1);
  assert.equal(manager.pages.get(1)?.state, 'loading');
  assert.equal(manager.residentBytes, 0);
  manager.completeUpload(0, request.generation);
  manager.completeUpload(1, request.generation);
  assert.equal(manager.residentBytes, 10);
});

test('returns the complete fallback cut while a fine page is unavailable', () => {
  const manager = new GeometryStreamingManager({ requestedFraction: 100, vramBudgetBytes: 10 }, 6);
  manager.registerPages(pages);
  const generation = manager.requestPages([0]).generation;
  manager.completeUpload(0, generation);
  assert.deepEqual(manager.resolveCut([1, 2]), { pageIds: [0], missingPageIds: [1, 2], complete: true });
});

test('evicts least recently used unpinned pages and respects the logical byte budget', () => {
  const manager = new GeometryStreamingManager({ requestedFraction: 100, vramBudgetBytes: 10 }, 6);
  manager.registerPages(pages);
  let generation = manager.requestPages([0, 1]).generation;
  manager.completeUpload(0, generation);
  manager.completeUpload(1, generation);
  generation = manager.requestPages([2]).generation;
  manager.completeUpload(2, generation);
  assert.equal(manager.residentBytes, 10);
  assert.equal(manager.pages.get(1)?.state, 'eviction');
  assert.equal(manager.pages.get(2)?.state, 'fully-resident');
});

test('streaming campaign finishes with progress and no physical memory claim', async () => {
  const events: string[] = [];
  const result = await runStreamingCampaign({
    pages,
    frames: [[0], [1], [2]],
    vramBudgetBytes: 10,
    uploadBudgetPerFrame: 6,
    loader: async (page) => ({ byteLength: page.sizeBytes }),
    onProgress: (event) => events.push(event.stage),
  });
  assert.equal(result.frames.length, 3);
  assert.equal(result.memory.ramBytes, null);
  assert.equal(result.memory.gpuBytes, null);
  assert.equal(events.at(-1), 'complete');
});
