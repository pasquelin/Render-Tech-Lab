import type { Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** Host-owned cache route: Vite's public-file inventory may predate preparation. */
export function createModelAssetsPlugin(): Plugin {
  return {
    name: 'model-prepared-assets',
    configureServer(server) {
      const root = resolve(server.config.root, 'public/benchmark-assets');
      server.middlewares.use('/benchmark-assets', (req, res, next) => {
        void (async () => {
          const fail = (status: number, message: string) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: message }));
          };
          if (req.method !== 'GET' && req.method !== 'HEAD') { fail(405, 'GET or HEAD required'); return; }
          let relative: string;
          try { relative = decodeURIComponent((req.url ?? '').split('?')[0]); } catch { fail(400, 'Invalid resource URL'); return; }
          const parts = relative.replace(/^\/+/, '').split('/');
          const modelDir = parts[0] ?? '';
          const modelRoot = resolve(root, modelDir);
          const candidate = resolve(root, '.' + relative);
          if (!modelDir || !candidate.startsWith(modelRoot + sep)) { fail(403, 'Resource outside model cache'); return; }
          const type: Record<string, string> = { '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary' };
          if (!type[extname(candidate)]) { fail(404, 'Unknown model resource type'); return; }
          try {
            const [base, target] = await Promise.all([realpath(modelRoot), realpath(candidate)]);
            if (!target.startsWith(base + sep)) { fail(403, 'Resource outside model cache'); return; }
            const info = await stat(target);
            if (!info.isFile()) { fail(404, 'Resource is not a file'); return; }
            res.setHeader('Content-Type', type[extname(target)]);
            res.setHeader('Content-Length', info.size);
            res.setHeader('Cache-Control', 'no-cache');
            if (req.method === 'HEAD') { res.end(); return; }
            const stream = createReadStream(target);
            res.once('close', () => stream.destroy());
            stream.on('error', () => res.destroy());
            stream.pipe(res);
          } catch {
            fail(404, 'Model cache resource missing; run pnpm prepare:models');
          }
        })().catch(() => {
          if (typeof next === 'function') next();
          else { res.statusCode = 500; res.end(); }
        });
      });
    }
  };
}

export const createEmeraldAssetsPlugin = createModelAssetsPlugin;
