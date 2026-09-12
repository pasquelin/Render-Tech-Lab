import { prepare } from '@web-geometry/sdk/node';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const result = await prepare(fileURLToPath(new URL('public/benchmark-assets/emerald-square', root)), fileURLToPath(new URL('public/benchmark-assets/emerald-derived', root)), 'full', 150000, {
  threads: 8, ramBudgetMb: 2048, resourceBaseUrl: '/benchmark-assets/emerald-square/',
  simplification: 'qem-endpoints',
  onProgress: event => { if (event.phase === 'ready') console.log(JSON.stringify(event)); },
});
console.log(JSON.stringify({status: result.status, triangles: result.selectedTriangles, scope: result.scope}));
