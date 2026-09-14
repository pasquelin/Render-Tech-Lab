// Captures PNG sans perte par pose, sur une ou plusieurs scènes, avec rapport de campagne.
// Usage : node shots.mjs [moteur] [images séparées par des virgules] [pixelErrors séparés par des virgules]
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { launch, measurePage, sdkUrl, manifestUrlFor, pngFromRgba, options, machineLoad, passFromSeries, truthReport, writeTruthReport } from './lib.mjs';

const engineId = process.argv[2] ?? options.engines[0];
const frames = (process.argv[3] ?? '0,150,300,450').split(',').map(Number);
const pixelErrors = process.argv[4] === undefined ? [options.pixelError] : process.argv[4].split(',').map(Number);
const out = new URL('./shots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

const { browser } = await launch();
const passes = [];
for (const [index, scene] of options.scenes.entries()) {
  const load = machineLoad();
  const shots = [];
  let failure = null, lastMetrics = null;
  for (const pixelError of pixelErrors) {
    const page = await measurePage(browser, options);
    const captured = await page.evaluate(async o => {
      const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
      const { urbanPath } = await import('/src/lab/modelCampaign.ts');
      const { createExplorer } = await import(o.sdkUrl);
      const canvas = document.createElement('canvas');
      canvas.style.width = `${o.cssWidth}px`;
      canvas.style.height = `${o.cssHeight}px`;
      document.body.append(canvas);
      let explorer;
      try {
        explorer = await createExplorer(canvas, {
          manifestUrl: o.manifestUrl, scope: 'full', width: o.cssWidth, height: o.cssHeight, pixelRatio: o.devicePixelRatio,
          replicaCount: o.replicaCount, detail: 'source', pixelError: o.pixelError, lodAdaptive: false,
          maxResidentPages: o.maxResidentPages, preload: o.preload, backends: [benchEngine(o.engineId).factory],
          comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: o.measurementMode,
        });
      } catch (e) { return { createError: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 1200) }; }
      const path = urbanPath(explorer.bounds);
      const results = [];
      for (const frame of o.frames) {
        const step = path[frame];
        explorer.setPose(step.pose);
        for (let settle = 0; settle < 8; settle++) { await explorer.awaitPages(); explorer.render(step.pose); await explorer.flush(); }
        const metrics = { ...explorer.render(step.pose) };
        const pixels = explorer.capture();
        const bytes = pixels.data ?? pixels;
        let encoded = '';
        for (let offset = 0; offset < bytes.length; offset += 0x8000) encoded += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
        results.push({
          frame, base64: btoa(encoded),
          width: pixels.width ?? canvas.width, height: pixels.height ?? canvas.height,
          selectedTriangles: metrics.selectedTriangles ?? null, triangles: metrics.triangles ?? null,
          drawCalls: metrics.drawCalls ?? null, residentPages: metrics.residentPages ?? null,
        });
      }
      explorer.dispose();
      canvas.remove();
      return { results };
    }, {
      sdkUrl, manifestUrl: manifestUrlFor(scene), engineId, pixelError, frames,
      cssWidth: options.cssWidth, cssHeight: options.cssHeight, devicePixelRatio: options.devicePixelRatio,
      replicaCount: options.replicaCount, preload: options.preload, measurementMode: options.measurementMode,
      maxResidentPages: options.maxResidentPages,
    });
    await page.close();
    if (captured.createError) { failure = `${scene} e${pixelError} : ${captured.createError}`; console.log(failure); continue; }
    for (const shot of captured.results) {
      const file = `${options.tag}${scene}-${engineId}-e${pixelError}-f${shot.frame}.png`;
      await writeFile(out + file, pngFromRgba(Uint8Array.from(Buffer.from(shot.base64, 'base64')), shot.width, shot.height));
      const holes = shot.selectedTriangles === null || shot.triangles === null ? null : shot.selectedTriangles - shot.triangles;
      shots.push({ scene, frame: shot.frame, pixelError, file, selectedTriangles: shot.selectedTriangles, triangles: shot.triangles, drawCalls: shot.drawCalls, residentPages: shot.residentPages, holes });
      lastMetrics = shot;
      console.log(`${scene} e=${pixelError} frame=${shot.frame} selected=${shot.selectedTriangles} tri=${shot.triangles} draws=${shot.drawCalls} resident=${shot.residentPages} trous=${holes} ${shot.width}x${shot.height}`);
    }
  }
  passes.push(passFromSeries({ engine: engineId, order: 'direct', index, load, series: {}, metrics: lastMetrics, shots, error: failure }));
}
await browser.close();

const report = await truthReport({
  scene: options.scenes.join(','), engines: [engineId], engineOrder: 'direct', passes,
  pixelError: pixelErrors.length === 1 ? pixelErrors[0] : null,
  id: `shots-${engineId}-${randomUUID().slice(0, 8)}`,
});
console.log(JSON.stringify({ report: await writeTruthReport(report), png: out }, null, 1));
