# Base de développement — géométrie virtualisée

Cette documentation définit un sous-système de préparation et de rendu de géométrie pour le laboratoire, puis pour une intégration Three.js/Electron. Elle contient les explications, calculs, contrats, exemples et tests en Markdown. Aucun document de référence extérieur ni ancien fichier d'implémentation n'est nécessaire à sa lecture.

Les exemples sont des algorithmes pédagogiques, pas un moteur livré et compilable. Les variantes de performance doivent être mesurées. Une propriété mathématique, une décision de conception et une fonctionnalité testée sont trois choses différentes.

**Acceptation des optimisations :** un remplacement exige une preuve comparative de gain net, de fluidité et de conservation des fonctionnalités et de l'image sur le domaine annoncé. Une équivalence algébrique ou un microbenchmark positif ne suffit pas. La [campagne comparative du 11 septembre 2026](PREUVES_COMPARATIVES_OPTIMISATION.md) mesure deux variantes et conserve les données et sources reproductibles ; aucune ne satisfait encore l'ensemble de ces conditions. Les calculs de référence restent en vigueur.

**Bancs visuels du projet :** le [comparatif LOD sur scène détaillée](../04-gpu-lod/comparison.html) dispose de [douze campagnes documentées](preuves/2026-09-11-scene-projet.md). Le [banc 14 — monde ouvert sous pression](../14-open-world/README.md) utilise le décor réel Bistro et conserve séparément les images contrôlées, la géométrie soumise, les résolutions et les rapports A/B. Ces expériences n'accordent aucune certification globale automatique.

## Parcours de lecture

| Étape | Document | Ce qu'il apporte |
|---|---|---|
| 1 | [Architecture](ARCHITECTURE_GEOMETRIE.md) | périmètre, responsabilités, flux et première implémentation |
| 2 | [Préparation des meshes](PREPARATION_DES_MESHES.md) | validation, voisinage, clusters, réduction, hiérarchie et encodage |
| 3 | [Calculs essentiels](CALCULS_ESSENTIELS.md) | équations, unités, hypothèses, exemples numériques et pistes d'optimisation |
| 4 | [Algorithmes de base](ALGORITHMES_DE_BASE.md) | pseudocode court des opérations fondamentales |
| 5 | [Rendu et sélection](RENDU_ET_SELECTION.md) | coupe LOD, culling, Hi-Z, compaction, raster et interpolation |
| 6 | [Pages et mémoire](PAGES_MEMOIRE_ET_CACHE.md) | formats, chargement, publication, versions, budgets et récupération |
| 7 | [Matériaux et extensions](MATERIAUX_ET_EXTENSIONS.md) | shading, animation, subdivision, voxels, rayons et limites de chaque chemin |
| 8 | [Intégration Three.js/Electron](INTEGRATION_THREEJS_ELECTRON.md) | plugin, replis, identité, passes et cycle de vie |
| 9 | [Choix technologiques](CHOIX_TECHNOLOGIQUES.md) | langage, workers, processus, WASM et protocole de comparaison |
| 10 | [Contrats et tests](CONTRATS_DONNEES_ET_TESTS.md) | entrée/sortie, données GPU, fixtures et bancs 00 à 13 |
| 11 | [Expériences de performance](PLAN_EXPERIENCES_PERFORMANCE.md) | expériences indépendantes, métriques et critères de décision |
| 12 | [Oracles exécutables](ORACLES_ET_TESTS.md) | fonctions Python autonomes et tests mathématiques intégrés |
| 13 | [Schémas et dérivées](SCHEMAS_ET_DERIVEES.md) | représentation des transitions et propagation des gradients |
| 14 | [Construction et compression avancées](CONSTRUCTION_ET_COMPRESSION_AVANCEES.md) | partition pondérée, QEM multiattribut, prédiction, strips, palettes et découverte des pages |
| 15 | [Projection, profondeur et couleur](PROJECTION_PROFONDEUR_ET_COULEUR.md) | sphères projetées, reconstruction, précision, atlas et matériau commun |
| 16 | [Stratégies avancées](STRATEGIES_AVANCEES.md) | imposteurs, groupes d'instances, files GPU, ombres paginées et raccords entre assets |
| 17 | [Assemblages et procédural](ASSEMBLAGES_ET_PROCEDURAL.md) | prototypes, transforms, masques, matériaux, squelettes, terrain et tâches asynchrones |
| 18 | [Déformation, cellules et courbes](DEFORMATION_CELLULES_ET_COURBES.md) | déplacement borné, BVH, voxelisation, échantillonnage, SGGX et fibres |
| 19 | [Pipeline GPU et extensions](PIPELINE_GPU_ET_EXTENSIONS.md) | capacités, couverture, départage, shading, streaming, rayons, tessellation et opacité |
| 20 | [Validation documentaire](VALIDATION_DOCUMENTAIRE.md) | comparaison des supports, couverture, exclusions et preuves d'autonomie |
| 21 | [Preuves comparatives d'optimisation](PREUVES_COMPARATIVES_OPTIMISATION.md) | résultats A/B, limites, décisions et reproduction des mesures |

## Exemples complémentaires

- [Pages et cache](annexes/pages-et-cache.md).
- [Attributs et compression](annexes/attributs-et-compression.md).
- [Subdivision et déformation](annexes/subdivision-et-deformation.md).
- [Matériaux et vues](annexes/materiaux-et-vues.md).

Les annexes contiennent uniquement des exemples thématiques, sans commentaires dans les blocs. Les explications et hypothèses sont dans les chapitres. Les fonctions mathématiques usuelles, tableaux, ensembles, tris et opérations de graphe sont notés en pseudocode indépendant du langage.

## Règles de développement

Commencer par meshes statiques opaques, assets résidents, sélection CPU et raster matériel. Ajouter une optimisation à la fois, en gardant cette référence. Aucun nom de langage ne garantit un gain ; aucune simplification ne doit cacher des triangles manquants, des coutures cassées ou une mémoire dépassée.

Les fichiers proposés à l'exécution des oracles sont temporaires et sont générés depuis le Markdown. Les futures dépendances logicielles et outils de compilation devront être installés au moment du développement ; « documentation autonome » ne signifie pas « programme exécutable sans environnement ».

La comparaison documentaire couvre les familles mathématiques et stratégiques du socle et des extensions identifiées dans les supports étudiés. Leurs formules, domaines, invariants, replis et recettes sont conservés ici, sans dépendance à ces supports. Le format final des sections, les budgets et les points d'intégration sont des choix de notre développement, à figer avant les étapes correspondantes. Le bilan distingue cette autonomie d'une implémentation terminée ou de la reproduction exacte d'un autre moteur.
