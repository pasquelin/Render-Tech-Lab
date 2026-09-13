import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { hasMarkdownReport, loadMarkdownReport, markdownReportUrl, REPORT_PREVIEW_BYTES } from '../src/lab/reportReader.ts';

function response(body: string, options: { ok?: boolean; truncated?: boolean; available?: boolean } = {}) {
  return {
    ok: options.ok ?? true,
    text: async () => body,
    headers: { get: (name: string) => name.toLowerCase() === 'x-report-truncated' && options.truncated ? 'true' : name.toLowerCase() === 'x-report-available' ? String(options.available ?? true) : null },
  };
}

test('the common reader requests a bounded Markdown preview for every report id', () => {
  assert.equal(REPORT_PREVIEW_BYTES, 1_048_576);
  assert.equal(markdownReportUrl('15 virtualized/integration'), '/api/get-report?testId=15%20virtualized%2Fintegration&previewBytes=1048576');
});

test('the common reader preserves Markdown and tells the modal when the preview is partial', async () => {
  let requested = '';
  const report = await loadMarkdownReport(async url => {
    requested = url;
    return response('# Rapport', { truncated: true });
  }, '00-baseline');

  assert.equal(requested, markdownReportUrl('00-baseline'));
  assert.equal(report.ok, true);
  assert.equal(report.raw, '# Rapport');
  assert.equal(report.feedback, 'Aperçu progressif : le fichier Markdown complet reste disponible dans Finder.');
});

test('the common reader keeps the server error body for a visible error state', async () => {
  const report = await loadMarkdownReport(async () => response('Rapport introuvable', { ok: false }), '01-webgl');
  assert.equal(report.ok, false);
  assert.equal(report.raw, 'Rapport introuvable');
  assert.equal(report.feedback, '');
});

test('the report component can determine availability without downloading report content', async () => {
  let method = '';
  const available = await hasMarkdownReport(async (_url, init) => { method = init.method ?? ''; return response(''); }, '15-virtualized-integration');
  assert.equal(available, true);
  assert.equal(method, 'HEAD');
  assert.equal(await hasMarkdownReport(async () => { throw new Error('offline'); }, '15-virtualized-integration'), false);
  assert.equal(await hasMarkdownReport(async () => response('', { available: false }), '15-virtualized-integration'), false, 'l’absence de paquet est une réponse normale, pas une erreur HTTP');
});

test('the shared report probe retries while a completed campaign is being archived', async () => {
  let requests = 0;
  const available = await hasMarkdownReport(async () => response('', { available: ++requests === 2 }), '15-virtualized-integration', 2, 0);
  assert.equal(available, true);
  assert.equal(requests, 2);
});

test('every modal path delegates Markdown retrieval to the common reader', async () => {
  const files = [
    'src/components/UnifiedLab.tsx',
    'src/components/IntegrationFixtureLab.tsx',
    'src/components/ModelLab.tsx',
    'src/lab/bootLab.ts',
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /loadMarkdownReport/);
  }
  const bootLab = await readFile('src/lab/bootLab.ts', 'utf8');
  assert.doesNotMatch(bootLab, /testId === '15-virtualized-integration' \? '\/api\/integration-archive'/);
});
