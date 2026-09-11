# Bilan de transfert et validation documentaire

**11 septembre 2026 — documentation autonome pour le développement indépendant du socle et des extensions décrites.** La comparaison des supports a conduit à compléter les mathématiques, stratégies, invariants, limites et recettes dans 25 documents. À l’issue de cette comparaison et des relectures, aucun complément mathématique ou stratégique utile identifié ne reste uniquement dans les supports temporaires.

La suppression de ces supports ne retire aucune dépendance de lecture ou d’exécution aux documents et aux oracles vérifiés. Cette conclusion porte sur notre développement indépendant. Elle ne promet ni de restituer les programmes d’origine, ni de livrer un moteur déjà implémenté, ni de conserver chaque détail de leurs réalisations.

## 1. Travail effectué

La première passe avait contrôlé le socle documentaire, sans comparaison suffisante avec les supports. Elle ne permettait pas de conclure sur leur suppression. Ce bilan la remplace après une seconde passe de comparaison et de transfert couvrant aussi les extensions.

L’inventaire des supports contient 575 fichiers hors métadonnées de dépôt, dépendances installées et répertoires de distribution ignorés. La sélection des textes algorithmiques, interfaces et documents donne 386 contenus distincts après déduplication par empreinte, environ 123 000 lignes ; le document stratégique de 155 pages a été examiné séparément par thèmes. Ces nombres sont des tailles d’inventaire, pas une prétention de revue ligne par ligne de tous les programmes.

L’examen a été réparti entre préparation/compression, exécution GPU et native, prototype portable, puis assemblages/procédural et document stratégique. Les noyaux mathématiques et décisions de stratégie ont été lus en détail ou de façon ciblée ; interfaces, doublons, fichiers générés et éléments de plateforme ont été classés. Les informations utiles ont été reformulées dans des chapitres indépendants. Aucun code d’origine n’a été ajouté aux documents pendant cette session et aucun lien vers ces supports n’y figure.

Les 19 documents de départ ont été complétés par six chapitres :

| Chapitre ajouté | Connaissances conservées |
|---|---|
| [Construction et compression avancées](CONSTRUCTION_ET_COMPRESSION_AVANCEES.md) | partition, QEM multiattribut, métriques, prédiction, strips, palettes, pages et outils numériques |
| [Projection, profondeur et couleur](PROJECTION_PROFONDEUR_ET_COULEUR.md) | sphères projetées, profondeur stable, reconstruction, atlas et matériau commun |
| [Stratégies avancées](STRATEGIES_AVANCEES.md) | routage, imposteurs, groupes d’instances, parcours GPU, ombres paginées et raccords entre assets |
| [Assemblages et procédural](ASSEMBLAGES_ET_PROCEDURAL.md) | transforms, prototypes, masques, matériaux, squelettes, particules, terrain et préparation asynchrone |
| [Déformation, cellules et courbes](DEFORMATION_CELLULES_ET_COURBES.md) | déplacement borné, intervalles, BVH, voxelisation, échantillonnage, SGGX et fibres |
| [Pipeline GPU et extensions](PIPELINE_GPU_ET_EXTENSIONS.md) | capacités, publication, couverture, départage, shading, streaming, rayons, tessellation et atténuation |

L’index, les liens transversaux, le chapitre matériaux, la préparation, les expériences et les oracles ont également été mis à jour. Les nouveaux chapitres ont reçu une relecture indépendante ; leurs constats concrets ont été corrigés.

## 2. Couverture des familles identifiées

Le statut « conservé » signifie que les connaissances utiles identifiées disposent d’une formulation autonome, de leurs hypothèses et de critères de recette. Il ne signifie pas que chaque variante a été implémentée ou mesurée.

| Famille | Informations conservées et destination principale |
|---|---|
| Architecture et intégration | modules, flux, ownership, plugin, capacités, vues et fermeture : architecture et intégration |
| Validation de mesh | unités, données finies, identités, dégénérés, coutures, normales, liens de sommets : préparation et algorithmes |
| Adjacence et partition | graphe compact, croissance déterministe, Morton, coupe pondérée, contraintes non additives et repli : préparation et construction avancée |
| Simplification | QEM géométrique et multiattribut, contraintes topologiques, attributs discrets/miroirs, aire/volume, erreur mesurée ou bornée : calculs, algorithmes et construction avancée |
| Hiérarchie et remplacement | DAG, régions, transitions collectives, coupes complètes, budgets, forêt terminale, faible gain ou absence de progrès : architecture, rendu et construction avancée |
| Bornes et projection | AABB, sphères, plans, cônes, norme d’instance, perspective/orthographique, proche, quantification extérieure : calculs et projection |
| Compression d’attributs | champs entiers, valeurs constantes, UV, prédiction, normales octaédriques, angle tangent dans le repère décodé : annexes et construction avancée |
| Compression de topologie et animation | strips, parité, remapping, fenêtre de réutilisation, palette d’os, erreur des poids quantifiés/tronqués : construction avancée |
| Pages et compilation | encodage, alignements, CRC, manifeste, dépendances, profondeur de décodage et découverte du détail depuis les racines : pages, contrats et construction avancée |
| Streaming et cache | budgets, générations, pins, annulation, usages en vol, publication collective, feedback, vieillissement et corrections ordonnées : pages, annexe cache et pipeline GPU |
| Sélection et occlusion | erreur projetée, coupes, Hi-Z courant/historique, désoccultation, dimensions impaires et absence de faux rejets : rendu, calculs et oracles |
| Ordonnancement GPU | frontières, files persistantes, terminaison, publication, réservations groupées, capacités et grands dispatchs : stratégies avancées et pipeline GPU |
| Raster et composition | routage matériel/logiciel, clipping, profondeur/ID cohérents, départage, couverture intérieure/extérieure et dessin à taille fixe : rendu et pipeline GPU |
| Matériaux et dérivées | couverture programmable, alpha, tangentes, gradients analytiques, pixels/quads, masques, taux variable et couleur linéaire : matériaux, schémas, projection et pipeline GPU |
| Imposteurs | domaine de captures, directions, pivot, atlas, profondeur, parallaxe, filtrage, identité, mémoire, transitions et replis : stratégies avancées et projection |
| Très nombreuses instances | hiérarchie d’instances, proxies de groupes, partage, coût des transforms et invalidation : stratégies avancées |
| Ombres paginées | demandes depuis les récepteurs, vues de lumière, empreintes, pages voisines, occluders hors champ, effacement/reconstruction et budgets : stratégies avancées |
| Raccords entre assets | grilles compatibles, transport d’entiers canoniques, arrondis, frontières et LOD indépendants : stratégies avancées |
| Assemblages et imports | transforms relatives, prototypes, graphes, masques, cardinalités, matériaux, identité et grandes coordonnées : assemblages |
| Animation et procédural | inverse-bind, morphs, skinning, bornes, historique, union des passes, particules et compte vivant : matériaux, assemblages et pipeline GPU |
| Terrain et préparation asynchrone | géométrie/collision, UV, régions invalidées, dépendances, attente, annulation et publication par génération : assemblages |
| Déplacement et tessellation | motifs conformes, arêtes partagées, Hessienne, intervalles, formes affines, barycentriques, quantification et arrêt : déformation, annexe subdivision et pipeline GPU |
| BVH, rayons et export | médiane/SAH, intersections, cache d’accélération, générations, scratch, besoins hors écran, extraction par comptage puis production : matériaux, déformation et pipeline GPU |
| Cellules et volumes | SAT triangle-boîte, connectivité, masques compacts, parcours de grille, frontières, rayons transformés et transmittance : déformation et pipeline GPU |
| Statistiques directionnelles | moment des normales distinct de SGGX, fitting, positivité, distribution visible, densité séparée et quadrature : déformation et oracles |
| Échantillonnage | aire de triangles, sphère, disque, gaussienne tronquée, importance, couverture et limites de corrélation : déformation |
| Courbes et fibres | Bézier, longueur d’arc, réduction de forme, rayons, repères, clusters, tuiles et invariance à la segmentation : déformation et pipeline GPU |
| Outils numériques | résidus, conditionnement, affinement, pseudo-inverse tronquée, racine encadrée et limites des heuristiques : construction avancée |
| Diagnostic et mesure | saturation, compte réel/publié, mémoire totale, latence, instrumentation, scènes comparables et protocoles d’acceptation : expériences, contrats et pipeline GPU |

## 3. Contrôles exécutés

Le contrôle final a réussi : 25 documents Markdown, dont quatre annexes ; 52 liens internes valides ; aucun document orphelin depuis l’index ; aucun lien sortant, chemin vers les supports temporaires ou fichier d’un autre format. Les blocs sont correctement clôturés et les deux blocs Python sont syntaxiquement valides. Le contrôle des modifications dans `docs` ne relève aucune erreur d’espaces ni marque de conflit.

Les oracles ont été exécutés depuis une copie temporaire contenant seulement `docs`, avec Python et sa bibliothèque standard. Résultat :

```text
Ran 75 tests
OK
```

La suite livrée est passée de 38 à 75 tests pendant la session : 12 lors de la correction du socle, puis 25 lors du transfert des extensions. Elle vérifie notamment :

- QEM, lien simplicial complet, contre-exemple du tétraèdre, distance point-triangle et distinction mesure/borne ;
- projection, échelle d’instance, cônes, sphères, Hi-Z, profondeur finie/infinie et petites valeurs inversées ;
- scans, capacités entières, partition de travail, formats, CRC, poids et composition ordonnée de corrections ;
- couverture affine, interpolation, gradients, quantification, normales, barycentriques et erreur de poids tronqués ;
- Bézier comparé à De Casteljau, contre-exemple de subdivision perspective, distribution SGGX et transmittance.

Les tests combinent exemples analytiques, contre-exemples, petits domaines exhaustifs et tirages déterministes. La quadrature SGGX est un contrôle numérique sous tolérance. Les oracles f64 ne fournissent pas une preuve exhaustive de robustesse flottante ; leurs domaines et rejets sont déclarés.

Des vérifications temporaires supplémentaires ont porté sur les huit motifs de subdivision, quatre cas de statut, quatre scénarios de cache, des projections de sphère et des compositions numériques. Elles ont aidé la relecture mais ne sont pas comptées comme tests livrés. Aucun benchmark GPU, shader compilé ou moteur complet n’est validé par cette passe.

## 4. Corrections importantes issues des deux passes

Le socle a été corrigé sur le lien simplicial complet et les faces superposées, l’adjacence non manifold, la classification des sommets, la référence de partition, la projection orthographique, les erreurs transformées, le domaine des cônes, les largeurs entières, la récence du cache, les uploads annulés, les états de matériau, la liaison du squelette et le statut final de subdivision.

Le transfert des extensions a ajouté ou précisé : découverte des pages, quantification des bornes avec origine contrôlée, matrice SGGX distincte du moment, domaine unitaire des directions/normales, incertitude du SAT, direction d’imposteur orthographique, effacement des pages d’ombre, faux critère de taille sous perspective, départage matériel explicite et précision de la profondeur inversée. Les oracles barycentriques déclarent leur normalisation ; les calculs de sphère et SGGX rejettent les dépassements de leur plage arithmétique.

## 5. Éléments volontairement non conservés

| Élément des supports | Motif et conséquence |
|---|---|
| Code, shaders, tables et dispositions binaires d’origine | exclus conformément au périmètre de transfert ; nos algorithmes et formats seront implémentés indépendamment |
| Binaires, modules compilés, fichiers générés et dépendances embarquées | aucune connaissance mathématique supplémentaire à conserver sous cette forme ; ils ne sont pas nécessaires aux oracles |
| Assets de démonstration, images et scènes originales | pas d’archive des contenus ; les recettes décrivent les propriétés des fixtures à recréer pour nos bancs |
| Interfaces d’éditeur, menus, labels, logs et wrappers de plateforme | leurs responsabilités utiles ont été reformulées ; leur réalisation particulière n’est pas une spécification de notre produit |
| Constantes de réglage, résultats historiques et contournements de compilateur | ne prouvent ni gain ni validité sur notre backend ; les expériences précisent comment choisir et mesurer |
| Reproduction exacte d’un autre moteur | hors objectif : les documents conservent les connaissances identifiées, pas les programmes originaux |

Ces exclusions sont intentionnelles. Après suppression, les éléments originaux non conservés ne pourront pas être reconstruits à l’identique depuis cette documentation.

## 6. Travail restant pour notre implémentation

Le format détaillé des sections, les plafonds de clusters, les codecs retenus, les budgets, les capacités du backend et les points d’intégration sont des décisions à prendre dans notre projet. Les critères pour les choisir et les vérifier figurent dans les documents ; ils ne constituent pas une information encore à extraire des supports temporaires.

Les étapes de développement devront valider compilation et roundtrip d’assets, coupe CPU/GPU, corruption de formats, qualité d’image, coutures, profondeur/ID, annulation et recyclage, device loss, intégration et coût total. Chaque extension garde son banc et son repli. Les performances des futurs modules restent `not-run` ; aucun résultat d’un autre banc ne les valide implicitement.

**Décision : les supports temporaires ne sont plus requis pour poursuivre ce développement sur le périmètre mathématique et stratégique documenté.** Les conserver ne fait plus partie d’une dépendance documentaire identifiée. Leur suppression n’a pas été exécutée par cet audit.
