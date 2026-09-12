import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GenericLabChart } from '../src/lab/GenericLabChart.ts';

test('native comparison legend reserves a complete row in a narrow sidebar', () => {
  const labels: Array<[string, number, number, number | undefined]> = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_target, key) => {
    if (key === 'fillText') return (label: string, x: number, y: number, max?: number) => labels.push([label, x, y, max]);
    if (key === 'createLinearGradient') return () => gradient;
    if (key === 'measureText') return () => ({ width: 60 });
    return () => {};
  }, set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => ({ width: 300, height: 176 }) } as unknown as HTMLCanvasElement;
  const chart = new GenericLabChart(canvas);
  chart.setActive(true);
  chart.update('Comparaison native', 'ms', [{ label: 'A1', valA: 1, valB: null }, { label: 'B1', valA: null, valB: 0.8 }], 1, 'gpu-driven',
    { a: 'A · Calcul CPU', b: 'B · Calcul GPU' });
  const a = labels.find(row => row[0] === 'A · Calcul CPU');
  const b = labels.find(row => row[0] === 'B · Calcul GPU');
  assert.deepEqual(a?.slice(1, 3), [24, 34]);
  assert.deepEqual(b?.slice(1, 3), [166, 34]);
  assert.ok((a?.[3] ?? 0) > 0 && (b?.[3] ?? 0) > 0);
  assert.ok(labels.filter(row => row[0] === 'A1' || row[0] === 'B1').every(row => row[2] >= 166), 'plot labels stay below the reserved legend row');
});

test('reset removes every series, category, legend and highlight from the previous bench', () => {
  const labels: string[] = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_target, key) => {
    if (key === 'fillText') return (label: string) => labels.push(label);
    if (key === 'createLinearGradient') return () => gradient;
    if (key === 'measureText') return () => ({ width: 60 });
    return () => {};
  }, set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => ({ width: 300, height: 176 }) } as unknown as HTMLCanvasElement;
  const chart = new GenericLabChart(canvas);
  chart.setActive(true);
  chart.update('09 · Compaction', 'ms', [{ label: 'atomic', valA: 1, valB: 0.5 }, { label: 'workgroup', valA: 2, valB: 0.8 }], 1, 'gpu-driven', { a: 'Atomic', b: 'Workgroup' });
  labels.length = 0;
  chart.reset('Préparation de 03 · GPU Scene');
  assert.deepEqual(labels, ['Préparation de 03 · GPU Scene']);
});
