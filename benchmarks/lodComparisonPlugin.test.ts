import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ComparisonRequestError, createLodComparisonPlugin, createLodComparisonStore, readLodComparisonMetadata } from './lodComparisonPlugin.ts';

function payload(label: string) {
  return { report: { test: '04-gpu-lod-comparison', timestamp: '2026-09-11T20:00:00.000Z', config: { label }, samples: [1, 2, 3] }, markdown: `# ${label}\n` };
}

test('preserves two campaigns and updates dedicated latest files without touching historical reports', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lod-comparison-store-'));
  try {
    const results = path.join(root, '04-gpu-lod/results');
    await mkdir(results, { recursive: true });
    await writeFile(path.join(results, 'latest.json'), 'historical json');
    await writeFile(path.join(results, 'REPORT.md'), 'historical markdown');
    const store = createLodComparisonStore(root);
    const [first, second] = await Promise.all([store.save(payload('first')), store.save(payload('second'))]);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(JSON.parse(await store.read(first.id)), payload('first').report);
    assert.match(await store.read(first.id, 'markdown'), /Données brutes compressées/);
    assert.deepEqual(JSON.parse(await readFile(path.join(results, 'comparison-latest.json'), 'utf8')), payload('second').report);
    assert.match(await readFile(path.join(results, 'COMPARISON.md'), 'utf8'), /Données brutes compressées/);
    assert.match(await readFile(path.join(root, 'reports/04-gpu-lod-comparison.md'), 'utf8'), /Données brutes compressées/);
    assert.equal(await readFile(path.join(results, 'latest.json'), 'utf8'), 'historical json');
    assert.equal(await readFile(path.join(results, 'REPORT.md'), 'utf8'), 'historical markdown');
    const history = await store.history();
    assert.equal(history.length, 2);
    assert.deepEqual(new Set(history.map(run => run.id)), new Set([first.id, second.id]));
    assert.equal(history.find(run => run.id === first.id)?.jsonUrl, `/api/lod-comparison?run=${first.id}`);
    assert.equal((await readdir(path.join(results, 'comparisons'))).length, 6);
    assert.equal((await readdir(results)).some(name => name.endsWith('.tmp')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('archives readable allowlisted source snapshots with exact hashes, retaining old bytes after edits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-sources-'));
  try {
    const source = '14-open-world/implementation/worldScene.ts', manifest = 'public/benchmark-assets/bistro/manifest.json';
    for (const file of [source, manifest]) await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    const original = '// décor\nexport const answer = 42;\n';
    await writeFile(path.join(root, source), original);
    await writeFile(path.join(root, manifest), '{"asset":"Bistro"}\n');
    await writeFile(path.join(root, 'public/benchmark-assets/bistro/bistro-exterior.glb'), Buffer.from([0, 255]));
    const store = createLodComparisonStore(root, '14-open-world');
    const metadata = await readLodComparisonMetadata(root, '14-open-world');
    const input = { ...payload('snapshot'), report: { ...payload('snapshot').report, test: '14-open-world',
      provenance: { before: metadata, after: metadata, sourcesStable: true } } };
    const run = await store.save(input);
    assert.equal(run.sourcesUrl, `/api/world-comparison?run=${run.id}&format=sources`);
    const savedText = await store.read(run.id, 'sources');
    const archive = JSON.parse(savedText);
    assert.equal(archive.moduleId, '14-open-world');
    assert.equal(archive.provenanceVerification, 'matched-before-and-after');
    assert.equal(archive.files[source].text, original);
    assert.equal(archive.files[source].sha256, metadata.sourceHashes[source]);
    assert.equal(archive.files[manifest].text, '{"asset":"Bistro"}\n');
    assert.deepEqual(archive.files['pnpm-lock.yaml'], { text: null, sha256: null });
    assert.equal(Object.keys(archive.files).some(file => file.endsWith('.glb')), false);
    assert.equal(archive.sourceSetSha256, createHash('sha256').update(JSON.stringify(archive.files)).digest('hex'));
    await writeFile(path.join(root, source), 'new source');
    const second = await store.save({ ...input, report: { ...input.report, provenance: undefined } });
    assert.equal(await store.read(run.id, 'sources'), savedText);
    assert.equal(JSON.parse(await store.read(second.id, 'sources')).files[source].text, 'new source');
    assert.equal((await store.history()).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('refuses client provenance drift or incomplete hashes before publishing any archive', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-source-drift-'));
  try {
    await mkdir(path.join(root, '04-gpu-lod/implementation'), { recursive: true });
    const file = path.join(root, '04-gpu-lod/implementation/cpuLodSelector.ts');
    await writeFile(file, 'before');
    const before = await readLodComparisonMetadata(root);
    await writeFile(file, 'after');
    const after = await readLodComparisonMetadata(root);
    const store = createLodComparisonStore(root);
    for (const provenance of [
      { before, after: before, sourcesStable: true },
      { before, after, sourcesStable: true },
      { before: { sourceHashes: {} }, after, sourcesStable: true },
      {},
    ]) await assert.rejects(store.save({ ...payload('drift'), report: { ...payload('drift').report, provenance } }),
      (error: unknown) => error instanceof ComparisonRequestError && error.statusCode === 409);
    assert.deepEqual(await store.history(), []);
    assert.deepEqual(await readdir(root), ['04-gpu-lod']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('archives an unstable 14 campaign without publishing it as latest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-unstable-archive-'));
  try {
    const source = '14-open-world/implementation/worldScene.ts';
    await mkdir(path.dirname(path.join(root, source)), { recursive: true });
    await writeFile(path.join(root, source), 'before');
    const before = await readLodComparisonMetadata(root, '14-open-world');
    await writeFile(path.join(root, source), 'after');
    const after = await readLodComparisonMetadata(root, '14-open-world');
    const store = createLodComparisonStore(root, '14-open-world');
    const input = {
      ...payload('unstable'),
      report: {
        ...payload('unstable').report,
        test: '14-open-world',
        provenance: { before, after, sourcesStable: false },
        limitations: ['INVALID: sources changed during this campaign; timings are not accepted as comparative evidence.'],
      },
    };
    const run = await store.save(input);
    assert.equal(run.published, false);
    assert.equal((await store.history()).length, 1);
    const archive = JSON.parse(await store.read(run.id, 'sources'));
    assert.equal(archive.provenanceVerification, 'unstable-archived');
    assert.equal(JSON.parse(await store.read(run.id)).provenance.sourcesStable, false);
    await assert.rejects(readFile(path.join(root, '14-open-world/results/comparison-latest.json')));
    await assert.rejects(readFile(path.join(root, 'reports/14-open-world.md')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('old archives remain readable without fabricated source snapshots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-legacy-'));
  try {
    const directory = path.join(root, '04-gpu-lod/results/comparisons');
    await mkdir(directory, { recursive: true });
    const id = '20260911T120000000Z-00000000-0000-4000-8000-000000000000';
    const original = JSON.stringify(payload('historical').report);
    await writeFile(path.join(directory, `${id}.json`), original);
    const store = createLodComparisonStore(root);
    assert.equal((await store.history())[0].sourcesUrl, null);
    assert.equal(await store.read(id), original);
    await assert.rejects(store.read(id, 'sources'),
      (error: unknown) => error instanceof ComparisonRequestError && error.statusCode === 404);
    assert.deepEqual(await readdir(directory), [`${id}.json`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('refuses non-UTF-8 allowlisted bytes rather than archiving altered text', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-binary-'));
  try {
    await writeFile(path.join(root, 'package.json'), Buffer.from([0xff, 0xfe]));
    const store = createLodComparisonStore(root);
    await assert.rejects(store.save(payload('binary')),
      (error: unknown) => error instanceof ComparisonRequestError && error.statusCode === 409);
    assert.deepEqual(await readdir(root), ['package.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rejects invalid payloads and path traversal without imposing a report-size cap', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lod-comparison-invalid-'));
  try {
    const store = createLodComparisonStore(root);
    const valid = payload('valid');
    for (const input of [null, {}, { report: [] }, { ...valid, markdown: '' },
      { ...valid, report: { ...valid.report, test: '../elsewhere' } },
      { ...valid, report: { ...valid.report, timestamp: '2026-02-30T20:00:00Z' } },
      { ...valid, report: { ...valid.report, config: [] } }]) {
      await assert.rejects(store.save(input), ComparisonRequestError);
    }
    const oversized = await store.save({ ...valid, markdown: 'x'.repeat(16 * 1024 * 1024) });
    assert.ok(oversized.id);
    await assert.rejects(store.read('../../outside'), ComparisonRequestError);
    assert.equal((await store.history()).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('metadata hashes actual fixed source bytes and leaves absent provenance unavailable', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lod-comparison-meta-'));
  try {
    await mkdir(path.join(root, '04-gpu-lod/implementation'), { recursive: true });
    await writeFile(path.join(root, '04-gpu-lod/implementation/cpuLodSelector.ts'), 'abc');
    const metadata = await readLodComparisonMetadata(root);
    assert.equal(metadata.sourceHashes['04-gpu-lod/implementation/cpuLodSelector.ts'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(metadata.sourceHashes['shared/math/screenSpaceError.ts'], null);
    assert.equal(metadata.commit, null);
    assert.equal(metadata.node, process.version);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('04 and 14 publish independent archives, latest reports and API links', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'comparison-two-modules-'));
  try {
    const lod = createLodComparisonStore(root);
    const world = createLodComparisonStore(root, '14-open-world');
    const worldPayload = { ...payload('world'), report: { ...payload('world').report, test: '14-open-world' } };
    const saved = await Promise.allSettled([lod.save(payload('lod')), world.save(worldPayload)]);
    for (const result of saved) if (result.status === 'rejected') throw result.reason;
    const [lodRun, worldRun] = saved.map(result => {
      assert.equal(result.status, 'fulfilled');
      return result.value;
    });
    assert.deepEqual((await lod.history()).map(run => run.id), [lodRun.id]);
    assert.deepEqual((await world.history()).map(run => run.id), [worldRun.id]);
    assert.equal(worldRun.jsonUrl, `/api/world-comparison?run=${worldRun.id}`);
    assert.equal(worldRun.markdownUrl, `/api/world-comparison?run=${worldRun.id}&format=markdown`);
    assert.equal(lodRun.jsonUrl, `/api/lod-comparison?run=${lodRun.id}`);
    assert.match(await readFile(path.join(root, 'reports/14-open-world.md'), 'utf8'), /Données brutes compressées/);
    assert.match(await readFile(path.join(root, 'reports/04-gpu-lod-comparison.md'), 'utf8'), /Données brutes compressées/);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, '14-open-world/results/comparison-latest.json'), 'utf8')), worldPayload.report);
    assert.match(await readFile(path.join(root, '14-open-world/results/COMPARISON.md'), 'utf8'), /Données brutes compressées/);
    await assert.rejects(world.read(lodRun.id), (error: unknown) => error instanceof ComparisonRequestError && error.statusCode === 404);
    await assert.rejects(lod.read(worldRun.id), (error: unknown) => error instanceof ComparisonRequestError && error.statusCode === 404);
    await assert.rejects(world.save(payload('wrong-module')), ComparisonRequestError);
    await assert.rejects(lod.save(worldPayload), ComparisonRequestError);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('only the fixed 04 and 14 module configurations can be selected', () => {
  assert.notEqual(createLodComparisonPlugin().name, createLodComparisonPlugin({ id: '14-open-world' }).name);
  for (const id of ['../outside', '/tmp/outside', '14-open-world/../../outside', 'unknown']) {
    assert.throws(() => createLodComparisonStore('/tmp', id as '14-open-world'), ComparisonRequestError);
    assert.throws(() => createLodComparisonPlugin({ id: id as '14-open-world' }), ComparisonRequestError);
  }
});

test('14 provenance hashes its own scene and asset manifest plus common dependency lock', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'world-comparison-meta-'));
  try {
    for (const file of ['14-open-world/implementation/worldScene.ts', 'public/benchmark-assets/bistro/manifest.json', 'pnpm-lock.yaml', 'package.json']) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), 'abc');
    }
    const world = await readLodComparisonMetadata(root, '14-open-world');
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    assert.equal(world.sourceHashes['14-open-world/implementation/worldScene.ts'], expected);
    assert.equal(world.sourceHashes['public/benchmark-assets/bistro/manifest.json'], expected);
    assert.equal(world.sourceHashes['pnpm-lock.yaml'], expected);
    assert.equal(world.sourceHashes['package.json'], expected);
    assert.equal(world.sourceHashes['14-open-world/contracts.ts'], null);
    assert.equal(world.sourceHashes['14-open-world/implementation/worldPage.ts'], null);
    assert.equal(world.sourceHashes['14-open-world/runner/reporter.ts'], null);
    assert.equal(world.sourceHashes['14-open-world/implementation/adaptiveCulling.ts'], null);
    assert.equal(world.sourceHashes['benchmarks/lodComparisonPlugin.ts'], null);
    assert.equal('04-gpu-lod/implementation/cpuLodSelector.ts' in world.sourceHashes, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
