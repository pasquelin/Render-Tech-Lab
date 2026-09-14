import { chromium, BASE_FLAGS, sdkUrl, manifestUrlFor, URL_BASE } from './lib.mjs';
const engineId = process.argv[2] ?? 'webgpu-page-raster'; const pixelError = Number(process.argv[3] ?? 1); const preload = process.argv[4] ?? 'visible'; const detail = process.argv[5] ?? 'summary';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [...BASE_FLAGS, '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(URL_BASE + '/', { waitUntil: 'load' });
const r = await page.evaluate(async (o) => {
  const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
  const { createExplorer } = await import(o.sdkUrl);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const diags = []; const t0 = performance.now();
  let explorer;
  try {
    explorer = await createExplorer(canvas, { manifestUrl: o.manifestUrl, scope: 'full', width: 1280, height: 720, pixelRatio: 1, replicaCount: o.replicas, detail: "source", pixelError: o.pixelError, lodAdaptive: false, maxResidentPages: 100000, preload: o.preload, backends: [benchEngine(o.engineId).factory], comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: o.detail, onDiagnostic: d => { if (diags.length < 60 && /fail|error|capacity|coverage|fallback|incomplete/i.test(d.phase + ' ' + d.message)) diags.push({ phase: d.phase, message: d.message, context: JSON.stringify(d.context ?? {}).slice(0, 300) }); } });
  } catch (e) { return { stage: 'create', error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 800), diags }; }
  const ready = performance.now() - t0; let firstError = null, frames = 0;
  for (let i = 0; i < 240 && !firstError; i++) {
    await new Promise(r => requestAnimationFrame(r));
    try { explorer.render(); frames++; } catch (e) { firstError = { frame: i, error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 800) }; }
  }
  const m = { ...explorer.render() };
  return { stage: 'loop', readyMs: Math.round(ready), frames, firstError, selected: m.selectedTriangles, tri: m.triangles, draws: m.drawCalls, resident: m.residentPages, coverageReady: m.coverageReady, diags };
}, { sdkUrl, manifestUrl: manifestUrlFor(process.env.SCENE ?? 'emerald-square'), engineId, pixelError, preload, detail, replicas: Number(process.env.REPLICAS ?? 1) });
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
await browser.close();
