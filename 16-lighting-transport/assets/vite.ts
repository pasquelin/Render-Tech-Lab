import type { Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const RESOURCE_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Serves one cache directory read-only under one URL prefix, with the same containment
 * checks as 15-virtualized-integration/assets/vite.ts (createModelAssetsPlugin). */
function serveCache(urlPrefix: string, root: string) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    void (async () => {
      const fail = (status: number, message: string) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: message })); };
      if (req.method !== 'GET' && req.method !== 'HEAD') { fail(405, 'GET or HEAD required'); return; }
      let relative: string;
      try { relative = decodeURIComponent((req.url ?? '').split('?')[0]); } catch { fail(400, 'Invalid resource URL'); return; }
      const candidate = resolve(root, '.' + relative);
      if (candidate !== root && !candidate.startsWith(root + sep)) { fail(403, 'Resource outside cache'); return; }
      const ext = extname(candidate).toLowerCase();
      if (!RESOURCE_TYPES[ext]) { fail(404, 'Unknown cache resource type'); return; }
      try {
        const [base, target] = await Promise.all([realpath(root), realpath(candidate)]);
        if (!target.startsWith(base + sep)) { fail(403, 'Resource outside cache'); return; }
        const info = await stat(target);
        if (!info.isFile()) { fail(404, 'Resource is not a file'); return; }
        res.setHeader('Content-Type', RESOURCE_TYPES[ext]);
        res.setHeader('Content-Length', info.size);
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = createReadStream(target);
        res.once('close', () => stream.destroy());
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      } catch {
        fail(404, `Cache resource missing under ${urlPrefix}`);
      }
    })().catch(() => { if (typeof next === 'function') next(); else { res.statusCode = 500; res.end(); } });
  };
}

/** Sert le cache local du banc (maison compilée par prepareHouse.ts, voir npm run prepare:house) et,
 * en lecture seule, le cache Emerald déjà compilé du Lab principal — jamais écrit ici. Le chemin du
 * Lab principal peut être ajusté via RENDER_TECH_LAB_MAIN_ROOT si besoin sur une autre machine. */
export function createLightingAssetsPlugin(): Plugin {
  return {
    name: 'lighting-bench-cache',
    configureServer(server) {
      const houseRoot = resolve(server.config.root, '16-lighting-transport/assets/cache');
      const mainLabRoot = process.env.RENDER_TECH_LAB_MAIN_ROOT ?? '/Users/pasquelin/Applications/render-tech-lab';
      const emeraldRoot = resolve(mainLabRoot, 'public/benchmark-assets/emerald-square-derived');
      // Le glTF source du cache compilé référence ses textures par une URL absolue
      // /benchmark-assets/emerald-square/... (resourceBaseUrl figé à la compilation, côté Lab
      // principal). Ce banc n'a pas de dossier public/ : on ressert ces textures en lecture seule
      // depuis le Lab principal, sans jamais les modifier.
      const emeraldSourceRoot = resolve(mainLabRoot, 'public/benchmark-assets/emerald-square');
      server.middlewares.use('/16-lighting-cache', serveCache('/16-lighting-cache', houseRoot));
      server.middlewares.use('/emerald-night-cache', serveCache('/emerald-night-cache', emeraldRoot));
      server.middlewares.use('/benchmark-assets/emerald-square', serveCache('/benchmark-assets/emerald-square', emeraldSourceRoot));
    },
  };
}
