import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';
import { prepare, createTerminalProgress } from '@web-geometry/sdk/node';

// Compile la maison générée par house.mjs avec le compilateur public du SDK, comme
// 15-virtualized-integration/assets/prepare-models.ts le fait pour ses modèles.
// Le cache résultant est servi par 16-lighting-transport/assets/vite.ts.
const here = fileURLToPath(new URL('.', import.meta.url));
const source = resolve(here, 'source/house.glb');
const cache = resolve(here, 'cache/house');
const ramBudgetMb = Math.floor((totalmem() / 1024 / 1024) * 0.9);

const progress = createTerminalProgress({ label: 'house', index: 0, total: 1 });
const result = await prepare(source, cache, 'full', 150000, {
  threads: 4,
  ramBudgetMb,
  resourceBaseUrl: '/16-lighting-transport/assets/source/',
  simplification: 'none',
  onProgress: (event: Parameters<ReturnType<typeof createTerminalProgress>['event']>[0]) => progress.event(event),
}).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`house : préparation incomplète (${result.status})`); }
console.log(`Maison compilée : ${cache} (manifest ${result.url})`);
