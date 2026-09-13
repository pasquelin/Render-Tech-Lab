import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { comparisonRetention, directoryRetention } from '../benchmarks/campaignRetention.ts';

test('retention keeps only the two newest complete comparison bundles', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retention-'));
  for (let index = 0; index < 6; index++) for (const suffix of ['json', 'md', 'sources.json']) await writeFile(path.join(root, `run-${index}.${suffix}`), suffix === 'json' ? JSON.stringify({ timestamp: new Date(1000 + index * 1000).toISOString() }) : suffix);
  await writeFile(path.join(root, 'REFERENCE.md'), 'protected');
  const result = await comparisonRetention(root, true);
  assert.deepEqual([result.before, result.after], [6, 2]);
  assert.equal((await readdir(root)).some(name => name.startsWith('run-0.')), false);
  assert.equal((await readdir(root)).some(name => name.startsWith('run-3.')), false);
  assert.equal(await readFile(path.join(root, 'REFERENCE.md'), 'utf8'), 'protected');
});

test('dry-run purges nothing and generated directory archives stay independent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retention-dirs-'));
  for (let index = 0; index < 6; index++) { const dir = path.join(root, `15-ui-${index}`); await mkdir(dir); await writeFile(path.join(dir, 'raw.json'), JSON.stringify({ archivedAt: new Date(1000 + index * 1000).toISOString() })); await writeFile(path.join(dir, 'capture.png'), 'pixels'); }
  const dry = await directoryRetention(root, '15-ui-', false);
  assert.deepEqual([dry.before, dry.after, (await readdir(root)).length], [6, 2, 6]);
  await directoryRetention(root, '15-ui-', true);
  assert.deepEqual((await readdir(root)).sort(), ['15-ui-4', '15-ui-5']);
});
