import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readReportArchive, writeReportArchive } from '../shared/archive/index.ts';
import { archiveContract } from '../02-gpu-frustum-culling/index.ts';

test('common archive preserves pilot 02 historical paths and reads missing legacy reports', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-archive-'));
  assert.equal(await readReportArchive(root, '02-gpu-frustum-culling'), null);
  await writeReportArchive(root, { testId: '02-gpu-frustum-culling', markdown: '# 02', latest: { timestamp: '2026-09-12T12:00:00Z', status: 'measured' } });
  assert.equal(await readReportArchive(root, '02-gpu-frustum-culling'), '# 02');
  assert.equal(JSON.parse(await readFile(path.join(root, '02-gpu-frustum-culling/results/latest.json'), 'utf8')).status, 'measured');
  assert.equal(archiveContract.endpoint, '/api/save-report');
  assert.equal(archiveContract.retention, 5);
});
