# Validation de la base de développement

**Audit du 11 septembre 2026 : autonomie validée pour la conception et le démarrage du socle ; spécification complète d'un moteur non revendiquée.** Les 19 documents ont été relus et les incohérences identifiées ont été corrigées. Aucun complément mathématique ou stratégique indispensable provenant du dossier temporaire de référence n'a été identifié pour démarrer ce socle.

## 1. Ce qui est livré

Une documentation de conception du sous-système géométrie/rendu : préparation, réduction, sélection, mémoire, raster, attributs, intégration et protocole de performance. Les exemples sont rédigés en pseudocode ou en Python de référence. Les unités, contraintes, cas limites et voies de secours font partie des chapitres.

Le socle de départ est explicite : géométrie statique opaque, régions emboîtées, assets entièrement résidents, sélection CPU et raster matériel. Les extensions sont distinguées du socle pour que leur présence documentaire ne soit pas confondue avec leur implémentation.

## 2. Contrôles de cette passe

Contrôle du 11 septembre 2026 : 19 documents Markdown, dont 4 annexes thématiques ; 28 liens internes valides ; aucun lien sortant et aucun document orphelin depuis l'index ; 50 tests numériques réussis, dont 12 ajoutés pendant cet audit. Aucun fichier d'un autre format. Les deux blocs Python de référence/tests sont syntaxiquement valides. La commande des oracles a réussi depuis une copie temporaire contenant seulement `docs`, avec Python et sa bibliothèque standard.

Les exemples des annexes ont été relus sur les points suivants : état prêt distinct d'un drapeau racine ; générations ; dépendances ; dernière utilisation GPU avant recyclage ; récence LRU distincte du parcours de table ; bornes sur géométrie déformée ; plans non normalisés ; arrondi et somme des poids ; coutures d'attributs. Les corrections mathématiques, mémoire et extensions ont reçu une seconde relecture indépendante. Le contrôle du diff dans `docs` ne relève pas d'erreur d'espaces ou de conflit.

Des transcriptions temporaires du pseudocode ont également été exécutées : subdivision sur les 8 combinaisons d'arêtes marquées, avec aire et orientation conservées, puis 4 cas de statut ; cache sur 4 scénarios de récence, soumissions, annulation et pins. Un upload annulé en vol garde son slot jusqu'à complétion, puis le libère sans passer à l'état prêt. Ces transcriptions ne sont pas une suite livrée ni une validation GPU.

## 3. Tests numériques

Les tests intégrés vérifient QEM, entrées non finies, résolution singulière, lien simplicial et tétraèdre, projection perspective/orthographique, échelle d'instance, cônes, distance point-triangle, plans/AABB, union de sphères, seuils, scan/compaction, Hi-Z impair, arguments signés, barycentriques, gradients, quantification, largeurs entières, normales octaédriques, CRC, plages de sections et poids entiers.

Les 50 tests sont conservés dans le Markdown et rejouables avec la commande d'`ORACLES_ET_TESTS.md`. Résultat de cette passe :

```text
Ran 50 tests
OK
```

Ils exécutent les fonctions Python contenues dans le dossier, pas les pseudocodes ni un shader compilé. Ils ne prouvent ni la validité de toute coupe géométrique réelle, ni le bon fonctionnement d'un ordonnanceur GPU, ni l'absence de bug dans une future implémentation.

## 4. Ce qui reste à valider au développement

| Sujet | Validation nécessaire |
|---|---|
| Spécification du format | records de sections, listes, sentinelles, alignements, flux d'attributs, grammaire et canonicalisation du manifeste |
| Paramètres de référence | plafonds, tolérances, métrique d'erreur, budgets RAM/VRAM et concurrence |
| Compilation de mesh | roundtrip d'asset, topologie, contours, erreur et réduction bloquée |
| Formats | writer/reader indépendants, layout CPU/GPU, corruption et dépassement |
| Sélection | coupe complète CPU/GPU par vue, résidence incomplète et transitions |
| Raster et matériaux | images, profondeur, coutures, alpha, IDs et gradients |
| Mémoire | annulation, générations, slots en vol, budgets et device loss |
| Intégration | versions Three/Electron, points publics utilisables, matériaux supportés, picking, ombres, capture/export, rechargement et fermeture |
| Performance | campagnes 00–13, petites machines, coût total et mémoire |
| Extensions | banc indépendant pour chaque mode, avec repli explicite |

Les performances de cette conception sont `not-run`. Les modules moteur ne sont pas implémentés par cette passe documentaire ; des résultats présents ailleurs dans le laboratoire ne valident pas implicitement ces futurs modules. Le choix définitif du backend, des plafonds de clusters, des codecs et des budgets reste une décision issue des expériences, non un résultat présumé. Les extensions avancées possèdent une direction et des limites explicites ; elles ne sont pas toutes des spécifications prêtes à implémenter.

## 5. Portée de l'autonomie

Tous les liens de lecture restent dans ce dossier. La base n'est pas une archive permettant de restituer à l'identique des programmes, binaires ou documents extérieurs. Elle vise notre développement indépendant ; une documentation cohérente ne suffit pas à garantir que chaque détail imaginable d'un moteur complet est spécifié.

Le dossier peut être conservé seul pour poursuivre le socle : la suppression des supports temporaires ne casse ni les liens ni les tests vérifiés ici. Elle ne transforme pas les décisions encore ouvertes en spécifications achevées. Les tests et références de calcul présents ici doivent être gardés pendant l'implémentation et les optimisations.

Aucun fichier d'implémentation du dossier temporaire de référence n'a été lu ou recopié pendant cet audit, et aucun lien vers lui n'a été ajouté. Les corrections viennent des contradictions entre chapitres, de contre-exemples mathématiques et de stratégies formulées indépendamment. Cette passe ne certifie pas la provenance du contenu préexistant ni une conservation exhaustive de toutes les informations des supports d'origine. Ceux-ci n'ont pas été supprimés par l'audit.

## 6. Corrections effectuées

| Sujet | Correction vérifiée |
|---|---|
| Contraction | lien simplicial complet et refus des faces superposées ; contre-exemple du tétraèdre |
| Adjacence | conservation des orientations, diagnostic sans clique quadratique, contrôle du lien des sommets |
| Partition | référence par ID/minimum de nouveaux sommets ; Morton et frontière minimale sont des variantes |
| LOD | branche orthographique et conversion objet vers vue, quantification comprise |
| Cônes | domaine angulaire et condition d'alignement explicites |
| Encodage | largeur des champs calculée exactement en entiers |
| Oracles | dimensions et valeurs finies contrôlées ; 12 tests supplémentaires |
| Cache | récence séparée du parcours des tables et annulation reprise après upload |
| Matériaux/vues | proche nul en orthographique ; états effectifs incluant orientation, formats, programmes et bindings |
| Subdivision | statut après la dernière passe et contrat des copies d'attributs |
| Déformation | composition inverse-bind, test de repos et ordre morph/skinning/instance |
| Cohérence générale | en-tête/CRC/manifeste et fermeture racine alignés, mention d'implémentation extérieure retirée, dossier d'exécution précisé |

## 7. Couverture des 19 documents

| Document | Couverture contrôlée |
|---|---|
| `README.md` | parcours complet, périmètre et autonomie |
| `ARCHITECTURE_GEOMETRIE.md` | modules, référence, hiérarchie et orchestration |
| `PREPARATION_DES_MESHES.md` | validation, topologie, réduction, erreur et encodage |
| `CALCULS_ESSENTIELS.md` | équations M01–M15, unités, hypothèses et contre-exemples |
| `ALGORITHMES_DE_BASE.md` | pseudocode fondamental et ses préconditions |
| `RENDU_ET_SELECTION.md` | coupes, projections, visibilité, Hi-Z et replis |
| `PAGES_MEMOIRE_ET_CACHE.md` | format proposé, dépendances, publication et récupération |
| `MATERIAUX_ET_EXTENSIONS.md` | matériaux, mathématiques des extensions et limites |
| `INTEGRATION_THREEJS_ELECTRON.md` | responsabilités, capacités, vues et cycle de vie |
| `CHOIX_TECHNOLOGIQUES.md` | rôles, coûts et protocole de choix |
| `CONTRATS_DONNEES_ET_TESTS.md` | données, invariants, fixtures et étapes 00–13 |
| `PLAN_EXPERIENCES_PERFORMANCE.md` | hypothèses, métriques et critères de décision |
| `ORACLES_ET_TESTS.md` | références numériques et tests autonomes |
| `SCHEMAS_ET_DERIVEES.md` | transitions, filtrage, tangentes et vues |
| `annexes/pages-et-cache.md` | cache à propriétaire unique et snapshots |
| `annexes/attributs-et-compression.md` | attributs, repères et compression entière |
| `annexes/subdivision-et-deformation.md` | motifs, budgets, déformation et bornes |
| `annexes/materiaux-et-vues.md` | classification, vues et ressources |
| `VALIDATION_DOCUMENTAIRE.md` | preuves, réserves et couverture de cette passe |
