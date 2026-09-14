import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { reportPackagePath, writeReportPackage } from '../shared/archive/index.ts';

test('report package separates readable summary, compressed objects, engine logs and visual evidence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-report-package-'));
  const pixels = Buffer.from([0, 1, 2, 3, 255]);
  const saved = await writeReportPackage(root, {
    testId: '15-virtualized-integration',
    humanMarkdown: '# Résumé\n\nMesure disponible.',
    result: { samples: [1, 2, 3], capture: `data:image/png;base64,${pixels.toString('base64')}` },
    engineEvents: [{ timestamp: '2026-09-13T10:00:00.000Z', level: 'info', phase: 'loading', message: 'Cache prêt', context: { pages: 4 } }],
    archivedAt: '2026-09-13T10:00:00.000Z',
    id: 'campaign-proof',
  });

  const markdown = await readFile(saved.markdownPath, 'utf8');
  assert.match(markdown, /# Résumé/);
  assert.match(markdown, /Objets machine compressés/);
  assert.match(markdown, /!\[capture\]\(\.\/media\//);
  assert.doesNotMatch(markdown, /\[1,\s*2,\s*3\]/);
  assert.doesNotMatch(markdown, /data:image/);

  const manifest = JSON.parse(await readFile(saved.manifestPath, 'utf8')) as { schema: string; media: Array<{ sha256: string; path: string }>; objects: Array<{ path: string }> };
  assert.equal(manifest.schema, 'report-package/v1');
  assert.equal(manifest.media[0]?.sha256, createHash('sha256').update(pixels).digest('hex'));
  assert.deepEqual(await readdir(saved.mediaDirectory), [`${manifest.media[0]?.sha256}.png`]);
  assert.ok(manifest.objects.some(object => object.path === 'objects/result.json.gz'));

  const raw = JSON.parse(gunzipSync(await readFile(saved.resultPath)).toString('utf8')) as { samples: number[]; capture: { $media: { path: string } } };
  assert.deepEqual(raw.samples, [1, 2, 3]);
  assert.equal(raw.capture.$media.path, manifest.media[0]?.path);
  assert.match(await readFile(saved.engineLogPath, 'utf8'), /"phase":"loading"/);
});

test('a report package groups capture images by viewpoint and its actual engines', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-report-visuals-'));
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const saved = await writeReportPackage(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport', result: { captures: [
    { segment: 0, name: 'Vue générale', engine: 'engine-a', image },
    { segment: 0, name: 'Vue générale', engine: 'engine-b', image },
    { segment: 1, name: 'Approche', engine: 'engine-a', image },
  ] } });
  const markdown = await readFile(saved.markdownPath, 'utf8');
  assert.match(markdown, /### Vue générale · 2 moteurs/);
  assert.match(markdown, /\| engine-a \| engine-b \|/);
  assert.match(markdown, /### Approche · 1 moteur/);
});

test('les images de tout paquet archivé restent servies, quel que soit le nom du dossier', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rtl-report-served-'));
  for (const id of ['campaign-01e24921-5931-4d0d-8d9a-4c1752fdd164', 'verite-944d0df9']) {
    const saved = await writeReportPackage(root, { testId: '15-virtualized-integration', humanMarkdown: '# Rapport', result: { captures: [{ segment: 0, name: 'Vue', engine: 'engine-a', image: 'data:image/png;base64,iVBORw0KGgo=' }] }, id });
    const packagePath = `${path.basename(path.dirname(saved.directory))}/${path.basename(saved.directory)}`;
    assert.deepEqual(reportPackagePath(packagePath), { testId: '15-virtualized-integration', id });
  }
  assert.throws(() => reportPackagePath('15-virtualized-integration/../secrets'), /Chemin de rapport invalide|Identifiant de rapport invalide/);
});
