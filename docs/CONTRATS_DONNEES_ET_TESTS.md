# Contrats d'implémentation et programme de tests — laboratoire

Partie laboratoire : protocoles, recettes ou suivi documentaire. La conception du produit est conservée dans [Web Geometry](../../webGeometry/docs/compilation/CONTRATS_DONNEES_ET_TESTS.md). Les numéros historiques des sections sont conservés.

## 7. Recette des bancs 00 à 13, plus le banc 14

| Banc | Référence | Candidat / question | Correctness gate | Mesures |
|---|---|---|---|---|
| 00 baseline | scène Three standard | coût sans système | scène/hash/caméra identiques | CPU, GPU, p95, mémoire |
| 01 indirect | dessins directs mêmes primitives | commandes indirectes | mêmes indices et image | encodage CPU, GPU, appels |
| 02 frustum | test CPU indépendant | culling GPU | zéro faux rejet, limites | candidats, visibles, temps |
| 03 scène GPU | transforms CPU | données d'instances persistantes | identités, matrices, updates | coût update et upload |
| 04A build LOD | géométrie originale | simplification hors image | contours, erreur, attributs | import, pic RAM, taille |
| 04B choix LOD | coupe CPU | sélection GPU même asset | coupe valide, seuil/near | CPU/GPU, stabilité |
| 05 meshlets | triangles sans clusters | 64/128/256/512 tris en variantes compatibles | couverture, budgets sommet | duplication, bounds, raster |
| 06 cluster culling | sans culling puis CPU | frustum; cônes facultatifs | zéro faux rejet | travail évité et coût ajouté |
| 07 Hi-Z | pyramid CPU | réduction GPU | fond, NPOT, conventions | ms/mégapixel, octets |
| 08 occlusion | image sans occlusion | deux passes courantes/temporal | désoccultation sans trous | temps net par taux d'occlusion |
| 09 compaction | filtre CPU | atomiques / scans | comptes, ensembles, ordre requis | N, densité, contention |
| 10 matériaux | même shading direct | bins/tri | image et états identiques | changement pipeline, CPU/GPU |
| 11 streaming | tout résident | budget pages | fallback complet, generations | défauts, gaspillage, RAM/VRAM |
| 12 visibilité | shading classique | IDs + reconstruction | depth, IDs, gradients, textures | visibilité et shading séparés |
| 13 intégration | baseline 00 comparable | assemblage candidat | tous gates + produit | gain net, qualité, stabilité |
| 14 monde ouvert | frustum Three.js, Bistro résident | quartiers, caches, culling adaptatif | pixels A/A et A/B, oracle `intersectsObject` | CPU, GPU, rAF, triangles soumis |

64/128/256/512 sont des variantes expérimentales de taille, pas des plafonds universels. Une variation du plafond de triangles exige de réexaminer plafond sommets, workgroups et record format.

Aucun statut hérité `validé` ne remplace une exécution actuelle sur la même scène et configuration. Chaque campagne doit produire ses propres résultats sur la configuration testée.

## 8. Fixtures à construire

| Famille | Cas utiles | Défaut recherché |
|---|---|---|
| Géométrie simple | triangle, plan, cube, sphère | signes, winding, métriques |
| Frontières | grille avec trou, deux groupes voisins | fissures de simplification |
| Attributs | cube hard-edge, couture UV, UV miroir | normales/tangentes/coutures |
| Dégénérescences | faces nulles, doublons, NaN import | validations et arrêt |
| Topologie | non manifold, composantes isolées | contraction invalide |
| Échelle | très petit/grand, réflexion, cisaillement | borne et précision |
| Vue | hors axe, near plane, inside bounds, ortho | projection incorrecte |
| Hi-Z | fond isolé, grille perforée, NPOT 3×3/5×7 | faux rejet conservatif |
| Temporalité | téléportation, objet cachant en mouvement | historique obsolète |
| Capacité | 0,1,31,32,33,63,64,65 et saturation | bords de workgroup |
| Matériaux | opaque, alpha cutout, double face | culling incohérent |
| Streaming | dépendance absente, latence, annulation | trou et stale handle |
| Produit | sélection, ombres, capture, reload | intégration incomplète |

Les fixtures de qualité doivent inclure des petits détails de silhouette. Une RMSE moyenne peut masquer un trou rare mais très visible. Ajouter maximum, percentiles de distance, compte de pixels manquants et inspection de trajectoires déterministes.

## 9. Contrat des résultats

Un résultat comprend : `status`, `caseId`, `variantId`, `assetHash`, `compilerHash`, `config`, `seed`, `environment`, `warmup`, `sampleCount`, `metrics`, `correctness`, `verdict`.

Avant exécution : `status="not-run"`, `metrics=null`, `verdict=null`. Ne pas utiliser zéro comme temps inconnu ni WATCHLIST pour dissimuler l'absence de mesure. Après échec de correction : `status="failed-correctness"`; un gain de temps ne valide pas le candidat.

Un benchmark comparant deux algorithmes donne leurs paramètres de qualité et leurs sorties géométriques. Un benchmark de langues garde le même algorithme, backend et précision. Un benchmark du rendu garde le même asset compilé afin de ne pas attribuer au runtime un gain de simplification.

Les scripts de préparation peuvent produire une matrice de jobs à exécuter plus tard. Ils ne doivent pas remplir de chiffres à partir d'une estimation.

### Paquet de rapport commun

Chaque nouvelle exécution des bancs 00–15 écrit un paquet unique dans `reports/<banc>/campaign-<uuid>/`. Il contient `REPORT.md` pour la lecture humaine, `objects/manifest.json` et `objects/result.json.gz` pour la charge exhaustive, `logs/engine-events.jsonl` pour les événements moteur et `media/` pour les images dédupliquées. Le manifeste porte la version `report-package/v1`, les chemins, tailles et empreintes ; le JSON compressé conserve les valeurs indisponibles et les données brutes sans les afficher dans le Markdown.

Les copies `results/REPORT.md` et `reports/<banc>.md` restent des entrées de compatibilité vers le résumé courant. Elles ne sont jamais une seconde archive de données. Les liens du Markdown sont relatifs dans le dossier et la fenêtre du Lab les résout sur le même paquet, sans traversée de chemin.

## 10. Ordre d'implémentation et livrables attendus

1. Conventions + fonctions de référence + fixtures. Sortie : oracles exécutables et cas de défaut reproduits.
2. Compilateur minimal : clusters et LOD, tout résident, aucun streaming. Sortie : asset versionné et validateur.
3. Viewer CPU : coupe + raster matériel + visualisation des clusters/erreurs. Sortie : correctness end-to-end.
4. Sélection GPU + compaction + indirect sur le même asset. Sortie : comparaison mesurée au CPU.
5. Hi-Z et deux passes. Sortie : aucun faux rejet sur désoccultation et gain net caractérisé.
6. Compression et pages. Sortie : limites mémoire, chargement incrémental et invalidation vérifiés.
7. Intégration Three/Electron : picking, ombres, reload, device loss. Sortie : contrat produit respecté.
8. Expériences avancées : raster logiciel, déformation, voxels, ray tracing. Sortie : bancs dédiés, sans les imposer au socle.

Chaque étape garde une référence simple utilisable pour les régressions suivantes. L'optimisation remplace une variante derrière une interface testable; elle ne supprime pas l'oracle qui permet de vérifier sa justesse.
