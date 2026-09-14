import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { GLTF_TYPES, serveDirectory } from '../../shared/dev/serveDirectory.ts';

const RESOURCE_TYPES = { ...GLTF_TYPES, '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

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
      server.middlewares.use('/16-lighting-cache', serveDirectory(houseRoot, RESOURCE_TYPES, 'House cache resource missing; run npm run prepare:house'));
      server.middlewares.use('/emerald-night-cache', serveDirectory(emeraldRoot, RESOURCE_TYPES, 'Emerald cache resource missing in the main Lab'));
      server.middlewares.use('/benchmark-assets/emerald-square', serveDirectory(emeraldSourceRoot, RESOURCE_TYPES, 'Emerald source texture missing in the main Lab'));
    },
  };
}
