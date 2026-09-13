# État actuel : incrément 2 physique

Le runner exécute désormais la hiérarchie procédurale, la sélection/rasterisation GPU et les pages physiques. Lire [CURRENT.md](docs/current.md) pour le contrat actuel, les scénarios réellement exécutés et leurs limites. Le texte ci-dessous conserve l’inventaire et le premier jalon, désormais historique.

# 15 — Intégration de géométrie virtualisée : état vérifiable

**Livraison initiale bornée : l'architecture complète reste bloquée.** Ce banc ne démontre pas une géométrie virtualisée fonctionnelle. Il fournit une matrice de dix scénarios explicitement non exécutés et un contrôle physique résident utile pour valider le contrat A/B et la métrologie avant assemblage des briques manquantes.

## Inventaire vérifié dans les sources 01–14

| Banc | Disponible | Limite pour l'intégration |
|---|---|---|
| 01 | `GpuDrivenRenderer`: frustum CPU/direct, GPU atomique, liste compacte, indirect, raster commun, readback IDs | Une géométrie partagée instanciée, pas des plages de clusters hétérogènes |
| 02 | Oracle CPU sphère/plans et shader; runner physique réutilisant 01 | Frustum d'instances, pas hiérarchie |
| 03 | Buffers de scène persistants et renderer GPU | Updates d'instances distincts du contrat pages/groupes |
| 04 | Meshoptimizer, sélection CPU/SSE, renderer natif avec sélection GPU, ranks/scatter, raster LOD | LOD d'objets; pas graphe de groupes de remplacement certifié; aucun certificat d'erreur de surface pour un asset virtualisé |
| 05 | `buildMeshlets`, partitions contiguës, bornes, indices source vérifiables | Pas simplificateur de groupes, hiérarchie, pages, ni raster de ces clusters |
| 06 | Oracle CPU conservateur; texte WGSL | Le runner mesure l'oracle CPU, pas un cluster renderer GPU assemblé |
| 07 | Pyramide CPU, oracle, WGSL réduction | Runner CPU; pas profondeur raster courante connectée à une pyramide GPU du banc 15 |
| 08 | Oracle d'occlusion CPU sur rectangles écran | Pas production physique des bornes/Hi-Z en deux passes |
| 09 | Oracles CPU + stratégies physiques serial/atomic/workgroup dans `shared/benchmark/compaction.ts` | Les sorties du microbanc ne forment pas une coupe de géométrie virtualisée |
| 10 | Palette, storage packing, plans de soumission | Pas shading multi-matériaux physique complet validé par ce runner |
| 11 | Cycle logique pages, générations, budget et fallback CPU | `completeUpload` comptabilise des octets, ne lit ni n'installe des pages GPU; pas éviction après fence physique |
| 12 | IDs, reconstruction perspective et oracles CPU, exemples WGSL | Pas pipeline visibilité/résolution physique complet dans le runner |
| 13 | `executeFullPipeline` inspecte des prérequis et renvoie des blocages | Ce n'est pas un renderer |
| 14 | Bistro réel entièrement résident, WebGL2, culling de quartiers et cache adaptatif, A/A/B | Pas streaming géographique ni pipeline GPU-driven/virtualisé |

Lecture de référence : [architecture et spécifications Web Geometry](../../webGeometry/docs/README.md), [recettes et résultats du Lab](../docs/CONTRATS_DONNEES_ET_TESTS.md) et [programme d’expériences](../docs/PLAN_EXPERIENCES_PERFORMANCE.md), puis contrats/runners/sources ci-dessus. Les exemples de documentation et les métriques logiques ne valent pas implémentation physique.

La brique indispensable manquante n'est pas un simple adaptateur : construire des représentations grossières avec frontières conservées, borner l'erreur, établir les groupes de remplacement, sélectionner une coupe complète et la rasteriser est un chantier distinct. Un faux arbre de feuilles à erreur zéro ne testerait pas cette architecture. Le banc conserve ces scénarios bloqués plutôt que fabriquer une preuve.

## Contrat commun sans nouvelle interface

`createIntegratedRunner('15-virtualized-integration')` depuis `bench/runners.ts`, ou factory typée `createVirtualizedIntegrationRunner()` pour accéder aux options supplémentaires et à `result.archive`.

Le contrat existant est conservé : `id`, `variants`, `run({canvas, device, samples, warmup, signal, onPhase, onProgress, onMetrics})`. Le canvas et le device sont **prêtés exclusivement** pendant `run`; aucun renderer concurrent ne doit utiliser ce canvas. Le runner restaure les dimensions et déconfigure le contexte; la coque doit le reconfigurer avant réutilisation. Le device fourni n'est jamais détruit par le runner. Le harness possède son propre device et le détruit.

Options supplémentaires : `control` pour seed/count/résolution/deadline, `runControl:false` pour obtenir seulement l'inventaire bloqué. Deux lancements simultanés sur la même instance sont refusés. La cancellation et les erreurs renvoient un résultat `not-run` avec archive, plutôt qu'une exception qui effacerait les preuves. Les options invalides sont rejetées avant allocation. Maximum : 4 blocs × 32 frames, 16 warmups par bloc, 4096 instances, 960×540, deadline 120 s. Valeurs par défaut plus petites. La deadline interrompt les attentes GPU/rAF; un appel synchrone du pilote ne peut être préempté par JavaScript.

**Attention au statut :** `result.status='measured'` signifie seulement que le **contrôle résident** a été mesuré. `archive.architectureStatus='blocked'` demeure indépendant. `gates.correctness` porte exclusivement sur ce contrôle. Les dix scénarios d'architecture ont tous `status='not-run'` et métriques nulles. La coque ne doit pas présenter les chiffres du contrôle comme des résultats de ces scénarios.

## Contrôle physique actuel

A : frustum CPU et dessins indexés directs. B : frustum GPU, compactage atomique et dessin indexé indirect. Réutilisation du renderer 01, même scène procédurale de sphères, mêmes transforms/couleurs/shader opaque, même résolution et même caméra rejouée par index. C'est une référence classique native WebGPU, pas une mesure du coût total d'un renderer Three.js.

Avant les mesures : pour **chaque pose**, capture A, répétition A, capture B; comparaison exacte RGBA8, maximum, RMSE, pixels différents et hashes SHA-256; comparaison des listes d'IDs avec un oracle frustum Three indépendant du shader. Refus d'une image uniforme. Un échec conserve les contrôles et ne publie aucun temps comparatif.

Mesure ABBA, échauffement hors fenêtre, attente rAF entre frames. Aucun readback dans les frames chronométrées. CPU caméra+frame et encodage/soumission séparés. Timestamps A limités au raster; B couvre reset/culling jusqu'à fin raster. Le contrôle d'enveloppe refuse une durée GPU négative/non finie ou supérieure à la fenêtre murale englobante. Les zéros de résolution restent marqués par `timestampQuality`. GPU absent : null. Les intervalles rAF, percentiles nearest-rank et saccades >50 ms ne représentent pas la présentation physique à l'écran. Pas de ratio de gain ni verdict d'adoption.

Compteurs : les draw calls viennent des appels renderer. Les triangles soumis sont **dérivés** de la visibilité lue pendant le replay et du nombre réel d'indices; ce n'est pas un compteur matériel. Les clusters, RAM, VRAM, cache hits/misses, octets lus, chargement et décodage restent nulls. Le contrôle n'utilise pas de chargeur. Préparation CPU et préparation ressources+drain GPU sont séparées. `firstGpuCompleteMs` mesure la première frame GPU terminée; le temps de première présentation reste inconnu.

## Scénarios et suite nécessaire

`scenarios/protocol.ts` contient les dix cases : ville dense, intérieur occulté, transition, caméra rapide, proche/lointain, objets dynamiques, végétation/transparence, streaming sous pression, visibilité brutale, budgets réduits. Chaque case porte la dépendance manquante. Le contrôle résident ne remplace aucune de ces scènes représentatives.

Pour rendre une case exécutable : fournir le même asset immuable aux deux chemins, sélectionner/rasteriser une coupe avec les briques existantes, instrumenter les événements réels du loader, puis connecter son exécuteur au runner avec les mêmes phases/annulation/archives. Commencer entièrement résident et opaque. Les pages physiques, la végétation et l'occlusion ont des gates supplémentaires; aucun drapeau de capacité ne doit suffire à les déclarer prêtes. Les petites machines exigent une machine effectivement testée, pas seulement moins d'instances sur M2 Max.

## Vérification et archives

- `npm run test:integration` : protocole, déterminisme, mesures absentes et annulation.
- `node --experimental-strip-types --test bench/integratedRunners.test.ts` : contrat commun.
- `npm run bench:15` : build puis smoke physique seulement, quatre passages (timestamps, sans timestamps, annulation verify, annulation measure).

Le smoke archive dans `benchmark-runs/checks/15-<date>-<uuid>/raw.json` : configuration, navigateur/GPU physique, sources texte et hashes avant/après, données brutes, contrôles, erreurs et blocages. Une absence de GPU ou un échec du serveur est également archivé. Rien n'écrase `latest.json`. Il n'existe pas de longue campagne automatique dans cette livraison.

Résultat local corrigé du 12 septembre 2026 : TypeScript/build, 14 tests ciblés et smoke sur Apple M2 Max réussis. Dernier smoke runtime : `15-2026-09-12T10-39-42.398Z-7c74ce68-f2c1-4d12-9d19-27d599493923` (inclut conservation des blocs partiels). Les corrections de types suivantes produisent les mêmes bundles. L'archive précédente `15-2026-09-12T10-31-55.654Z-d771fb05-d7e5-4e9c-a336-0a522c207726` est invalidée par son `REVIEW.md` : timestamps d'une passe compute vide sur A. **Aucun verdict général de performance.**

Voir [models.md](docs/models.md) pour le catalogue de modèles et les conditions de conversion.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.

## Explorateur de modèles dans le Lab

Le sélecteur de configuration distingue la fixture procédurale et les modèles préparés. Au repos, seuls le pointeur et les métadonnées du cache sont vérifiés ; aucun canvas ni chargement de géométrie/textures n’est créé avant le lancement explicite. Le passage à la première image exige des pixels distincts du fond et des dimensions visibles non nulles.

L’étendue 1 / 4 / 9 / 12 modèles est transmise au SDK via `replicaCount`. `prepare:models` écrit les caches QEM de tous les modèles ; l’explorateur coupe l’arbre LOD avec `pixelError` (défaut 1 px, 0 = exact seulement). « Détails maximum » conserve toute la géométrie et les textures source et demande l’anisotropie maximale disponible. Ces réglages sont figés pendant une exécution. Le Lab appelle `createExplorer` de `@web-geometry/sdk/browser`.

Les vues texturée et filaire utilisent le moteur A choisi. `webgpu-page-raster` consomme `createGpuPageCache` ; sur le parcours urbain son absence interrompt la campagne. Les diagnostics clusters et pages utilisent les feuilles exactes (ou le raster WebGPU s’il est le moteur A). Les transparences partagées conservent leurs matériaux. Un dépassement du budget de pages interrompt le diagnostic au lieu de dessiner une surface incomplète.

Le parcours v5 rejoue dix segments avec quatre moteurs : THREE.js basic, THREE.js LOD, WebGeometry WebGL et WebGeometry WebGPU. Chacun reçoit 60 poses par segment après 30 images de préchauffage et le préchargement requis aux checkpoints. Il est déterministe ; les rues et zones de végétation ne sont pas encore calibrées. Les rapports vont dans `localStorage` et `benchmark-runs/checks/model-path/`. Les captures peuvent affecter l’intervalle rAF suivant et ne prouvent aucune fidélité A/B. CPU et rAF ont des distributions séparées ; GPU et VRAM restent non mesurés.

Les cinq dernières exécutions sont conservées dans le navigateur. « Relancer » reprend la configuration du rapport ; « Nouvelle exécution » revient à la fiche au repos ; le rapport reste consultable et exportable. La comparaison mesurée reste indisponible tant que la pipeline B complète manque et que le contrôle A/A reste instable.

Recettes Chrome sur le serveur local :

```sh
node test/modelAvailability.browser.mjs
node test/modelPixels.browser.mjs
node test/modelWorkbench.browser.mjs
```

Les captures et contrôles de ces recettes restent dans `benchmark-runs/checks/`. Ils attestent le fonctionnement observé, sans promouvoir de résultat de performance.
