// Campagne A — bibliothèque commune. SCRATCHPAD UNIQUEMENT.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';

export const LAB = '/Users/pasquelin/Applications/render-tech-lab';
export const SDK = '/Users/pasquelin/Applications/webGeometry';
export const URL_BASE = process.env.LAB_URL ?? 'http://127.0.0.1:5175';
export const OUT = process.env.OUT_DIR ?? '/tmp/wg-headless';
export const { chromium } = createRequire(resolve(LAB, 'package.json'))('playwright');

export const ALL_ENGINES = ['three-webgl-reference', 'exact-cluster-pages', 'webgpu-page-raster', 'three-lod'];
// ABBA : A=three ref, B=WG WebGL, C=WG WebGPU, D=three LOD  ->  A B C D D C B A
export const abba = e => [...e, ...[...e].reverse()];

export const BASE_FLAGS = [
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--enable-gpu-benchmarking',
];
export const NOVSYNC_FLAGS = ['--disable-frame-rate-limit', '--disable-gpu-vsync'];

export const sdkUrl = '/@fs' + resolve(SDK, 'dist/sdk-browser/index.js');
export const manifestUrlFor = scene => `/benchmark-assets/${scene}-derived/native/full/manifest.json`;

// ---------------------------------------------------------------- empreintes
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
export function clustersPathFor(scene) {
  const dir = join(LAB, 'public/benchmark-assets', scene + '-derived/native/full');
  const pointer = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  return join(dir, pointer.url);
}
export function fingerprints(scenes = ['low-poly-city', 'emerald-square']) {
  const fp = {
    commit: execFileSync('git', ['-C', SDK, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    'dist/sdk-browser/index.js': sha(join(SDK, 'dist/sdk-browser/index.js')),
    'dist/sdk-core/contracts.js': sha(join(SDK, 'dist/sdk-core/contracts.js')),
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
export function machineLoad() {
  const up = execFileSync('uptime', { encoding: 'utf8' }).trim();
  const m = up.match(/load averages?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  const ps = execFileSync('/bin/sh', ['-c',
    "ps -Ao pid,pcpu,comm | grep -Ei 'Google Chrome|web-geometry-compiler|cargo|vite|node' | grep -v grep || true"],
    { encoding: 'utf8' });
  const lines = ps.trim().split('\n').filter(Boolean);
  const strangers = lines.filter(l => !/\s\d+\.\d+\s+node$/.test(l));
  return {
    at: new Date().toISOString(), uptime: up,
    load1: m ? Number(m[1]) : null, load5: m ? Number(m[2]) : null, load15: m ? Number(m[3]) : null,
    chromeProcesses: lines.filter(l => /Google Chrome/i.test(l)).length,
    compilerProcesses: lines.filter(l => /web-geometry-compiler|cargo/i.test(l)).length,
    viteProcesses: lines.filter(l => /vite/i.test(l)).length,
    processes: strangers.slice(0, 40),
  };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Attend jusqu'à `maxMs` que le load 1-min passe sous `target`. Renvoie le relevé retenu. */
export async function waitForQuiet(target = 8, maxMs = 180000) {
  const start = Date.now(); const trace = []; let last = machineLoad();
  trace.push({ t: 0, load1: last.load1 });
  while (last.load1 !== null && last.load1 > target && Date.now() - start < maxMs) {
    await sleep(10000); last = machineLoad();
    trace.push({ t: Math.round((Date.now() - start) / 1000), load1: last.load1 });
  }
  return { ...last, waitedMs: Date.now() - start, waitTrace: trace, interference: !(last.load1 !== null && last.load1 <= target) };
}

// ---------------------------------------------------------------- statistiques
const q = (s, p) => s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)];
export function dist(values) {
  const s = [...values].filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (!s.length) return null;
  return { n: s.length, p50: q(s, .5), p95: q(s, .95), p99: q(s, .99), max: s.at(-1), min: s[0], mean: s.reduce((a, b) => a + b, 0) / s.length };
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
export async function launch({ headless, noVsync, extra = [] }) {
  const args = [...BASE_FLAGS, ...(noVsync ? NOVSYNC_FLAGS : []), ...extra];
  const browser = await chromium.launch({ channel: 'chrome', headless, args });
  return { browser, args };
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

export async function save(name, data) {
  const p = join(OUT, name);
  mkdirSync(dirname(p), { recursive: true });
  await writeFile(p, typeof data === 'string' ? data : JSON.stringify(data, null, 1));
  return p;
}
export { join, resolve, existsSync };
