import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { GLTF_TYPES, serveDirectory } from '../../shared/dev/serveDirectory.ts';

const MODEL_TYPES = {
  ...GLTF_TYPES,
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.dds': 'image/vnd-ms.dds',
  '.txt': 'text/plain; charset=utf-8',
};

/** Host-owned cache route: Vite's public-file inventory may predate preparation. */
export function createModelAssetsPlugin(): Plugin {
  return {
    name: 'model-prepared-assets',
    configureServer(server) {
      const root = resolve(server.config.root, 'public/benchmark-assets');
      server.middlewares.use('/benchmark-assets', serveDirectory(root, MODEL_TYPES, 'Model cache resource missing; run pnpm prepare:models'));
    }
  };
}
