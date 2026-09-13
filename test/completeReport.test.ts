import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { completeReport } from '../shared/archive/index.ts';

test('complete markdown keeps special values and embedded media byte-for-byte', () => {
  const bytes = Buffer.from([0, 1, 2, 3, 255]);
  const input = { measured: null, missing: undefined, invalid: NaN, infinite: Infinity, image: `data:image/png;base64,${bytes.toString('base64')}`, nested: { error: new Error('capture failed') } };
  const report = completeReport({ testId: '15-virtualized-integration', humanMarkdown: '# Diagnostic', result: input, archivedAt: '2026-09-13T10:00:00.000Z' });
  assert.deepEqual((report.result as Record<string, unknown>).missing, { $undefined: true });
  assert.deepEqual((report.result as Record<string, unknown>).invalid, { $number: 'NaN' });
  assert.equal(report.media[0]?.bytes, bytes.byteLength);
  assert.equal(report.media[0]?.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(Buffer.from(report.media[0]?.base64 ?? '', 'base64'), bytes);
});
