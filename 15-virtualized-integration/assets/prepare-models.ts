import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepare, createTerminalProgress } from '@web-geometry/sdk/node';
import { benchmarkModels } from './modelCatalog.ts';

// Le SDK prépare le rendu et son cache ; le banc ajoute ensuite des triangles de navigation
// dérivés du source.gltf préparé, sans modifier les géométries des moteurs de rendu.
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

for (const [index, model] of selected.entries()) {
  const progress = createTerminalProgress({ label: model.id, index, total: selected.length });
  const result = await prepare(resolve(root, model.sourceDirectory, model.runtimeFile), resolve(root, model.derivedDirectory), 'full', 150000, {
    threads: 8,
    ramBudgetMb,
    resourceBaseUrl: `/${model.sourceDirectory.replace(/^public\//, '')}/`,
    simplification: 'qem-endpoints',
    onProgress: event => progress.event(event),
  }).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
  if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`${model.id} : préparation incomplète (${result.status})`); }
  execFileSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./prepare-navigation-mesh.ts', import.meta.url)), model.id], { stdio: 'inherit' });
}
