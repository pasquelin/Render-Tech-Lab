# Scripts headless du banc 15 (Chrome + Playwright, sans UI)

Pré-requis : `pnpm dev` lancé dans le Lab — il sert sur **5174**, port visé par défaut
(`LAB_URL` pour un autre port) ; caches présents dans `public/benchmark-assets/<scene>-derived`.
Le SDK est lu depuis `/Users/pasquelin/Applications/webGeometry/dist` (`SDK_DIST` pour un autre
`dist/`) : posée avant `pnpm dev`, la même variable fait aussi servir ce `dist/` par le serveur
(import `@web-geometry/sdk`, provenance rapportée) — scripts et interface voient alors le même SDK.
Pour comparer avant/après avec deux `dist/` : soit deux serveurs sur deux ports — `server.port` du
Lab est fixe, donc le second passe par `--port` en ligne de commande, pas par une variable
d'environnement — `SDK_DIST=<avant> pnpm dev` puis `SDK_DIST=<après> pnpm dev -- --port 5175`, et
`LAB_URL=http://127.0.0.1:5175` pour la campagne qui vise le second ; soit un seul serveur,
redémarré avec l'autre `SDK_DIST` entre les deux campagnes.
Les scripts sont exécutés par Node directement : ils importent des modules TypeScript de
`shared/campaign/`, dont Node retire les types.

Tous les scripts lancent Chrome avec les mêmes `BASE_FLAGS`, dont `--disable-frame-rate-limit` et
`--disable-gpu-vsync` : sans ces deux drapeaux, aucun FPS mesuré ne peut dépasser 60.

| Script | Usage | Ce qu'il donne |
|---|---|---|
| `walk.mjs [moteurs] [pixelError] [images]` | `CAMPAIGN=verite-emerald-1i-dpr1 SCENE=emerald-square PRELOAD=all node walk.mjs` | parcours urbain complet en séquence ABBA, deux passes par moteur, rapport de campagne JSON |
| `shots.mjs [moteur] [images] [pixelErrors]` | `SCENES=emerald-square,new-york MAX_PAGES=4096 TAG=ref- node shots.mjs three-webgl-reference 0,150,300,450 0` | captures PNG sans perte par pose et par scène, `triangles` contre `selectedTriangles` (trous), rapport de campagne JSON |
| `loop.mjs [moteur]` | `REPLICAS=9 node loop.mjs webgpu-page-raster` | rendu statique de 240 images, diagnostics d'erreur |
| `stack.mjs [moteur…]` | `node stack.mjs webgpu-page-raster exact-cluster-pages` | chargement et première image par moteur, trace d'exception |
| `ui.mjs` | `node ui.mjs` | pilotage de l'interface réelle du Lab (lancement, bascule de moteur) |
| `pngdiff.mjs a.png b.png` | | pixels différents, erreur max par canal, histogramme et lignes touchées |

Les arguments positionnels de `walk.mjs` et `shots.mjs` prennent le pas sur `PIXEL_ERROR` et
`FRAMES`. Sans argument, `walk.mjs` joue les quatre moteurs dans l'ordre du protocole.

## Variables d'environnement

| Variable | Défaut | Effet |
|---|---|---|
| `CAMPAIGN` | `verite` | nom du dossier de campagne sous `reports/15-virtualized-integration/`. Lettres, chiffres, tirets ; le préfixe `campaign-` est refusé (il est balayé par la rétention à deux campagnes) |
| `SCENE` / `SCENES` | `emerald-square` | scène, ou liste de scènes séparées par des virgules (`shots.mjs` les parcourt toutes) |
| `ENGINES` | les quatre moteurs du protocole | liste de moteurs séparés par des virgules |
| `WIDTH` / `HEIGHT` | `1280` / `720` | résolution de mesure en pixels CSS |
| `DPR` | `1` | pixels physiques par pixel CSS ; le canvas physique mesure `WIDTH × DPR` par `HEIGHT × DPR` |
| `REPLICAS` | `1` | nombre d'instances : `1` ou `9`, les deux étendues du protocole |
| `PIXEL_ERROR` | `0` | seuil d'erreur écran passé au moteur de géométrie virtualisée |
| `FRAMES` | `600` | images mesurées par passe, préchauffage exclu |
| `DETAIL` | `summary` | mode de mesure : `summary` ou `trace`. Le protocole impose `summary` pendant une fenêtre chronométrée |
| `PRELOAD` | `visible` | `visible` ou `all` |
| `SLOW_FRAME_MS` | `8.333` | seuil d'image lente du rapport (1/120 s) |
| `MAX_PAGES` | `100000` | plafond de pages résidentes |
| `TAG` | vide | préfixe des noms de fichiers PNG de `shots.mjs` |
| `LAB_URL` | `http://127.0.0.1:5174` | serveur du Lab |
| `SDK_DIST` | `<webGeometry>/dist` | autre `dist/` du SDK — lu par les scripts et, posée avant `pnpm dev`, par le serveur |
| `OUT_DIR` | `/tmp/wg-headless` | sortie de `save()` et de `captureSink()` |

Une valeur illisible fait échouer le script plutôt que dégrader silencieusement la mesure.

## Rapport de campagne

`walk.mjs` et `shots.mjs` écrivent leur rapport sous
`reports/15-virtualized-integration/<CAMPAIGN>/<id>.json`, et mettent à jour
`reports/15-virtualized-integration/<CAMPAIGN>/latest.json` = `{archivedAt, report}`. Le dossier
nommé échappe à la rétention à deux campagnes, qui ne balaie que le préfixe `campaign-`.

Le rapport porte le schéma `banc15-truth-campaign/v1`, identique à celui produit par l'interface
(`shared/campaign/truthReport.ts`) : campagne, scène, moteurs, ordre, `replicaCount`, `pixelError`,
mode de mesure, résolution CSS et physique avec le DPR effectif, plafond rAF calibré, provenance du
SDK (commit du checkout dont vient `dist/` — celui de `SDK_DIST` s'il est posé, donc un worktree
d'agent y compris son propre commit et son propre état —, drapeau dirty, hash de contenu de
`buildProvenance` — le drapeau dirty ignore les fichiers suivis sous `orchestration/` et `docs/` du
dépôt moteur, écrits en continu et étrangers à `dist/`), puis une passe par moteur et par sens avec
la charge machine relevée avant le bloc, les
distributions rAF, CPU frame et CPU submit (FPS médian, p50, p95, p99, images au-delà du seuil),
`gpuMs` et `vramBytes` à `null`. CPU et GPU ne sont jamais additionnés.

`walk.mjs` joue la séquence ABBA — ordre direct puis ordre inverse — et conserve les deux passes.
Son agrégat par moteur est la médiane des deux sens, avec une alerte au-delà de 5 % d'écart
aller/retour. Une campagne de l'interface ne joue qu'un sens : l'agrégat des deux se construit en
concaténant les passes des rapports aller et retour.

## Fidélité

`shots.mjs` écrit ses PNG dans `scripts/headless/shots/<TAG><scène>-<moteur>-e<pixelError>-f<image>.png`
et imprime par pose `selected`, `tri`, `draws`, `resident` et `trous` (`selectedTriangles` moins
`triangles` : une valeur non nulle signale de la géométrie sélectionnée mais non dessinée).
`pngdiff.mjs` rend `{pixels, differing, pct, maxChannelError, buckets, rowsTouched, worstRow}`.

## Outils de `lib.mjs`

`launch()`, `measurePage()`, `gpuInfo()`, `machineLoad()`, `waitForQuiet()`, `pngFromRgba()`,
`captureSink()`, `save()`, et `fingerprints(scènes)` — empreinte SHA-256 du SDK et du cache de
clusters, qui lit le fichier de clusters entier : coûteux sur les grosses scènes.

Moteurs : `three-webgl-reference` (THREE.js basic), `three-lod` (THREE.js LOD),
`exact-cluster-pages` (WebGeometry WebGL), `webgpu-page-raster` (WebGeometry WebGPU), dans cet
ordre pour l'aller du protocole. Ne jamais lancer deux mesures de performance en même temps, ni
pendant `pnpm prepare:models`.
