import { writeFile } from 'node:fs/promises';
import { openLabPage, explorerOptions, sdkUrl, manifestUrlFor, outputPath, pngFromRgba } from './lib.mjs';
const MAXP = Number(process.env.MAX_PAGES ?? 100000); const TAG = process.env.TAG ?? '';
const engineId = process.argv[2] ?? 'exact-cluster-pages'; const frames = (process.argv[3] ?? '0,150,300,450').split(',').map(Number); const errs = (process.argv[4] ?? '0,1').split(',').map(Number);
const { browser, page } = await openLabPage();
for (const pixelError of errs) {
  const r = await page.evaluate(async (o) => {
    const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
    const { urbanPath } = await import('/src/lab/modelCampaign.ts');
    const { createExplorer } = await import(o.sdkUrl);
    const canvas = document.createElement('canvas'); document.body.append(canvas);
    const explorer = await createExplorer(canvas, { ...o.options, backends: [benchEngine(o.engineId).factory] });
    const path = urbanPath(explorer.bounds); const shots = [];
    for (const frame of o.frames) {
      const step = path[frame]; explorer.setPose(step.pose);
      for (let s = 0; s < 8; s++) { await explorer.awaitPages(); explorer.render(step.pose); await explorer.flush(); }
      const m = { ...explorer.render(step.pose) }; const px = explorer.capture();
      const bytes = px.data ?? px; let b64 = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      shots.push({ frame, selected: m.selectedTriangles, triangles: m.triangles, draws: m.drawCalls, resident: m.residentPages, b64: btoa(b64), w: px.width ?? 1280, h: px.height ?? 720 });
    }
    explorer.dispose(); canvas.remove(); return shots;
  }, { sdkUrl, engineId, frames, options: explorerOptions(manifestUrlFor('emerald-square'), { pixelError, maxResidentPages: MAXP }) });
  for (const s of r) {
    const rgba = Buffer.from(s.b64, 'base64'); const w = s.w, h = s.h;
    await writeFile(outputPath(`shots/${TAG}${engineId}-e${pixelError}-f${s.frame}.png`), pngFromRgba(new Uint8Array(rgba), w, h));
    console.log(`e=${pixelError} frame=${s.frame} selected=${s.selected} tri=${s.triangles} draws=${s.draws} resident=${s.resident} bytes=${rgba.length} ${w}x${h}`);
  }
}
await browser.close();
