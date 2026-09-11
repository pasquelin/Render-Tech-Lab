import assert from 'node:assert/strict';
import { selectLodsOnCpu } from '../cpuLodSelector.ts';
import { calculateScreenSpacePixels, evaluateLodTier } from '../../shared/math/screenSpaceError.ts';
import { preparedScreenSpacePixels, selectLodsPrepared, selectLodsGuarded } from './variants.ts';

// Correctness only: returned durations are checked for shape, never compared.
const variants = [selectLodsPrepared, selectLodsGuarded];
let comparisons = 0;
let comparedInstances = 0;
const view = new DataView(new ArrayBuffer(8));
function neighbor(value: number, steps: number): number {
  if (value === 0) return steps > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + (value > 0 ? BigInt(steps) : -BigInt(steps)));
  return view.getFloat64(0);
}
function compare(args: Parameters<typeof selectLodsOnCpu>): void {
  const before = args.slice(0, 3).map(value => Array.from(value as ArrayLike<number>));
  const reference = selectLodsOnCpu(...args);
  for (const select of variants) {
    const actual = select(...args);
    assert.deepEqual(actual.selectedLods, reference.selectedLods);
    assert.deepEqual(actual.lodCounts, reference.lodCounts);
    assert.ok(Number.isFinite(actual.durationMs) && actual.durationMs >= 0);
    for (let i = 0; i < 3; i++) assert.deepEqual(Array.from(args[i] as ArrayLike<number>), before[i]);
    comparisons++;
    comparedInstances += reference.selectedLods.length;
  }
}

// Exact rational enclosure proof, with u=1/n and the final multiplication rounded.
const n = 2n ** 53n;
assert.ok((n - 32n) * (n + 1n) ** 10n < (n - 1n) ** 4n * n ** 7n);
assert.ok((n + 32n) * (n - 1n) ** 10n > (n + 1n) ** 4n * n ** 7n);

const special = [-Infinity, -1, -0, 0, Number.MIN_VALUE, 0.0001, neighbor(0.0001, 1), 1, 2 ** 100, Number.MAX_VALUE, Infinity, NaN];
for (const height of special) for (const fov of special) for (const radius of special) {
  compare([new Float32Array([1, 0, 0, 0, 0, 0]), new Float32Array([radius, radius]), [0, 0, 0], height, fov]);
}
for (const diameter of special) for (const distance of special) for (const fov of special) {
  const reference = calculateScreenSpacePixels(diameter, distance, 1080, fov);
  const prepared = preparedScreenSpacePixels(diameter, distance, 1080, fov, Math.tan(fov * 0.5));
  assert.ok(Object.is(reference, prepared));
  assert.equal(evaluateLodTier(reference), evaluateLodTier(prepared));
}
compare([new Float32Array(), new Float32Array(), [0, 0, 0], 1080, Math.PI / 3]);
for (const camera of [[], [0], [NaN, 0, 0], [Infinity, 0, 0], [-Infinity, -0, 0]]) {
  compare([new Float32Array([0]), new Float32Array([0, 1, -1, NaN]), camera as [number, number, number], 1080, Math.PI / 3]);
}

let seed = 6345738;
const random = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (const unique of [false, true]) {
  const count = 10000, positions = new Float32Array(count * 3), radii = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([(random() - 0.5) * 1000, (random() - 0.5) * 1000, (random() - 0.5) * 1000], i * 3);
    radii[i] = unique ? random() * 10 + 0.001 : 0.25 + (i % 11) * 0.125;
  }
  for (const height of [1, 1080, 2160]) for (const fov of [0.1, Math.PI / 3, Math.PI / 2, 3.2, 7]) {
    compare([positions, radii, [0, 0, 0], height, fov]);
    compare([positions, radii, [2, -1, 4], height, fov]);
  }
  radii[0] = 17; radii[99] = 0.2;
  compare([positions, radii, [0, 0, 0], 1080, Math.PI / 3]);
  for (const thresholds of [{ lod0: 20, lod1: 500 }, { lod0: NaN, lod1: Infinity }, { lod0: 0, lod1: -0 }]) {
    compare([positions, radii, [0, 0, 0], 1080, Math.PI / 3, thresholds]);
  }
}

// Binary64 arrays intentionally keep the ulps around decision/guard boundaries.
// The production input type stays Float32Array; this also exercises JS runtime inputs.
for (const height of [2 ** -110, 0.1, 1, 1080, 2 ** 110]) {
  for (const fov of [0.01, 0.3, Math.PI / 3, Math.PI / 2, 3.1, 7]) {
    for (const radius of [2 ** -110, 0.0001, 1, 7.5, 2 ** 110]) {
      for (const threshold of [0.1, 60, 250, 2 ** 99]) {
        const approximateDistance = ((radius * 2) * height) / ((2 * Math.tan(fov * 0.5)) * threshold);
        for (const center of [approximateDistance, 0.0001, 0.0002]) {
          const positions: number[] = [];
          for (let k = -20; k <= 20; k++) positions.push(neighbor(center, k), 0, 0);
          compare([positions as unknown as Float32Array, Array(41).fill(radius) as unknown as Float32Array,
            [0, 0, 0], height, fov, { lod0: threshold, lod1: threshold / 4 }]);
        }
      }
    }
  }
}
for (let batch = 0; batch < 200; batch++) {
  const positions: number[] = [], radii: number[] = [];
  for (let i = 0; i < 100; i++) {
    for (let axis = 0; axis < 3; axis++) positions.push((random() - 0.5) * 2 ** Math.floor(random() * 2000 - 1000));
    radii.push((random() + 0.1) * 2 ** Math.floor(random() * 1800 - 900));
  }
  compare([positions as unknown as Float32Array, radii as unknown as Float32Array, [0, 0, 0],
    2 ** Math.floor(random() * 1800 - 900), random() * 8]);
}
for (const select of variants) {
  const args: Parameters<typeof selectLodsOnCpu> = [new Float32Array([1, 0, 0]), new Float32Array([1]), [0, 0, 0], 1080, 1];
  const first = select(...args), saved = first.selectedLods.slice();
  args[3] = 1;
  select(...args);
  assert.deepEqual(first.selectedLods, saved);
}
console.log(JSON.stringify({ status: 'passed', comparisons, comparedInstances,
  claim: 'Observed differential equality; guarded proof remains conditional on the declared sqrt accuracy.',
  benchmark: 'not run' }, null, 2));
