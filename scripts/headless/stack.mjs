// Chargement et première image par moteur : trace d'exception, sans rapport de campagne.
// Usage : node stack.mjs [moteur…]
import { launch, measurePage, sdkUrl, manifestUrlFor, options } from './lib.mjs';

const engines = process.argv.slice(2).length ? process.argv.slice(2) : options.engines;
const { browser } = await launch({ extra: ['--enable-features=Vulkan,WebGPU'] });
for (const engineId of engines) {
  const page = await measurePage(browser, options);
  const logs = [];
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') logs.push(message.text().slice(0, 300)); });
  page.on('pageerror', error => logs.push('PAGEERROR ' + (error.stack || error.message).slice(0, 1500)));
  const result = await page.evaluate(async o => {
    try {
      const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
      const { createExplorer } = await import(o.sdkUrl);
      const canvas = document.createElement('canvas');
      canvas.style.width = `${o.cssWidth}px`;
      canvas.style.height = `${o.cssHeight}px`;
      document.body.append(canvas);
      const started = performance.now();
      const explorer = await createExplorer(canvas, {
        manifestUrl: o.manifestUrl, scope: 'full', width: o.cssWidth, height: o.cssHeight, pixelRatio: o.devicePixelRatio,
        replicaCount: o.replicaCount, detail: 'source', pixelError: o.pixelError, lodAdaptive: false,
        maxResidentPages: o.maxResidentPages, preload: o.preload, backends: [benchEngine(o.engineId).factory],
        comparisonLayout: 'single', diagnosticDetail: o.measurementMode,
      });
      const metrics = explorer.render();
      return { ok: true, ms: Math.round(performance.now() - started), triangles: metrics?.triangles ?? null, selected: metrics?.selectedTriangles ?? null, draws: metrics?.drawCalls ?? null };
    } catch (e) { return { ok: false, message: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 2500) }; }
  }, {
    sdkUrl, manifestUrl: manifestUrlFor(options.scenes[0]), engineId,
    cssWidth: options.cssWidth, cssHeight: options.cssHeight, devicePixelRatio: options.devicePixelRatio,
    replicaCount: options.replicaCount, pixelError: options.pixelError, preload: options.preload,
    measurementMode: options.measurementMode, maxResidentPages: options.maxResidentPages,
  });
  console.log('==', engineId, JSON.stringify(result, null, 1).slice(0, 3000));
  if (logs.length) console.log('-- console:', logs.slice(0, 5).join('\n'));
  await page.close();
}
await browser.close();
