import { openLabPage, explorerOptions, sdkUrl, manifestUrlFor } from './lib.mjs';
const engineId = process.argv[2] ?? 'exact-cluster-pages'; const pixelError = Number(process.argv[3] ?? 1); const frames = Number(process.argv[4] ?? 600);
const { browser, page } = await openLabPage();
const r = await page.evaluate(async (o) => {
  const { benchEngine } = await import('/15-virtualized-integration/implementation/engines.ts');
  const { urbanPath } = await import('/src/lab/modelCampaign.ts');
  const { createExplorer } = await import(o.sdkUrl);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  let explorer; try { explorer = await createExplorer(canvas, { ...o.options, backends: [benchEngine(o.engineId).factory], onDiagnostic: d => { if (!globalThis.__d) globalThis.__d = []; if (globalThis.__d.length < 40 && /fail|error|capacity|coverage|budget|incomplete/i.test(d.phase + ' ' + d.message)) globalThis.__d.push(d.phase + ' | ' + d.message + ' | ' + JSON.stringify(d.context ?? {}).slice(0, 260)); } }); } catch (e) { return { createError: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 1200), diags: globalThis.__d ?? [] }; }
  const path = urbanPath(explorer.bounds); let firstError = null; const raf = [];
  let last = performance.now();
  for (let i = 0; i < o.frames && !firstError; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const now = performance.now(); raf.push(now - last); last = now;
    const step = path[i % path.length]; explorer.setPose(step.pose);
    try { explorer.render(step.pose); } catch (e) { firstError = { frame: i, error: String(e?.message ?? e), stack: String(e?.stack ?? '').slice(0, 900) }; }
  }
  const m = { ...explorer.render() }; const out = {}; for (const k of Object.keys(m)) if (typeof m[k] === 'number' || typeof m[k] === 'boolean') out[k] = m[k];
  raf.sort((a, b) => a - b); out.rafP50 = raf[Math.floor(raf.length / 2)]; out.rafP95 = raf[Math.floor(raf.length * 0.95)]; out.over50ms = raf.filter(x => x > 50).length;
  return { firstError, metrics: out };
}, { sdkUrl, engineId, frames, options: explorerOptions(manifestUrlFor(process.env.SCENE ?? 'emerald-square'), { pixelError, preload: process.env.PRELOAD ?? 'visible', diagnosticDetail: process.env.DETAIL ?? 'summary' }) });
console.log(JSON.stringify(r));
await browser.close();
