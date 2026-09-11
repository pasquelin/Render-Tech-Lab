# Scène procédurale du projet : douze campagnes du 11 septembre 2026

Ces douze campagnes comparent la sélection CPU historique « Référence 04B » au candidat `prepared` (« Tangente partagée »), dans une scène réellement rendue avec Three.js 0.174 et WebGL2. Elles montrent une réduction locale du temps de sélection dans les conditions ci-dessous. **Elles ne certifient aucun gain de fluidité, aucune performance sur petite machine, ni une parité générale de l’image finale.** Elles concernent la scène procédurale 04, distincte de la fixture Bistro du banc 14.

## Conditions et méthode

Machine enregistrée : **Apple M2 Max, 12 processeurs logiques, 103 079 215 104 octets de mémoire physique (96 Gio)** ; macOS/Darwin 25.6.0 arm64, Node v26.8.2 pour la provenance, Chrome 152, ANGLE Metal Apple M2 Max. Ce matériel ne représente pas un petit portable. Le navigateur était visible et signalait un ratio écran de 2, mais le ratio de rendu fixé à **1** donne exactement les dimensions physiques du tableau.

Six configurations : 2 000 ou 20 000 objets, en 1920×1080, 2560×1440 et 3840×2160, avec deux campagnes par configuration. Chaque campagne exécute quatre blocs **A–B–B–A**, chacun après 60 frames d’échauffement puis 180 frames mesurées : **48 blocs et 8 640 frames mesurées** au total. Les contrôles de trajectoire et de pixels sont effectués hors chronométrage. Graine 42, ombres activées, trois lumières dont une avec shadow map 2048×2048, deux matériaux, FOV 60°.

La fixture est une grille dense de nœuds de tore avec un premier plan détaillé. Les trois niveaux contiennent 12 288, 3 072 et 768 triangles. Le total théorique au niveau le plus fin (24,576 ou 245,76 millions de triangles) n’est pas la charge réellement soumise : celle-ci figure séparément dans le tableau. L’algorithme historique choisit selon la taille radiale projetée ; la tangente partagée conserve cette expression et ne corrige pas son approximation géométrique.

## Résultats comparables

Toutes les durées sont en millisecondes, arrondies à trois décimales. Chaque plage est le **minimum–maximum des p50 des quatre blocs de la variante** disponibles pour la configuration (deux blocs par campagne, deux campagnes). Ce ne sont ni des minima/maxima de frames ni un intervalle de confiance. Les quantiles archivés utilisent l’élément d’indice `floor((N−1)×p)` après tri, et non une moyenne des deux éléments centraux.

| Objets | Pixels physiques | Sélection CPU A, p50 des blocs | Sélection CPU B, p50 des blocs | rAF p50 A et B | Triangles passe principale | Triangles ombres |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 2 000 | 1920×1080 | 0.100–0.100 | 0.000–0.000 | 8.300 | 1 549 826 | 1 549 824 |
| 2 000 | 2560×1440 | 0.000–0.100 | 0.000–0.000 | 8.300 | 1 549 826 | 1 549 824 |
| 2 000 | 3840×2160 | 0.100–0.100 | 0.000–0.100 | 8.300 | 1 552 130 | 1 552 128 |
| 20 000 | 1920×1080 | 0.800–1.000 | 0.400–0.600 | 8.300 | 15 373 826 | 15 373 824 |
| 20 000 | 2560×1440 | 0.700–1.000 | 0.200–0.500 | 8.300 | 15 373 826 | 15 373 824 |
| 20 000 | 3840×2160 | 0.800–0.800 | 0.500–0.600 | 8.300 | 15 376 130 | 15 376 128 |

Tous les échantillons enregistrent **7 dessins** : 4 pour la passe principale et 3 pour les ombres. Additionner les triangles de ces passes décrit du travail de rendu répété, pas des triangles uniques dans l’asset. Tous les objets sont sélectionnés et soumis ; l’intersection avec le frustum ne prouve pas que chaque surface est visible malgré les occlusions.

Les zéros de sélection ne signifient pas un calcul gratuit. Les mesures sont fortement quantifiées autour de 0,1 ms ; les moyennes de blocs conservent une information différente du p50 :

| Objets | Résolution | Moyenne CPU sélection A, plage entre blocs | Moyenne CPU sélection B, plage entre blocs |
| ---: | --- | ---: | ---: |
| 2 000 | 1920×1080 | 0.064–0.075 | 0.036–0.042 |
| 2 000 | 2560×1440 | 0.051–0.074 | 0.034–0.042 |
| 2 000 | 3840×2160 | 0.054–0.072 | 0.037–0.053 |
| 20 000 | 1920×1080 | 0.796–0.998 | 0.423–0.614 |
| 20 000 | 2560×1440 | 0.677–0.953 | 0.291–0.541 |
| 20 000 | 3840×2160 | 0.803–0.896 | 0.528–0.612 |

Ces moyennes sont descriptives ; les frames successives sont corrélées et ne constituent pas autant de répétitions indépendantes. Le contrebalancement A–B–B–A et l’échauffement limitent certains effets d’ordre, sans isoler les caches, le JIT, le ramasse-miettes, les fréquences CPU/GPU ou l’état thermique. Aucune mesure de ces états n’est archivée.

Le **p50 rAF reste à 8,3 ms dans les 48 blocs**. Il mesure la cadence des callbacks, pas la présentation physique des images. Le temps CPU de frame inclut sélection, application des matrices et soumission au rendu ; il ne mesure pas l’achèvement GPU. Les requêtes GPU disponibles mesurent séparément le rendu soumis, ombres comprises. Leurs distributions et les queues p95/p99 restent dans les archives : aucune réduction du seul sélecteur ne suffit à conclure que la scène s’affiche plus vite. Le banc instrumente aussi les transferts WebGL et conserve les tableaux de sélection pour les hacher après chaque bloc ; cette instrumentation touche les deux variantes, sans témoin non instrumenté.

## Identités, dessins et portée des captures

Dans les douze archives, `quality.passed`, `measuredFrameIdsMatch` et `correspondingDrawCountsMatch` sont vrais. Les 180 positions de trajectoire sont contrôlées par campagne et les identifiants LOD de chaque frame mesurée sont confrontés à la référence. Les compteurs de dessins correspondants concordent.

Pour les positions 0, 90 et 179, le banc effectue une référence puis les comparaisons A/A et A/B : **36 cadrages, 72 comparaisons archivées, 108 lectures de pixels** sur douze campagnes. Toutes ces comparaisons indiquent zéro pixel différent et zéro erreur de canal.

**Limite de ces douze campagnes : les pixels sont lus dans une `WebGLRenderTarget` linéaire hors écran, pas dans l’image finale du canvas après ACES et conversion d’affichage.** Le pipeline de contrôle archivé ne capture donc pas la sortie finale présentée à l’utilisateur. L’égalité constatée porte sur cette cible hors écran aux trois cadrages contrôlés ; elle n’est pas une certification de l’image finale ni de toutes les frames. Une correction du contrôle pour les prochains runs ne change pas rétroactivement la portée de ces douze archives.

## Provenance et disponibilité des sources

Le commit enregistré est `8425a625878e0e0ae4e1696e5771d77994840dfd`. Dans chacune des douze campagnes, les cartes `sourceHashes` avant/après sont strictement identiques, conformément à `sourcesStable: true`. Les empreintes du sélecteur, des mathématiques, du générateur, du candidat et de la scène sont aussi identiques entre les douze campagnes. L’empreinte du moteur de comparaison est `8741c15b7b7ccd85e2ac992ce61b7ef67fc44f0bb79e3eb62280ca17414c421a`.

Le plugin d’archivage a toutefois évolué **entre** les campagnes à 2 000 et à 20 000 objets : son empreinte passe de `80e351931a3494080debd823b9db350f0dc22671be016945b3b4f16fe006c3a2` à `0173f3e45f26addcdc9a0fe84e19e46a02a576fc0e5ede0f10d6247ad5174658`. Les six dernières campagnes ajoutent les empreintes de `package.json` et `pnpm-lock.yaml`, absentes des six premières.

Ces archives contiennent les résultats et des empreintes, **pas des snapshots des fichiers sources exécutés**. Un hash identifie un contenu, mais ne permet pas de le reconstruire. La stabilité avant/après ne garantit donc pas à elle seule la disponibilité durable du code exact, ni celle de tout l’environnement. Les JSON et rapports Markdown ci-dessous sont les preuves brutes conservées ; ils ne doivent pas être réécrits avec les conclusions d’un run ultérieur.

## Index des douze campagnes

Les dates indiquées sont celles du champ `timestamp`, en UTC ; l’identifiant du fichier correspond à son archivage quelques secondes plus tard. La répétition est numérotée chronologiquement dans chaque configuration.

| Date UTC de démarrage | Configuration | Répétition | Identifiant exact | Archives |
| --- | --- | ---: | --- | --- |
| 2026-09-11T21:27:57.453Z | 2 000 · 1920×1080 | 1 | `20260911T212805989Z-c198f667-4fe8-47a2-b14d-b71d2b0258a7` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212805989Z-c198f667-4fe8-47a2-b14d-b71d2b0258a7.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212805989Z-c198f667-4fe8-47a2-b14d-b71d2b0258a7.md) |
| 2026-09-11T21:28:06.020Z | 2 000 · 2560×1440 | 1 | `20260911T212814654Z-3fc2fb7c-5d35-4a6c-81d4-93eca9ae838f` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212814654Z-3fc2fb7c-5d35-4a6c-81d4-93eca9ae838f.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212814654Z-3fc2fb7c-5d35-4a6c-81d4-93eca9ae838f.md) |
| 2026-09-11T21:28:14.688Z | 2 000 · 3840×2160 | 1 | `20260911T212823611Z-34d11bb4-cf12-45f9-b721-484b68d36e5b` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212823611Z-34d11bb4-cf12-45f9-b721-484b68d36e5b.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212823611Z-34d11bb4-cf12-45f9-b721-484b68d36e5b.md) |
| 2026-09-11T21:28:23.641Z | 2 000 · 1920×1080 | 2 | `20260911T212832028Z-09428bbc-a042-4dfb-bec6-6ff1094f7fef` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212832028Z-09428bbc-a042-4dfb-bec6-6ff1094f7fef.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212832028Z-09428bbc-a042-4dfb-bec6-6ff1094f7fef.md) |
| 2026-09-11T21:28:32.057Z | 2 000 · 2560×1440 | 2 | `20260911T212840560Z-320f7f1a-a3e4-4949-bda8-8e63a96fda5a` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212840560Z-320f7f1a-a3e4-4949-bda8-8e63a96fda5a.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212840560Z-320f7f1a-a3e4-4949-bda8-8e63a96fda5a.md) |
| 2026-09-11T21:28:40.595Z | 2 000 · 3840×2160 | 2 | `20260911T212849461Z-43a21695-9c6c-4b86-9fff-901e11a83e8d` | [JSON](../../04-gpu-lod/results/comparisons/20260911T212849461Z-43a21695-9c6c-4b86-9fff-901e11a83e8d.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T212849461Z-43a21695-9c6c-4b86-9fff-901e11a83e8d.md) |
| 2026-09-11T21:30:46.784Z | 20 000 · 1920×1080 | 1 | `20260911T213055493Z-36831e3a-98b5-45fd-adfd-da009cd426d9` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213055493Z-36831e3a-98b5-45fd-adfd-da009cd426d9.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213055493Z-36831e3a-98b5-45fd-adfd-da009cd426d9.md) |
| 2026-09-11T21:30:55.525Z | 20 000 · 2560×1440 | 1 | `20260911T213104348Z-9b74b392-d734-4590-8677-058c4821af1b` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213104348Z-9b74b392-d734-4590-8677-058c4821af1b.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213104348Z-9b74b392-d734-4590-8677-058c4821af1b.md) |
| 2026-09-11T21:31:04.390Z | 20 000 · 3840×2160 | 1 | `20260911T213113437Z-5d757d6b-8350-443d-8312-95920b9972f6` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213113437Z-5d757d6b-8350-443d-8312-95920b9972f6.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213113437Z-5d757d6b-8350-443d-8312-95920b9972f6.md) |
| 2026-09-11T21:31:13.478Z | 20 000 · 1920×1080 | 2 | `20260911T213122099Z-029997e9-4b3a-4b9e-9429-278fa2af58c6` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213122099Z-029997e9-4b3a-4b9e-9429-278fa2af58c6.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213122099Z-029997e9-4b3a-4b9e-9429-278fa2af58c6.md) |
| 2026-09-11T21:31:22.141Z | 20 000 · 2560×1440 | 2 | `20260911T213130878Z-594ffcb5-388b-4cc4-bfbb-d7ecb887a312` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213130878Z-594ffcb5-388b-4cc4-bfbb-d7ecb887a312.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213130878Z-594ffcb5-388b-4cc4-bfbb-d7ecb887a312.md) |
| 2026-09-11T21:31:30.922Z | 20 000 · 3840×2160 | 2 | `20260911T213139984Z-8f5da3d8-1922-4d1b-bdf2-d308aacbca15` | [JSON](../../04-gpu-lod/results/comparisons/20260911T213139984Z-8f5da3d8-1922-4d1b-bdf2-d308aacbca15.json) · [Markdown](../../04-gpu-lod/results/comparisons/20260911T213139984Z-8f5da3d8-1922-4d1b-bdf2-d308aacbca15.md) |
