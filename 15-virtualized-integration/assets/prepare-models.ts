import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';
import { prepare, createTerminalProgress } from '@web-geometry/sdk/node';
import { benchmarkModels } from './modelCatalog.ts';

// Le banc ne fait que nommer les scènes : lecture de la source, manifeste, import FBX/OBJ, clusters,
// élagage du cache et progression sont du ressort du compilateur et de son adaptateur Node.
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
    onProgress: (event: Parameters<ReturnType<typeof createTerminalProgress>['event']>[0]) => progress.event(event),
  }).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
  if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`${model.id} : préparation incomplète (${result.status})`); }
}
