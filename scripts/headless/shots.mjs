import { chromium, BASE_FLAGS, sdkUrl as libSdkUrl, manifestUrlFor, URL_BASE, pngFromRgba } from './lib.mjs';
const sdkUrl = process.env.SDK_DIST ? '/@fs' + process.env.SDK_DIST + '/sdk-browser/index.js' : libSdkUrl; const MAXP = Number(process.env.MAX_PAGES ?? 100000); const TAG = process.env.TAG ?? '';
import { writeFile, mkdir } from 'node:fs/promises';
const engineId = process.argv[2] ?? 'exact-cluster-pages'; const frames = (process.argv[3] ?? '0,150,300,450').split(',').map(Number); const errs = (process.argv[4] ?? '0,1').split(',').map(Number);
const out = new URL('./shots/', import.meta.url).pathname; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [...BASE_FLAGS, '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(URL_BASE + '/', { waitUntil: 'load' });
for (const pixelError of errs) {
  const r = await page.evaluate(async (o) => {
    const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
    const { urbanPath } = await import('/src/lab/modelCampaign.ts');
    const { createExplorer } = await import(o.sdkUrl);
    const canvas = document.createElement('canvas'); document.body.append(canvas);
    const explorer = await createExplorer(canvas, { manifestUrl: o.manifestUrl, scope: 'full', width: 1280, height: 720, pixelRatio: 1, replicaCount: 1, detail: 'source', pixelError: o.pixelError, lodAdaptive: false, maxResidentPages: o.maxp, preload: 'visible', backends: [benchEngine(o.engineId).factory], comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: 'summary' });
    const path = urbanPath(explorer.bounds); const shots = [];
    for (const frame of o.frames) {
      const step = path[frame]; explorer.setPose(step.pose);
      for (let s = 0; s < 8; s++) { await explorer.awaitPages(); explorer.render(step.pose); await explorer.flush(); }
      const m = { ...explorer.render(step.pose) }; const px = explorer.capture();
      shots.push({ frame, selected: m.selectedTriangles, triangles: m.triangles, draws: m.drawCalls, resident: m.residentPages, b64: btoa(String.fromCharCode(...new Uint8Array(px.buffer, px.byteOffset, Math.min(px.byteLength, 0)))) , w: px.width ?? 1280, h: px.height ?? 720, len: px.byteLength ?? px.length });
      const bytes = px.data ?? px; let s = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)); shots[shots.length - 1].b64 = btoa(s);
    }
    explorer.dispose(); canvas.remove(); return shots;
  }, { sdkUrl, manifestUrl: manifestUrlFor('emerald-square'), engineId, pixelError, frames, maxp: MAXP });
  for (const s of r) {
    const rgba = Buffer.from(s.b64, 'base64'); const w = s.w, h = s.h;
    await writeFile(`${out}${TAG}${engineId}-e${pixelError}-f${s.frame}.png`, pngFromRgba(new Uint8Array(rgba), w, h));
    console.log(`e=${pixelError} frame=${s.frame} selected=${s.selected} tri=${s.triangles} draws=${s.draws} resident=${s.resident} bytes=${rgba.length} ${w}x${h}`);
  }
}
await browser.close();
