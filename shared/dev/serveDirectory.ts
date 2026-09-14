import type { Connect } from 'vite';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

export const GLTF_TYPES: Readonly<Record<string, string>> = {
  '.json': 'application/json',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
};

/**
 * Dev-server route streaming files of one directory prepared after startup (Vite's public inventory may predate them).
 * Only listed extensions are served; `..` segments and symlinks leaving the root are refused.
 */
export function serveDirectory(root: string, types: Readonly<Record<string, string>>, missingMessage = 'Resource missing'): Connect.NextHandleFunction {
  return (req, res, next) => {
    void (async () => {
      const fail = (status: number, message: string) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: message }));
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') { fail(405, 'GET or HEAD required'); return; }
      let relative: string;
      try { relative = decodeURIComponent((req.url ?? '').split('?')[0]); } catch { fail(400, 'Invalid resource URL'); return; }
      const candidate = resolve(root, '.' + relative);
      if (relative.split('/').includes('..') || !candidate.startsWith(root + sep)) { fail(403, 'Resource outside served directory'); return; }
      const ext = extname(candidate).toLowerCase();
      if (!types[ext]) { fail(404, 'Unknown resource type'); return; }
      try {
        const [base, target] = await Promise.all([realpath(root), realpath(candidate)]);
        if (!target.startsWith(base + sep)) { fail(403, 'Resource outside served directory'); return; }
        const info = await stat(target);
        if (!info.isFile()) { fail(404, 'Resource is not a file'); return; }
        res.setHeader('Content-Type', types[ext]);
        res.setHeader('Content-Length', info.size);
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = createReadStream(target);
        res.once('close', () => stream.destroy());
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      } catch {
        fail(404, missingMessage);
      }
    })().catch(() => {
      if (typeof next === 'function') next();
      else { res.statusCode = 500; res.end(); }
    });
  };
}
