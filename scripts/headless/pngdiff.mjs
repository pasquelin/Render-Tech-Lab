// Compare deux PNG RGBA 8 bits non entrelacés écrits par lib.mjs (filtre 0 sur chaque ligne).
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

function decode(path) {
  const buf = readFileSync(path);
  let off = 8, w = 0, h = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6) throw new Error('format inattendu'); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error('filtre ' + filter + ' non géré');
    raw.copy(out, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { w, h, data: out };
}

const [a, b] = process.argv.slice(2).map(decode);
if (a.w !== b.w || a.h !== b.h) throw new Error('tailles différentes');
let differing = 0, maxChannel = 0;
const hist = new Map(); const rows = new Map();
for (let i = 0, p = 0; i < a.data.length; i += 4, p++) {
  let d = 0;
  for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a.data[i + c] - b.data[i + c]));
  if (!d) continue;
  differing++; maxChannel = Math.max(maxChannel, d);
  hist.set(d, (hist.get(d) ?? 0) + 1);
  const y = Math.floor(p / a.w); rows.set(y, (rows.get(y) ?? 0) + 1);
}
const buckets = { '1': 0, '2-4': 0, '5-16': 0, '17-64': 0, '>64': 0 };
for (const [d, n] of hist) buckets[d === 1 ? '1' : d <= 4 ? '2-4' : d <= 16 ? '5-16' : d <= 64 ? '17-64' : '>64'] += n;
console.log(JSON.stringify({
  pixels: a.w * a.h, differing, pct: +(100 * differing / (a.w * a.h)).toFixed(3),
  maxChannelError: maxChannel, buckets,
  rowsTouched: rows.size, worstRow: [...rows.entries()].sort((x, y) => y[1] - x[1])[0],
}, null, 1));
