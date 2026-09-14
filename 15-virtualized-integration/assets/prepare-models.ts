import { createHash } from 'node:crypto';
import { access, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';
import { prepare, createTerminalProgress } from '@web-geometry/sdk/node';
import { benchmarkModels } from './modelCatalog.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ramBudgetMb = Math.floor(totalmem() / 1024 / 1024 * 0.9);
const selectedIds = process.argv.slice(2);
const selected = selectedIds.length === 0
  ? benchmarkModels
  : selectedIds.map(id => {
      const model = benchmarkModels.find(candidate => candidate.id === id);
      if (!model) throw new Error(`Modèle inconnu : ${id}. Modèles valides : ${benchmarkModels.map(candidate => candidate.id).join(', ')}`);
      return model;
    });

async function sha256(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function ensureRuntimeManifest(sourceDirectory: string, runtimeFile: string) {
  const runtimePath = resolve(root, sourceDirectory, runtimeFile);
  await access(runtimePath);
  const manifestPath = resolve(root, sourceDirectory, 'manifest.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (existing.status === 'ready' && typeof existing.runtime === 'object' && existing.runtime !== null) return;
  } catch {
    existing = {};
  }
  {
    const runtime = await stat(runtimePath);
    const sidecars = runtimeFile.endsWith('.gltf')
      ? (JSON.parse(await readFile(runtimePath, 'utf8')).buffers ?? []).flatMap(async (buffer: { uri?: unknown }) => {
          if (typeof buffer.uri !== 'string' || !buffer.uri || buffer.uri.startsWith('data:') || buffer.uri.includes('/') || buffer.uri.includes('..')) return [];
          const path = resolve(root, sourceDirectory, buffer.uri);
          return [{ file: buffer.uri, sha256: await sha256(path) }];
        })
      : [];
    await writeFile(manifestPath, `${JSON.stringify({
      ...existing,
      status: 'ready',
      formatVersion: 1,
      runtime: { file: runtimeFile, sha256: await sha256(runtimePath), sidecars: await Promise.all(sidecars).then(values => values.flat()), trianglesAcrossNodes: null, meshNodes: null, bytes: runtime.size },
    }, null, 2)}\n`);
  }
}

for (const [index, model] of selected.entries()) {
  const progress = createTerminalProgress({ label: model.id, index, total: selected.length });
  const sourceDirectory = resolve(root, model.sourceDirectory);
  const derivedDirectory = resolve(root, model.derivedDirectory);
  await ensureRuntimeManifest(model.sourceDirectory, model.runtimeFile);
  await rm(derivedDirectory, { recursive: true, force: true });
  const result = await prepare(sourceDirectory, derivedDirectory, 'full', 150000, {
    threads: 8,
    ramBudgetMb,
    resourceBaseUrl: `/${model.sourceDirectory.replace(/^public\//, '')}/`,
    simplification: 'qem-endpoints',
    onProgress: event => progress.event(event),
  }).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
  if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`${model.id} : préparation incomplète (${result.status})`); }
  console.log(JSON.stringify({ model: model.id, status: result.status, triangles: result.selectedTriangles, scope: result.scope }));
}
