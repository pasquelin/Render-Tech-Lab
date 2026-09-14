// Parcours urbain headless, séquence ABBA, rapport de campagne au schéma partagé.
// Usage : node walk.mjs [moteurs séparés par des virgules] [pixelError] [images]
import { randomUUID } from 'node:crypto';
import { launch, measurePage, sdkUrl, manifestUrlFor, options, machineLoad, passFromSeries, truthReport, writeTruthReport } from './lib.mjs';
import { abbaOrder } from '../../shared/campaign/truthReport.ts';

const engines = process.argv[2] ? process.argv[2].split(',').map(id => id.trim()).filter(Boolean) : options.engines;
const pixelError = process.argv[3] === undefined ? options.pixelError : Number(process.argv[3]);
const frames = process.argv[4] === undefined ? options.frames : Number(process.argv[4]);
const scene = options.scenes[0];
const sequence = abbaOrder(engines);

const { browser } = await launch({ headless: true });
const passes = [];
for (const [index, step] of sequence.entries()) {
  const load = machineLoad();
  const page = await measurePage(browser, options);
  const result = await page.evaluate(async o => {
    const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
    const { urbanPath, warmupFrames } = await import('/src/lab/modelCampaign.ts');
    const { createExplorer } = await import(o.sdkUrl);
    const canvas = document.createElement('canvas');
    canvas.style.width = `${o.cssWidth}px`;
    canvas.style.height = `${o.cssHeight}px`;
    document.body.append(canvas);
    const diagnostics = [];
    let explorer;
    try {
      explorer = await createExplorer(canvas, {
        manifestUrl: o.manifestUrl, scope: 'full', width: o.cssWidth, height: o.cssHeight, pixelRatio: o.devicePixelRatio,
        replicaCount: o.replicaCount, detail: 'source', pixelError: o.pixelError, lodAdaptive: false,
        maxResidentPages: o.maxResidentPages, preload: o.preload, backends: [benchEngine(o.engineId).factory],
        comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: o.measurementMode,
        onDiagnostic: d => { if (diagnostics.length < 40 && /fail|error|capacity|coverage|budget|incomplete/i.test(d.phase + ' ' + d.message)) diagnostics.push(`${d.phase} | ${d.message} | ${JSON.stringify(d.context ?? {}).slice(0, 260)}`); },
      });
    } catch (e) {
      return { createError: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 1200), diagnostics };
    }
    if (!explorer.backends.some(backend => backend.id === o.engineId)) {
      explorer.dispose();
      return { createError: `Le moteur ${o.engineId} n'a pas été créé sur son canvas isolé.`, diagnostics };
    }
    explorer.select(o.engineId);
    const path = urbanPath(explorer.bounds);
    const series = { rafIntervalMs: [], cpuFrameMs: [], cpuSubmitMs: [] };
    let firstError = null, last = null, metrics = null;
    // Les `warmupFrames` premières images sont rendues puis écartées : le rapport ne retient
    // que les images mesurées, comme le parcours de l'interface.
    for (let i = 0; i < o.frames + warmupFrames && !firstError; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now();
      const interval = last === null ? null : now - last;
      last = now;
      const step = path[i % path.length];
      explorer.setPose(step.pose);
      try { metrics = explorer.render(step.pose); } catch (e) { firstError = { frame: i, error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 900) }; break; }
      if (i < warmupFrames || interval === null) continue;
      series.rafIntervalMs.push(interval);
      if (typeof metrics?.cpuFrameMs === 'number') series.cpuFrameMs.push(metrics.cpuFrameMs);
      if (typeof metrics?.cpuSubmitMs === 'number') series.cpuSubmitMs.push(metrics.cpuSubmitMs);
    }
    const final = { ...explorer.render() };
    const numeric = {};
    for (const key of Object.keys(final)) if (typeof final[key] === 'number' || typeof final[key] === 'boolean') numeric[key] = final[key];
    const canvasSize = { deviceWidth: canvas.width, deviceHeight: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, devicePixelRatio: window.devicePixelRatio };
    explorer.dispose();
    canvas.remove();
    return { firstError, series, metrics: numeric, canvasSize, diagnostics };
  }, {
    sdkUrl, manifestUrl: manifestUrlFor(scene), engineId: step.engine, pixelError, frames,
    cssWidth: options.cssWidth, cssHeight: options.cssHeight, devicePixelRatio: options.devicePixelRatio,
    replicaCount: options.replicaCount, preload: options.preload, measurementMode: options.measurementMode,
    maxResidentPages: options.maxResidentPages,
  });
  await page.close();
  passes.push(passFromSeries({
    engine: step.engine, order: step.order, index, load,
    series: result.series ?? {}, metrics: result.metrics,
    error: result.createError ?? (result.firstError ? `image ${result.firstError.frame} : ${result.firstError.error}` : null),
  }));
  console.log(JSON.stringify({ engine: step.engine, order: step.order, canvasSize: result.canvasSize ?? null, createError: result.createError ?? null, firstError: result.firstError ?? null, diagnostics: result.diagnostics ?? [] }));
}
await browser.close();

const report = await truthReport({ scene, engines, engineOrder: 'abba', passes, pixelError, id: `walk-${scene}-${randomUUID().slice(0, 8)}` });
console.log(JSON.stringify({ report: await writeTruthReport(report), refreshCeiling: report.refreshCeiling, aggregates: report.aggregates }, null, 1));
