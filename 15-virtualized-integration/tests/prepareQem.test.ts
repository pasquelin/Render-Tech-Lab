import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepare } from '@web-geometry/sdk/node';
import { assertCachePointer, assertCacheReady } from '@web-geometry/sdk';

function hash(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex'); }
function grid(nx: number, ny: number) {
  const positions: number[] = [];
  for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) positions.push(x, y, 0);
  const indices: number[] = [];
  const width = nx + 1;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * width + x;
    indices.push(i, i + 1, i + width, i + 1, i + 1 + width, i + width);
  }
  return { positions, indices, triangles: indices.length / 3 };
}

test('prepare writes a cache the lab availability check accepts, read only through the SDK', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qem-prepare-'));
  const input = join(root, 'source'), output = join(root, 'cache');
  await mkdir(input);
  const { positions, indices, triangles } = grid(16, 10);
  const pos = Buffer.alloc(positions.length * 4);
  positions.forEach((v, i) => pos.writeFloatLE(v, i * 4));
  const idx = Buffer.alloc(indices.length * 4);
  indices.forEach((v, i) => idx.writeUInt32LE(v, i * 4));
  const bin = Buffer.concat([pos, idx]);
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'mesh.bin', byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length },
      { buffer: 0, byteOffset: pos.length, byteLength: idx.length },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: 'VEC3', count: positions.length / 3 },
      { bufferView: 1, componentType: 5125, type: 'SCALAR', count: indices.length },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    materials: [],
    images: [],
  };
  const json = Buffer.from(JSON.stringify(gltf));
  await writeFile(join(input, 'mesh.gltf'), json);
  await writeFile(join(input, 'mesh.bin'), bin);
  await writeFile(join(input, 'manifest.json'), JSON.stringify({
    status: 'ready', formatVersion: 1,
    runtime: { file: 'mesh.gltf', sha256: hash(json), sidecars: [{ file: 'mesh.bin', sha256: hash(bin) }], trianglesAcrossNodes: triangles, meshNodes: 1 },
  }));
  try {
    // Ce que `prepare` promet à son appelant, sans qu'il ouvre le cache.
    const result = await prepare(input, output, 'full', 150000, {
      threads: 1, ramBudgetMb: 64, resourceBaseUrl: '/assets/', simplification: 'qem-endpoints',
    });
    assert.equal(result.status, 'ready');
    assert.equal(result.simplification, true);
    assert.equal(result.selectedTriangles, triangles);

    // Le format du cache appartient au SDK : le banc lit deux JSON et laisse le SDK juger.
    // Aucun champ interne (pages, clusters, hiérarchie) n'est touché ici.
    const pointer = JSON.parse(await readFile(join(output, 'native/full/manifest.json'), 'utf8'));
    const cacheUrl = assertCachePointer(pointer, 'full');
    const manifest = JSON.parse(await readFile(join(output, 'native/full', cacheUrl), 'utf8'));
    assert.equal(assertCacheReady(manifest, 'full'), triangles);

    // Et le chemin réel du banc, servi par fetch, donne le même compte.
    const { checkModelAvailability, defaultModelId, modelManifestUrl } = await import('../../src/lab/modelAvailability.ts');
    assert.match(modelManifestUrl(defaultModelId()), /native\/full\/manifest\.json$/);
    const trianglesSeen = await checkModelAvailability(defaultModelId(), (async (url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      const body = path.endsWith('manifest.json') ? pointer : manifest;
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch);
    assert.equal(trianglesSeen, triangles);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
