import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, createTerminalProgress } from '@web-geometry/sdk/node';

// Compile la boîte de secours de la voiture (voir car.mjs et emeraldFixtures.ts) séparément du
// cache Emerald, lecture seule du Lab principal — jamais recompilé ni modifié par ce banc.
const here = fileURLToPath(new URL('.', import.meta.url));
const source = resolve(here, 'source/car.glb');
const cache = resolve(here, 'cache/car');

const progress = createTerminalProgress({ label: 'car', index: 0, total: 1 });
const result = await prepare(source, cache, 'full', 5000, {
  threads: 2,
  ramBudgetMb: 256,
  resourceBaseUrl: '/16-lighting-transport/assets/source/',
  simplification: 'none',
  onProgress: (event: Parameters<ReturnType<typeof createTerminalProgress>['event']>[0]) => progress.event(event),
}).catch(error => { progress.fail(String(error.message ?? error)); throw error; });
if (result.status !== 'ready') { progress.fail(`préparation incomplète (${result.status})`); throw new Error(`car : préparation incomplète (${result.status})`); }
console.log(`Voiture compilée : ${cache} (manifest ${result.url})`);
