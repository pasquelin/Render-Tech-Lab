import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url)), require = createRequire(import.meta.url);
const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
const directory = join(root, 'benchmark-runs', 'checks', `15-${id}`);
await mkdir(directory, { recursive: true });
const artifact = { id, status: 'not-run', errors: [], runs: [], sources: {}, environment: {} };
async function sources() {
  const files = [];
  async function visit(path) { for (const item of await readdir(join(root, path), { withFileTypes: true })) {
    const name = `${path}/${item.name}`;
    if (item.isDirectory() && !['results', 'node_modules'].includes(item.name)) await visit(name);
    else if (/\.(ts|mjs|wgsl|html)$/.test(item.name)) files.push(name);
  } }
  for (const path of ['15-virtualized-integration', '01-indirect-draw', 'shared', 'bench', 'src']) await visit(path);
  const hash = createHash('sha256'), content = {};
  for (const file of files.sort()) { content[file] = await readFile(join(root, file), 'utf8'); hash.update(file); hash.update(content[file]); }
  return { hash: hash.digest('hex'), content };
}
let browser, server, deadline;
try {
  artifact.sources = await sources();
  artifact.environment.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const port = 5193;
  server = spawn(process.execPath, [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'pipe' });
  let serverError = ''; server.stdout.resume(); server.stderr.on('data', data => { serverError += data; });
  const url = `http://127.0.0.1:${port}/15-virtualized-integration/smoke.html`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverError);
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Preview unavailable');
  browser = await chromium.launch({ channel: process.env.RTL_BROWSER_CHANNEL ?? 'chrome', headless: true });
  const system = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
  artifact.environment = { ...artifact.environment, browser: browser.version(), system };
  if (/swiftshader|llvmpipe|lavapipe/i.test(JSON.stringify(system.gpu?.devices))) throw new Error('Software GPU: physical run not executed');
  const page = await browser.newPage(); page.on('pageerror', error => artifact.errors.push(String(error)));
  await page.goto(url); await page.waitForFunction(() => !!window.integrationSmoke);
  const timeout = new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Smoke deadline exceeded')), 90_000); });
  for (const config of [{ fallback: false }, { fallback: true }, { fallback: true, cancelAt: 'verify' }, { fallback: true, cancelAt: 'measure' }]) {
    const result = await Promise.race([page.evaluate(({ fallback, cancelAt }) => window.integrationSmoke(fallback, cancelAt), config), timeout]);
    artifact.runs.push({ config, result });
    if (!config.cancelAt && result.status !== 'measured') throw new Error(`Physical control not measured: ${result.reason}`);
    if (config.fallback && result.records.some(record => record.gpuMs !== null)) throw new Error('Fallback invented GPU timing');
  }
  if(process.argv.includes('--ui')) {
    await page.goto(`http://127.0.0.1:${port}/?test=15-virtualized-integration`);
    await page.locator('[data-execution-view="idle"]').waitFor();
    for(let cycle=0;cycle<2;cycle++) {
      await page.getByRole('button',{name:'Exécuter les trois contrôles',exact:true}).first().click();
      await page.locator('[data-execution-view="completed"]').waitFor({timeout:60_000});
      if((await page.locator('body').innerText()).includes('Archivage indisponible'))throw new Error('UI archive failed');
    }
    await page.getByRole('button',{name:'Voir le rapport',exact:true}).first().click();
    await page.locator('#report-modal[open]').waitFor();
    await page.waitForFunction(()=>document.querySelector('#modal-report-body')?.textContent?.includes('Cache sous pression'));
    artifact.ui={idle:true,completed:true,restarted:true,archivedReportOpened:true};
    await page.screenshot({path:join(directory,'react-report.png'),animations:'disabled'});
  }
  if (artifact.errors.length) throw new Error('Browser errors');
  const after = await sources(); artifact.sources.afterHash = after.hash;
  if (after.hash !== artifact.sources.hash) throw new Error('Sources changed during smoke');
  artifact.status = 'checked';
} catch (error) { artifact.errors.push(String(error)); process.exitCode = 1; }
finally {
  clearTimeout(deadline);
  if (browser) await browser.close(); if (server) server.kill('SIGTERM');
  await writeFile(join(directory, 'raw.json'), JSON.stringify(artifact, null, 2));
  console.log(`Integration smoke ${artifact.status}: ${directory}`);
}
