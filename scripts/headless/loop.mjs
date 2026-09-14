// Rendu statique de 240 images : diagnostic de chargement et d'erreur, sans rapport de campagne.
// Usage : node loop.mjs [moteur]
import { launch, measurePage, sdkUrl, manifestUrlFor, options } from './lib.mjs';

const engineId = process.argv[2] ?? options.engines[0];
const { browser } = await launch({ headless: true });
const page = await measurePage(browser, options);
const result = await page.evaluate(async o => {
  const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
  const { createExplorer } = await import(o.sdkUrl);
  const canvas = document.createElement('canvas');
  canvas.style.width = `${o.cssWidth}px`;
  canvas.style.height = `${o.cssHeight}px`;
  document.body.append(canvas);
  const diagnostics = [];
  const started = performance.now();
  let explorer;
  try {
    explorer = await createExplorer(canvas, {
      manifestUrl: o.manifestUrl, scope: 'full', width: o.cssWidth, height: o.cssHeight, pixelRatio: o.devicePixelRatio,
      replicaCount: o.replicaCount, detail: 'source', pixelError: o.pixelError, lodAdaptive: false,
      maxResidentPages: o.maxResidentPages, preload: o.preload, backends: [benchEngine(o.engineId).factory],
      comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: o.measurementMode,
      onDiagnostic: d => { if (diagnostics.length < 60 && /fail|error|capacity|coverage|fallback|incomplete/i.test(d.phase + ' ' + d.message)) diagnostics.push({ phase: d.phase, message: d.message, context: JSON.stringify(d.context ?? {}).slice(0, 300) }); },
    });
  } catch (e) { return { stage: 'create', error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 800), diagnostics }; }
  const readyMs = performance.now() - started;
  let firstError = null, frames = 0;
  for (let i = 0; i < 240 && !firstError; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    try { explorer.render(); frames++; } catch (e) { firstError = { frame: i, error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 800) }; }
  }
  const metrics = { ...explorer.render() };
  return {
    stage: 'loop', readyMs: Math.round(readyMs), frames, firstError,
    selected: metrics.selectedTriangles, tri: metrics.triangles, draws: metrics.drawCalls,
    resident: metrics.residentPages, coverageReady: metrics.coverageReady,
    canvasSize: { deviceWidth: canvas.width, deviceHeight: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
    diagnostics,
  };
}, {
  sdkUrl, manifestUrl: manifestUrlFor(options.scenes[0]), engineId,
  cssWidth: options.cssWidth, cssHeight: options.cssHeight, devicePixelRatio: options.devicePixelRatio,
  replicaCount: options.replicaCount, pixelError: options.pixelError, preload: options.preload,
  measurementMode: options.measurementMode, maxResidentPages: options.maxResidentPages,
});
console.log(JSON.stringify(result, null, 1).slice(0, 4000));
await browser.close();
