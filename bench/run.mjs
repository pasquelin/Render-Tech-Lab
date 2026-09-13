import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeReportArchive } from '../shared/archive/index.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const smoke = process.argv.includes('--smoke');
const forceFallback = process.argv.includes('--fallback');
const requested = process.argv.find(a => a.startsWith('--test='))?.slice(7);
const tests = requested ? [requested] : ['01-indirect-draw', '02-gpu-frustum-culling', '09-gpu-compaction'];
const port = Number(process.env.RTL_BENCH_PORT ?? 5187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const url = `http://127.0.0.1:${port}/bench/`;
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'pipe' });
let serverError = '', browser, timeout;
server.stderr.on('data', data => { serverError += data; });
server.stdout.resume();
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverError}`);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Preview not ready');
  const args = JSON.parse(process.env.RTL_CHROME_ARGS_JSON ?? '[]');
  if (!Array.isArray(args) || !args.every(v => typeof v === 'string')) throw new Error('Invalid Chrome flags');
  browser = await chromium.launch({ channel: process.env.RTL_BROWSER_CHANNEL ?? 'chrome', headless: true, args });
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const cdp = await browser.newBrowserCDPSession();
  const system = await cdp.send('SystemInfo.getInfo');
  await page.goto(url);
  await page.waitForFunction(() => !!window.renderTechLabBench, null, { timeout: 30_000 });
  const probe = await page.evaluate(() => window.renderTechLabBench.probe());
  const physicalDescription = JSON.stringify(system.gpu?.devices ?? []);
  if (!probe.ready || probe.adapter?.isFallbackAdapter !== false
    || /swiftshader|llvmpipe|lavapipe/i.test(physicalDescription)) throw new Error('Hardware WebGPU unavailable; no benchmark published');
  let commit = null, sourceHash = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
      .filter(p => /^(src|shared|bench|\d\d-[^/]+)\//.test(p) && /\.(ts|mjs|wgsl|html)$/.test(p) && !p.includes('/results/')).sort();
    const hash = createHash('sha256');
    for (const file of files) { hash.update(file); hash.update(await readFile(join(root, file))); }
    sourceHash = hash.digest('hex');
  } catch {}
  const runs = [];
  const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Campaign timeout')), smoke ? 120_000 : 45 * 60_000); });
  for (const test of tests) {
    const config = { test, forceFallback, ...(smoke ? { counts: [1, 127, 128, 129], warmup: 2, samples: 4, blocks: 2 } : {}) };
    const result = await Promise.race([page.evaluate(options => window.renderTechLabBench.run(options), config), deadline]);
    if (pageErrors.length || result.status !== 'measured' || !Number.isInteger(result.validSamples)
      || result.validSamples < 1 || result.validationErrors?.length) throw new Error(`Campaign failed: ${JSON.stringify({ pageErrors, result })}`);
    runs.push({ test, config, result });
  }
  // Smoke checks never publish a physical performance campaign.
  if (!smoke) for (const { test, config, result } of runs) {
    const record = { timestamp: new Date().toISOString(), test, commit, status: 'measured', verdict: 'not-yet-decided',
      environment: { gpu: probe.adapter.description || null, browser: browser.version(), threeVersion: probe.threeRevision, webgpuFeatures: probe.features },
      scene: { objects: null, triangles: null, materials: null, lights: null },
      cpu: { frameMs: null, submitMs: null }, gpu: { frameMs: null }, memory: { gpuBytes: null }, draw: { submitted: null, visible: null },
      customMetrics: { execution: 'browser-webgpu', sourceHash, protocol: config,
        validSamples: result.validSamples, comparisons: result.records,
        visualComparison: `data:image/svg+xml;base64,${Buffer.from(result.chart).toString('base64')}` },
      raw: { browser: browser.version(), args, system, probe, result } };
    await writeReportArchive(root, { testId: test, markdown: result.report, latest: record,
      engineEvents: [{ timestamp: record.timestamp, level: 'info', phase: 'browser-webgpu', message: 'Campagne physique archivée.', context: { sourceHash, validSamples: result.validSamples } }] });
  }
  console.log(`WebGPU checks complete: ${smoke ? 'contrôle non publié' : 'rapports/packages générés'}`);
} finally {
  clearTimeout(timeout);
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
