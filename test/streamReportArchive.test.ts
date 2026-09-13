import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { writeStreamedReportArchive } from '../shared/archive/index.ts';

test('streamed archive keeps an unbounded payload in the common compressed package', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-'));
  const raw = `{"samples":["${'x'.repeat(2 * 1024 * 1024)}"],"status":"completed"}`;
  const saved = await writeStreamedReportArchive(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport' }, Readable.from([raw.slice(0, 17), raw.slice(17)]));
  const markdown = await readFile(saved.reportPath, 'utf8');
  assert.match(markdown, /Données brutes compressées/);
  assert.ok((await stat(saved.package.resultPath)).size > 0);
});
