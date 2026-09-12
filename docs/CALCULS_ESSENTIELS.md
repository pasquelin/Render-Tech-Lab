# Les calculs qui font fonctionner le système — laboratoire

Partie laboratoire : protocoles, recettes ou suivi documentaire. La conception du produit est conservée dans [Web Geometry](../../webGeometry/docs/mathematiques/CALCULS_ESSENTIELS.md). Les numéros historiques des sections sont conservés.

## 1. Carte des calculs et des bancs

| ID | Calcul / algorithme | Fonction dans le système | Quand | Banc |
|---|---|---|---|---|
| M01 | Triangles, adjacence et partition | Construire des clusters compacts | Import | 05 |
| M02 | Quadriques et contraction d'arêtes | Réduire la géométrie avec une erreur contrôlée | Import | 04A / 05 |
| M03 | Regroupement, frontières et DAG | Changer de détail sans fissures | Import | 05 / 06 |
| M04 | Erreur cumulative et bornes | Donner un sens cohérent au LOD | Import | 04 / 05 |
| M05 | Transformations et projection de l'erreur | Convertir une erreur objet en pixels | Image / vue | 04B |
| M06 | Coupe LOD | Dessiner chaque région exactement une fois | Image / vue | 04 / 06 |
| M07 | Frustum et cônes | Rejeter les régions sûrement invisibles | Image / vue | 02 / 06 |
| M08 | Pyramide Hi-Z et profondeur | Rejeter les régions sûrement cachées | Image / vue | 07 / 08 |
| M09 | Scan et compaction | Produire des listes GPU denses | Image | 09 |
| M10 | Commandes indirectes et binning | Soumettre ces listes par état compatible | Image | 01 / 10 |
| M11 | Rasterisation et visibilité | Déterminer le triangle visible par pixel | Image / vue | 12 |
| M12 | Interpolation et dérivées | Reconstruire les attributs et filtrer les textures | Pixel visible | 12 |
| M13 | Quantification et décodage | Réduire stockage et bande passante | Import / GPU | 05 / 11 |
| M14 | Résidence et priorité des pages | Garder une coupe complète sous budget RAM/VRAM | Continu | 11 |
| M15 | Modèle de coût et statistiques | Prouver un gain sans masquer une régression | Benchmark | 00–13 |

Lectures liées : [préparation des meshes](../../webGeometry/docs/compilation/PREPARATION_DES_MESHES.md), [rendu et sélection](../../webGeometry/docs/runtime/RENDU_ET_SELECTION.md), [contrats et recettes](../../webGeometry/docs/compilation/CONTRATS_DONNEES_ET_TESTS.md), [oracle exécutable](../../webGeometry/docs/mathematiques/ORACLES_ET_TESTS.md).

## 17. M15 — Ce qui prouve une optimisation

```text
gain = (time_reference - time_candidate) / time_reference
speedup = time_reference / time_candidate
Amdahl = 1 / ((1-fraction_accelerated) + fraction_accelerated/local_speedup)
```

Accélérer de 4× un calcul qui prend 10 % du temps total donne au mieux `1/(0.9+0.1/4)≈1.081×`, soit environ 7.5 % de temps gagné. Diminuer de moitié le temps d'un kernel ne garantit pas de FPS supplémentaires si le CPU, les uploads ou une autre passe limitent l'image.

Pour un import, mesurer fin à fin et par étape. Pour le rendu pipeliné, temps CPU et GPU peuvent se chevaucher : ne pas additionner aveuglément leurs mesures. Les synchronisations peuvent en revanche supprimer le chevauchement. Déclarer le point de début/fin de chaque métrique.

**Expériences isolées :** mêmes assets compilés et mêmes caméras pour les variantes runtime; mêmes algorithmes, précision et critères qualité pour comparer les langages. Conserver source/compilateur/config hashes, tailles, seed, versions, résolution et état thermique. Alterner les variantes pour limiter le biais d'échauffement.

Mesurer p50, p95 et p99 de frametime avec assez d'échantillons; ne pas moyenner les FPS. Séparer démarrage à froid, compilation de shaders, warmup, mesure stable et effets GC. Le readback de validation est hors de la fenêtre de performance, sauf s'il fait réellement partie du produit.

**Priorité d'optimisation :** volume de travail → disposition mémoire/transferts → parallélisme borné → détails arithmétiques. Les variantes `f32`, `f64`, `f16`, SIMD et subgroups doivent repasser la recette numérique. Un résultat plus rapide qui casse une frontière, une coupe ou le picking ne valide pas le système.

**Condition d'adoption pour ce projet :** les preuves de gain net, de fluidité, de correction et de conservation du rendu sont cumulatives. Un critère non mesuré reste non acquis. Le [registre comparatif](PREUVES_COMPARATIVES_OPTIMISATION.md) distingue explicitement le gain d'une fonction CPU et celui d'une scène ; il ne contient actuellement aucun remplacement validé de ces calculs.

## 18. Programme de travail mathématique

1. Exécuter [l'oracle numérique](../../webGeometry/docs/mathematiques/ORACLES_ET_TESTS.md) : ce sont des exemples vérifiables et des contre-exemples aux formules trop simples.
2. Fixer les conventions et le type de chaque erreur dans les assets.
3. Implémenter une référence CPU indépendante pour le build et la sélection.
4. Mesurer qualité des frontières, erreur géométrique et rendu avec les fixtures adversariales.
5. Porter vers Rust/WASM puis GPU, fonction par fonction, en confrontant les sorties à la référence.
6. Exécuter les bancs isolés puis la comparaison de scène ; intégrer seulement les variantes qui satisfont toutes les conditions d'adoption de M15 sur le matériel et les fonctionnalités annoncés.

Les exemples courts sont développés dans [les algorithmes de base](../../webGeometry/docs/mathematiques/ALGORITHMES_DE_BASE.md). Les calculs numériques exécutables et leurs tests sont intégrés dans [les oracles](../../webGeometry/docs/mathematiques/ORACLES_ET_TESTS.md).
