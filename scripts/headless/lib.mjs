// Campagne A — bibliothèque commune. SCRATCHPAD UNIQUEMENT.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

export const LAB = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(resolve(LAB, 'package.json'));
/** `SDK_DIST` désigne un autre `dist/` que celui du paquet installé. */
export const SDK_DIST = process.env.SDK_DIST ?? join(dirname(require.resolve('@web-geometry/sdk/package.json')), 'dist');
export const URL_BASE = process.env.LAB_URL ?? 'http://127.0.0.1:5175';
export const OUT = process.env.OUT_DIR ?? '/tmp/wg-headless';
export const { chromium } = require('playwright');

export const BASE_FLAGS = [
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--enable-gpu-benchmarking',
  '--enable-unsafe-webgpu',
];

export const sdkUrl = '/@fs' + join(SDK_DIST, 'sdk-browser/index.js');
export const manifestUrlFor = scene => `/benchmark-assets/${scene}-derived/native/full/manifest.json`;

/** Chrome headless sur le Lab, page ouverte à `path`, erreurs de page relayées sur stdout. */
export async function openLabPage({ path = '/', viewport = { width: 1280, height: 720 }, extraArgs = [] } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [...BASE_FLAGS, ...extraArgs] });
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(URL_BASE + path, { waitUntil: 'load' });
  return { browser, page };
}

/** Options sérialisables de `createExplorer` ; la page ajoute `backends` (fonctions) elle-même. */
export const explorerOptions = (manifestUrl, overrides = {}) => ({
  manifestUrl, scope: 'full', width: 1280, height: 720, pixelRatio: 1, replicaCount: 1, detail: 'source', pixelError: 1,
  lodAdaptive: false, maxResidentPages: 100000, preload: 'visible', comparisonLayout: 'single', clearColor: 0x2a303c, diagnosticDetail: 'summary',
  ...overrides,
});

export function outputPath(name) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  return path;
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
