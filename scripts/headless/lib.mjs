// Banc 15 — bibliothèque commune des scripts headless.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';
import zlib from 'node:zlib';
import { buildTruthReport, canvasResolution, parseCampaignOptions, frameDistribution, computeHoles } from '../../shared/campaign/truthReport.ts';
import { readSdkProvenance, sdkCheckoutFromLink, sdkDistPath } from '../../shared/campaign/sdkProvenance.ts';
import { readMachineLoad, machineLoadForReport } from '../../shared/campaign/machineLoad.ts';

export const LAB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SDK = sdkCheckoutFromLink(LAB);
export const SDK_DIST = sdkDistPath(process.env, SDK);
export const TEST_ID = '15-virtualized-integration';
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const OUT = process.env.OUT_DIR ?? '/tmp/wg-headless';
export const { chromium } = createRequire(resolve(LAB, 'package.json'))('playwright');

/** `HEADLESS=0` bascule en Chrome stable visible ; toute autre valeur (ou son absence) garde le headless par défaut. */
export function modeFromEnv(env = process.env) {
  return env.HEADLESS === '0' ? 'visible' : 'headless';
}
export const MODE = modeFromEnv();
export const HEADLESS = MODE === 'headless';

/** Ordre figé du protocole : A référence Three.js, B LOD Three.js, C WebGeometry WebGL, D WebGeometry WebGPU. */
export const ALL_ENGINES = ['three-webgl-reference', 'three-lod', 'exact-cluster-pages', 'webgpu-page-raster'];
export const ALL_SCENES = ['emerald-square', 'drive-for-speed-map', 'bistro-exterior', 'low-poly-city', 'new-york', 'new-york-manhattan', 'skibidi-toilet-77-map', 'accucities-london'];

/**
 * Drapeaux Chrome de toutes les mesures. Chrome headless plafonne vers 59,9 Hz quels que soient
 * les drapeaux GPU : aucun drapeau ne lève ce plafond, seul le mode visible (`HEADLESS=0`) atteint
 * le rafraîchissement réel de l'écran. `--disable-frame-rate-limit` dégrade encore le headless
 * (54,6 Hz mesurés) et désynchronise le rendu visible du vsync réel (18,3 ms/image contre 8,3 ms
 * sans lui) : il n'est donc jamais posé. `--disable-gpu-vsync` seul reste inoffensif.
 */
export const BASE_FLAGS = [
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--enable-gpu-benchmarking',
  '--disable-gpu-vsync',
  '--enable-unsafe-webgpu',
];

export const options = parseCampaignOptions(process.env, { scenes: ALL_SCENES.slice(0, 1), engines: ALL_ENGINES });
export const URL_BASE = options.labUrl;
export const sdkUrl = '/@fs' + join(SDK_DIST, 'sdk-browser/index.js');
export const manifestUrlFor = scene => `/benchmark-assets/${scene}-derived/native/full/manifest.json`;

// ---------------------------------------------------------------- empreintes
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
export function clustersPathFor(scene) {
  const dir = join(LAB, 'public/benchmark-assets', scene + '-derived/native/full');
  const pointer = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  return join(dir, pointer.url);
}
/** Empreinte de contenu d'un cache de scène. Lit le fichier de clusters entier : coûteux sur les grosses scènes. */
export function fingerprints(scenes = ['low-poly-city']) {
  const fp = {
    'dist/sdk-browser/index.js': sha(join(SDK_DIST, 'sdk-browser/index.js')),
    'dist/sdk-core/contracts.js': sha(join(SDK_DIST, 'sdk-core/contracts.js')),
  };
  for (const s of scenes) {
    const p = clustersPathFor(s);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    fp['clusters:' + s] = sha(p);
    fp['meta:' + s] = { formatVersion: j.formatVersion ?? j.schema, errorModel: j.errorModel ?? null, key: j.key ?? null, selectedTriangles: j.selectedTriangles };
  }
  return fp;
}

// ---------------------------------------------------------------- interférence
export { readMachineLoad as machineLoad, machineLoadForReport, computeHoles };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Attend jusqu'à `maxMs` que le load 1-min passe sous `target`. Renvoie le relevé retenu. */
export async function waitForQuiet(target = 8, maxMs = 180000) {
  const start = Date.now(); const trace = []; let last = readMachineLoad();
  trace.push({ t: 0, load1: last.load1 });
  while (last.load1 !== null && last.load1 > target && Date.now() - start < maxMs) {
    await sleep(10000); last = readMachineLoad();
    trace.push({ t: Math.round((Date.now() - start) / 1000), load1: last.load1 });
  }
  return { ...last, waitedMs: Date.now() - start, waitTrace: trace, interference: !(last.load1 !== null && last.load1 <= target) };
}

// ---------------------------------------------------------------- PNG
let CRC;
function crc32(buf) {
  if (!CRC) { CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
  let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}
/** RGBA origine bas-gauche (readPixels) -> PNG 8 bits RGBA sans perte. */
export function pngFromRgba(rgba, w, h) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  const src = Buffer.from(rgba.buffer ?? rgba, rgba.byteOffset ?? 0, rgba.byteLength ?? rgba.length);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; src.copy(raw, y * (stride + 1) + 1, (h - 1 - y) * stride, (h - y) * stride); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Petit serveur de collecte binaire : la page POSTe les RGBA bruts, Node écrit le PNG. */
export async function captureSink(port = 5199) {
  const pending = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') { res.statusCode = 204; return res.end(); }
    const parts = [];
    req.on('data', c => parts.push(c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const file = url.searchParams.get('file');
      const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h'));
      const body = Buffer.concat(parts);
      res.statusCode = body.length === w * h * 4 ? 200 : 400;
      res.end(String(body.length));
      if (body.length !== w * h * 4) { pending.push(Promise.reject(new Error(`taille capture ${file}: ${body.length} != ${w * h * 4}`))); return; }
      const dest = join(OUT, 'captures', file);
      mkdirSync(dirname(dest), { recursive: true });
      pending.push(writeFile(dest, pngFromRgba(body, w, h)));
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { port, close: async () => { await Promise.all(pending); server.close(); }, pending };
}

// ---------------------------------------------------------------- Chrome
/**
 * Lance Chrome stable. Headless par défaut (`HEADLESS` de `lib.mjs`) ; en mode visible, la
 * fenêtre s'ouvre sur l'écran principal à la résolution de mesure demandée (`WIDTH` × `HEIGHT`) et
 * repasse au premier plan : une fenêtre occultée peut manquer des vsync et rattraper par des
 * images anormalement rapides, ce qui fausse le plafond calibré.
 */
export async function launch({ headless = HEADLESS, extra = [] } = {}) {
  const windowFlags = headless ? [] : [`--window-position=0,0`, `--window-size=${options.cssWidth},${options.cssHeight}`];
  const args = [...BASE_FLAGS, ...windowFlags, ...extra];
  const browser = await chromium.launch({ executablePath: CHROME, headless, args });
  if (!headless) await promisify(execFile)('osascript', ['-e', 'tell application "Google Chrome" to activate']).catch(() => {});
  return { browser, args };
}
/** Page dimensionnée en pixels CSS avec le DPR demandé : le canvas physique vaut CSS × DPR. */
export async function measurePage(browser, { cssWidth, cssHeight, devicePixelRatio }) {
  const page = await browser.newPage({ viewport: { width: cssWidth, height: cssHeight }, deviceScaleFactor: devicePixelRatio });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(URL_BASE + '/', { waitUntil: 'load' });
  return page;
}
export async function gpuInfo(browser) {
  const s = await browser.newBrowserCDPSession();
  const info = await s.send('SystemInfo.getInfo');
  const devices = info.gpu?.devices ?? [];
  const text = JSON.stringify(info.gpu ?? {});
  return {
    devices, auxAttributes: {
      glRenderer: info.gpu?.auxAttributes?.glRenderer ?? null,
      glVendor: info.gpu?.auxAttributes?.glVendor ?? null,
      glVersion: info.gpu?.auxAttributes?.glVersion ?? null,
      passthroughCmdDecoder: info.gpu?.auxAttributes?.passthroughCmdDecoder ?? null,
    },
    software: /swiftshader|llvmpipe|lavapipe/i.test(text),
    metal: /metal|apple/i.test(text),
  };
}

// ---------------------------------------------------------------- rapport de campagne
/** Passe de mesure au schéma du rapport, à partir des séries brutes remontées par la page. */
export function passFromSeries({ engine, order, index, load, series, metrics, shots = null, error = null }) {
  const threshold = options.slowFrameThresholdMs;
  return {
    engine, order, index,
    machineLoad: load ? machineLoadForReport(load) : null,
    raf: frameDistribution(series.rafIntervalMs ?? [], threshold),
    cpuFrameMs: frameDistribution(series.cpuFrameMs ?? [], threshold),
    cpuSubmitMs: frameDistribution(series.cpuSubmitMs ?? [], threshold),
    gpuMs: null,
    vramBytes: null,
    selectedTriangles: metrics?.selectedTriangles ?? null,
    triangles: metrics?.triangles ?? null,
    drawCalls: metrics?.drawCalls ?? null,
    residentPages: metrics?.residentPages ?? null,
    shots,
    error,
  };
}

/**
 * Assemble le rapport de campagne headless : même schéma que celui de l'interface. `environment`
 * consigne le mode (`headless`/`visible`) sauf mesure explicite. `ceilingIntervalsMs`, à défaut,
 * calibre le plafond sur le seul minimum de chaque passe (`buildTruthReport`) : un script qui
 * dispose des séries rAF complètes doit les fournir pour un 5e centile représentatif.
 */
export async function truthReport({ scene, engines, engineOrder, passes, id, environment = MODE, pixelError = options.pixelError, ceilingIntervalsMs }) {
  return buildTruthReport({
    source: 'headless',
    campaign: options.campaign,
    id,
    timestamp: new Date().toISOString(),
    scene,
    engines,
    engineOrder,
    replicaCount: options.replicaCount,
    pixelError,
    measurementMode: options.measurementMode,
    resolution: canvasResolution({ cssWidth: options.cssWidth, cssHeight: options.cssHeight, devicePixelRatio: options.devicePixelRatio }),
    sdk: await readSdkProvenance(SDK_DIST),
    slowFrameThresholdMs: options.slowFrameThresholdMs,
    passes,
    environment,
    ceilingIntervalsMs,
  });
}

/**
 * Écrit le rapport dans le dossier de campagne nommé et met son index `latest.json` à jour.
 * Le nom refusant le préfixe « campaign- », le dossier échappe à la rétention à deux campagnes.
 */
export async function writeTruthReport(report) {
  const directory = join(LAB, 'reports', TEST_ID, report.campaign);
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${report.id}.json`);
  await writeFile(file, JSON.stringify(report, null, 1) + '\n');
  await writeFile(join(directory, 'latest.json'), JSON.stringify({ archivedAt: report.timestamp, report: `${report.id}.json` }, null, 1) + '\n');
  return file;
}

export async function save(name, data) {
  const p = join(OUT, name);
  mkdirSync(dirname(p), { recursive: true });
  await writeFile(p, typeof data === 'string' ? data : JSON.stringify(data, null, 1));
  return p;
}
export { join, resolve, existsSync };
