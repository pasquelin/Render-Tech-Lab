import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldMatrix, worldMatrixTotals } from '../scenarios/worldMatrix.ts';
import type { WorldOptions } from '../contracts.ts';

const base: WorldOptions = {
  width: 1920, height: 1080, pixelRatio: 1, districts: 9, samples: 120, warmup: 30, shadows: true,
  candidate: 'frustum', fov: 60, antialias: false, shadowMapSize: 2048, path: 'mixed',
};

test('single configuration preserves explicit settings, injects ABBA then BAAB, and counts common warmup', () => {
  const runs = createWorldMatrix(base, 2, {});
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0], { ...base, order: 'ABBA' });
  assert.deepEqual(runs[1], { ...base, order: 'BAAB' });
  assert.notEqual(runs[0], runs[1]);
  assert.equal(base.order, undefined);
  assert.deepEqual(worldMatrixTotals(runs), {
    campaigns: 2, measuredFrames: 960, warmupFrames: 300, controlFrames: 36, totalFrames: 1296,
  });
});

test('main matrix crosses every selected dimension and keeps advanced settings fixed', () => {
  const runs = createWorldMatrix(base, 2, { districts: true, resolutions: true, shadows: true, methods: true });
  assert.equal(runs.length, 216);
  assert.equal(new Set(runs.map(run => JSON.stringify({ ...run, order: undefined }))).size, 108);
  assert.ok(runs.every(run => run.fov === 60 && run.antialias === false && run.path === 'mixed' && run.shadowMapSize === 2048));
  assert.deepEqual(new Set(runs.map(run => run.candidate)), new Set([
    'frustum', 'hierarchy', 'shadow-cache', 'static-cache', 'adaptive-frustum', 'adaptive-coherent',
  ]));
  assert.deepEqual(runs.slice(0, 2).map(run => run.order), ['ABBA', 'ABBA']);
  assert.deepEqual(runs.slice(-2).map(run => run.order), ['BAAB', 'BAAB']);
});

test('full matrix includes retina and advanced axes without repeating irrelevant shadow sizes', () => {
  const runs = createWorldMatrix(base, 1, {
    districts: true, resolutions: true, retina: true, shadows: true, methods: true,
    fov: true, antialias: true, path: true, shadowMapSize: true,
  });
  assert.equal(runs.length, 5184);
  assert.equal(new Set(runs.map(run => JSON.stringify(run))).size, runs.length);
  assert.ok(runs.filter(run => !run.shadows).every(run => run.shadowMapSize === 2048));
  assert.deepEqual(new Set(runs.map(run => run.fov)), new Set([45, 60, 90]));
  assert.deepEqual(new Set(runs.map(run => run.path)), new Set(['mixed', 'panorama', 'perimeter']));
});

test('retina is not duplicated and invalid repetitions are refused', () => {
  assert.equal(createWorldMatrix({ ...base, pixelRatio: 2 }, 1, { retina: true }).length, 1);
  for (const n of [0, 4, 1.5, NaN]) assert.throws(() => createWorldMatrix(base, n, {}));
});
