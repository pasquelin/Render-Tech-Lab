import { chromium, BASE_FLAGS, sdkUrl, manifestUrlFor, URL_BASE } from './lib.mjs';
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['exact-cluster-pages','webgpu-page-raster'];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [...BASE_FLAGS, '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU'] });
for (const engineId of engines) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('PAGEERROR ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto(URL_BASE + '/', { waitUntil: 'load' });
  const r = await page.evaluate(async (o) => {
    try {
      const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
      const { createExplorer } = await import(o.sdkUrl);
      const canvas = document.createElement('canvas'); document.body.append(canvas);
      const t0 = performance.now();
      const explorer = await createExplorer(canvas, { manifestUrl: o.manifestUrl, scope: 'full', width: 1280, height: 720, pixelRatio: 1, replicaCount: 1, detail: 'source', pixelError: 1, lodAdaptive: false, maxResidentPages: 100000, preload: 'visible', backends: [benchEngine(o.engineId).factory], comparisonLayout: 'single', diagnosticDetail: 'summary' });
      const m = explorer.render();
      return { ok: true, ms: Math.round(performance.now() - t0), triangles: m?.triangles ?? null, selected: m?.selectedTriangles ?? null, draws: m?.drawCalls ?? null };
    } catch (e) { return { ok: false, message: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 2500) }; }
  }, { sdkUrl, manifestUrl: manifestUrlFor('emerald-square'), engineId });
  console.log('==', engineId, JSON.stringify(r, null, 1).slice(0, 3000));
  if (logs.length) console.log('-- console:', logs.slice(0, 5).join('\n'));
  await page.close();
}
await browser.close();
