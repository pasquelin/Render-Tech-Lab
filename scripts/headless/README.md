# Scripts headless du banc 15 (Chrome + Playwright, sans UI)

Pré-requis : `npx vite --port 5175 --strictPort --host 127.0.0.1` lancé dans le Lab (ou `LAB_URL=http://127.0.0.1:<port>`), caches présents dans `public/benchmark-assets/<scene>-derived`. Le SDK est lu depuis le `dist/` du paquet `@web-geometry/sdk` installé (variable `SDK_DIST` pour un autre `dist/`) ; les sorties vont dans `OUT_DIR` (défaut `/tmp/wg-headless`).

| Script | Usage | Ce qu'il donne |
|---|---|---|
| `walk.mjs <moteur> <pixelError> <images>` | `SCENE=emerald-square PRELOAD=all DETAIL=summary node walk.mjs webgpu-page-raster 1 600` | parcours urbain complet, `firstError`, cpuFrameMs, rAF p50/p95, images > 50 ms, métriques finales |
| `shots.mjs <moteur> <frames> <pixelErrors>` | `MAX_PAGES=4096 TAG=x- node shots.mjs exact-cluster-pages 300,450 0,1` | captures PNG sans perte par pose, `tri` vs `selected` (trous) |
| `loop.mjs <moteur> <pixelError> <preload> <detail>` | `REPLICAS=9 node loop.mjs webgpu-page-raster 1 visible summary` | rendu statique 240 images, diagnostics d'erreur |
| `stack.mjs <moteurs…>` | `node stack.mjs webgpu-page-raster exact-cluster-pages` | chargement + première image, trace d'exception |
| `ui.mjs` | `node ui.mjs` | pilotage de l'interface réelle du Lab (lancement, bascule de moteur) |
| `pngdiff.mjs a.png b.png` | | pixels différents et erreur max par canal |

Moteurs : `three-webgl-reference`, `three-lod`, `exact-cluster-pages` (WebGeometry WebGL), `webgpu-page-raster` (WebGeometry WebGPU). Ne jamais lancer deux mesures de performance en même temps, ni pendant `pnpm prepare:models`.
