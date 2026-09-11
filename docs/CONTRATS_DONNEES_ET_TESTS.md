# Contrats d'implémentation et programme de tests

Ce document décrit une proposition à implémenter dans le laboratoire avant toute intégration moteur. Un contrat décrit ici n'est pas une fonctionnalité déjà construite. Les performances des futurs backends sont **non mesurées**.

## 1. Chaîne complète

```text
Import d'asset et validation
  → normalisation des attributs et unités
  → adjacence et clusters feuilles
  → groupes de remplacement, simplification, hiérarchie
  → erreurs, bornes, frontières et tests
  → encodage d'un asset versionné
  → chargement partiel et résidence
  → sélection par vue et culling
  → compaction, bins et indirect
  → rasterisation, matériaux et intégration de scène
  → validation visuelle, profiling et décision
```

Le compilateur et le renderer partagent un **contrat d'asset**, pas leur organisation mémoire interne. Un changement de format invalide les caches et impose des tests de décodage. Le compilateur peut évoluer indépendamment du plugin tant qu'il produit une version reconnue.

## 2. Entrée du compilateur

| Champ | Contrat |
|---|---|
| Positions | finies, unité déclarée, repère documenté |
| Indices | entiers valides, triplets, limites vérifiées sans overflow |
| Normales | présentes ou calculées avec politique de faces dures |
| UV | jeux identifiés, coutures et miroirs conservés |
| Tangentes | signe et convention normal-map déclarés |
| Matériaux | affectation de chaque triangle, alpha mode et faces doubles |
| Transform | baking ou instance déclaré; échelle négative gérée |
| Animation | statique, rigide, skinning, morph, déplacement : statut explicite |
| Provenance | hash du contenu, version importeur, configuration, seed |
| Identité | correspondance source triangle/objet pour picking et diagnostic |

Un hash sur les seuls positions/indices ne suffit pas si la compilation dépend des UV, des matériaux, de la précision ou des poids. Les erreurs de validation produisent des diagnostics explicites, pas un asset apparemment réussi contenant des NaN.

## 3. Résultats du compilateur

Le résultat contient : géométrie encodée, clusters, groupes de remplacement, hiérarchie d'accélération, bornes géométriques et de LOD distinctes, métriques d'erreur, tableaux d'attributs/matériaux, graphe de dépendances, index de pages et manifeste de compilation.

### Header proposé

Un header disque minimal peut utiliser little-endian et les champs suivants : magic neutre, major/minor, taille header, flags, nombre de sections, longueur totale, checksum et hash de configuration. Chaque descripteur de section porte type, version, offset u64, longueur u64, nombre d'éléments et stride. Les offsets u64 se lisent par BigInt ou deux mots; ne pas supposer qu'un Number JavaScript représente tous les entiers u64.

La validation impose `offset <= length` puis `size <= length-offset`, sans addition pouvant déborder. Une section inconnue obligatoire rend le fichier incompatible; une section facultative inconnue peut être ignorée selon le flag défini. La V1 n'a pas besoin de supporter les fichiers supérieurs à la limite effective de la plateforme.

### Exemple de record GPU, proposition non figée

| Octets | Donnée | Type |
|---:|---|---|
| 0–15 | sphere géométrique : centre et rayon | vec4 f32 |
| 16–31 | borne ou référence LOD adaptée au modèle | vec4 f32 |
| 32–47 | erreur, erreur du remplacement, paramètres réservés | vec4 f32 |
| 48–63 | offsets indices/vertices, comptes | vec4 u32 |
| 64–79 | groupe, page, matériau/bin, flags | vec4 u32 |

Ce record pédagogique fait 80 octets, multiple de 16. Il ne prétend pas couvrir l'ensemble d'un DAG en cinq vecteurs : les listes de relations et bornes complètes se trouvent dans des buffers associés. Un indice invalide utilise une sentinelle définie; une erreur racine infinie peut se représenter par un flag plutôt que par un flottant artificiellement gigantesque.

Le writer CPU et le shader doivent partager les offsets; ajouter un test qui remplit chaque champ avec un motif distinct puis le relit sur GPU. `vec3<f32>` a une taille logique de 12 mais un alignement de 16 en WGSL; ne pas déduire le layout GPU de celui des objets du langage hôte.

### ErrorRecord proposé

```text
metric_kind : geometric_bound | geometric_estimate | attribute_score
reference : original_surface | preceding_representation
position_error_object : nonnegative finite scalar
quantization_error_object : nonnegative scalar
attribute_errors : separately named metrics
error_composition_rule : explicit versioned identifier
```

Une mesure échantillonnée de distance à la source reste une estimation sauf certification spécifique. Un poids perceptuel n'est pas une distance en mètres. Ces distinctions doivent survivre à la sérialisation.

## 4. Invariants amont à tester

1. Chaque triangle feuille valide appartient à exactement un cluster feuille de son domaine.
2. Les limites triangles/sommets/offsets sont respectées.
3. Toutes les relations de remplacement pointent vers des éléments existants; le graphe est acyclique.
4. Chaque remplacement représente complètement sa région et conserve son contour externe.
5. Les bounds incluent géométrie reconstruite, erreur admise et déformation autorisée.
6. Les métriques et bornes nécessaires au score LOD respectent la monotonie choisie.
7. Les erreurs zéro, niveaux terminaux et groupes non simplifiables ont des règles d'arrêt explicites.
8. Les duplications d'une frontière produisent les mêmes entiers quantifiés et attributs contractuels.
9. Les pages racines restent lisibles seules; les dépendances d'une page ne créent pas de cycle impossible à charger.
10. Le decode→encode→decode préserve les champs discrets exactement et les champs quantifiés sous tolérance.

Vérifier dans un espace de régions/groupe est plus juste que comparer seulement les IDs de triangles entre niveaux, puisque la simplification change la triangulation.

## 5. Invariants runtime

- La coupe sélectionnée couvre la surface visible une fois, y compris quand des pages sont absentes.
- Une capacité dépassée ne peut pas écrire hors buffer, publier un compteur excessif ou supprimer silencieusement une partie de la coupe.
- Les décisions sont par vue : caméra principale, ombres, réflexion, picking et stéréo n'ont pas forcément le même LOD.
- Une table de pages devient visible au GPU seulement après données et dépendances disponibles.
- Les buffers en vol ne sont ni recyclés ni détruits prématurément.
- La profondeur de culling et celle du raster ont les mêmes conventions et transformations.
- Un rejet conservatif signifie aucune contribution possible; une heuristique de qualité ne se présente pas comme un rejet garanti.
- Les états alpha test, déformation et double face utilisés dans le culling correspondent au raster.
- Une perte de device ou un changement d'asset invalide les handles et reconstruit les ressources proprement.

## 6. Synchronisation WebGPU

Les passes sont ordonnées dans un command encoder : reset des compteurs, compute de sélection, compaction, finalisation indirect, raster. Une écriture CPU `queue.writeBuffer` doit être placée conformément au calendrier de soumission; ne pas réutiliser une même zone de frame sans modèle d'ownership.

Le scan workgroup utilise des barrières uniformes. Les opérations globales utilisent des dispatchs successifs. Une invocation qui publie un compteur ne publie pas magiquement toutes ses données sous n'importe quel protocole; concevoir le consommateur dans une passe postérieure évite cette ambiguïté.

Les readbacks passent par des buffers compatibles et sont asynchrones. L'image ne dépend pas de leur résultat. Les contrôles de validation peuvent attendre le GPU dans un banc de correction, jamais être cachés dans la fenêtre d'un benchmark de performance.

L'utilisation de subgroups, de timestamps et des chemins indirects dépend des capacités réellement exposées. Un feature flag doit sélectionner un fallback testé, pas contourner silencieusement une fonction obligatoire.

## 7. Recette des bancs 00 à 13

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
