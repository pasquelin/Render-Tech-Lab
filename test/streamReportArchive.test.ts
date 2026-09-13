import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createReportResultStream, repairStreamedReportPackage, writeStreamedReportArchive, writeStreamedReportPackage } from '../shared/archive/index.ts';

async function decompressed(resultPath: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of createReportResultStream(resultPath)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('streamed archive preserves raw bytes and derives an empty report without the old placeholder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-'));
  const raw = `{"samples":["${'x'.repeat(2 * 1024 * 1024)}"],"status":"completed"}`;
  const saved = await writeStreamedReportArchive(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport' }, Readable.from([raw.slice(0, 17), raw.slice(17)]));
  const markdown = await readFile(saved.reportPath, 'utf8');
  assert.match(markdown, /Données brutes compressées/);
  assert.doesNotMatch(markdown, /Le flux brut fait foi/);
  assert.match(markdown, /Aucun événement moteur/);
  assert.ok((await stat(saved.package.resultPath)).size > 0);
  assert.equal(await decompressed(saved.package.resultPath), raw);
  const manifest = JSON.parse(await readFile(saved.package.manifestPath, 'utf8')) as { objects: Array<{ path: string; sha256?: string }>; media: unknown[] };
  const object = manifest.objects.find(item => item.path === 'objects/result.json.gz');
  assert.equal(object?.sha256, createHash('sha256').update(await readFile(saved.package.resultPath)).digest('hex'));
  assert.deepEqual(manifest.media, []);
});

test('streamed extraction writes every event, keeps only the last 50 for Markdown, and extracts captures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-derived-'));
  const events = Array.from({ length: 75 }, (_, index) => ({ timestamp: new Date(index).toISOString(), level: 'info' as const, phase: 'trace', message: `event-${index}`, context: { index } }));
  const image = `data:image/jpeg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`;
  const rawObject = { status: 'completed', captures: [{ segment: 0, name: 'Vue générale', engine: 'engine-a', image }, { segment: 0, name: 'Vue générale', engine: 'engine-b', image }], engineEvents: events, nullable: null };
  const raw = JSON.stringify(rawObject);
  const saved = await writeStreamedReportPackage(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport' }, Readable.from([raw]));
  const lines = (await readFile(saved.engineLogPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, events.length);
  assert.deepEqual(JSON.parse(lines[0]), events[0]);
  const markdown = await readFile(saved.markdownPath, 'utf8');
  assert.match(markdown, /event-74/);
  assert.match(markdown, /Les 25 événements précédents/);
  assert.match(markdown, /Vue générale · 2 moteurs/);
  assert.match(markdown, /engine-a/);
  assert.match(markdown, /engine-b/);
  const manifest = JSON.parse(await readFile(saved.manifestPath, 'utf8')) as { objects: Array<{ path: string; entries?: number }>; media: Array<{ path: string; sha256: string; bytes: number }> };
  assert.equal(manifest.objects.find(item => item.path === 'logs/engine-events.jsonl')?.entries, 75);
  assert.equal(manifest.media.length, 1);
  assert.equal(manifest.media[0]?.bytes, 10);
  assert.ok(await stat(path.join(saved.directory, manifest.media[0]!.path)));
  assert.equal(await decompressed(saved.resultPath), raw);
});

test('explicit events are fallback-only when the raw object has no engineEvents key', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-fallback-'));
  const events = [{ timestamp: new Date(0).toISOString(), level: 'warn' as const, phase: 'fallback', message: 'fallback', context: {} }];
  const saved = await writeStreamedReportPackage(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport', engineEvents: events }, Readable.from(['{"status":"completed"}']));
  assert.equal((await readFile(saved.engineLogPath, 'utf8')).trim(), JSON.stringify(events[0]));
});

test('repair replaces derived outputs idempotently while preserving the original gzip', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-repair-'));
  const event = { timestamp: new Date(0).toISOString(), level: 'info' as const, phase: 'trace', message: 'repair', context: {} };
  const raw = JSON.stringify({ engineEvents: [event], captures: [] });
  const saved = await writeStreamedReportArchive(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport\n\n- Les JPEG, poses exactes et données brutes de chaque image sont intégrés au bloc machine du présent Markdown.' }, Readable.from([raw]));
  const before = createHash('sha256').update(await readFile(saved.package.resultPath)).digest('hex');
  const repaired = await repairStreamedReportPackage(saved.package.directory);
  const firstMarkdown = await readFile(repaired.markdownPath, 'utf8');
  const again = await repairStreamedReportPackage(saved.package.directory);
  assert.equal(createHash('sha256').update(await readFile(again.resultPath)).digest('hex'), before);
  assert.equal(await readFile(again.markdownPath, 'utf8'), firstMarkdown);
  assert.doesNotMatch(firstMarkdown, /JPEG, poses exactes/);
  assert.match(firstMarkdown, /captures sont extraites/);
});

test('streamed archive removes partial output on stream failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-failure-'));
  const broken = Readable.from((async function* () { yield '{"partial":'; throw new Error('stream failed'); })());
  await assert.rejects(writeStreamedReportPackage(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport', id: 'campaign-broken' }, broken), /stream failed/);
  await assert.rejects(stat(path.join(root, 'reports', '15-virtualized-integration', 'campaign-broken')));
  assert.deepEqual(await readdir(path.join(root, 'reports', '15-virtualized-integration')), []);
});

test('missing or corrupt gzip sources reject through the stream API', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-stream-report-source-errors-'));
  await assert.rejects(async () => { for await (const _chunk of createReportResultStream(path.join(root, 'missing.json.gz'))) { /* consume */ } }, /ENOENT/);
  const corrupt = path.join(root, 'corrupt.json.gz');
  await writeFile(corrupt, Buffer.from('not gzip'));
  await assert.rejects(async () => { for await (const _chunk of createReportResultStream(corrupt)) { /* consume */ } }, /gzip|header|invalid/i);
});
