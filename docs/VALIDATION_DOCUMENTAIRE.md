# Validation de la base de développement

## 1. Ce qui est livré

Une documentation de conception du sous-système géométrie/rendu : préparation, réduction, sélection, mémoire, raster, attributs, intégration et protocole de performance. Les exemples sont rédigés en pseudocode ou en Python de référence. Les unités, contraintes, cas limites et voies de secours font partie des chapitres.

Le socle de départ est explicite : géométrie statique opaque, régions emboîtées, assets entièrement résidents, sélection CPU et raster matériel. Les extensions sont distinguées du socle pour que leur présence documentaire ne soit pas confondue avec leur implémentation.

## 2. Contrôles de cette passe

Contrôle du 11 septembre 2026 : 19 documents Markdown, dont 4 annexes thématiques ; 27 liens internes valides ; 38 tests numériques réussis. Aucun fichier d'un autre format, aucun lien de lecture sortant, aucun ancien nom de produit ou de fichier d'implémentation, aucun en-tête recopié, aucun commentaire dans les exemples de code. Les blocs Python sont syntaxiquement valides.

Les exemples des annexes ont été relus sur les points suivants : état prêt distinct d'un drapeau racine ; générations ; dépendances ; dernière utilisation GPU avant recyclage ; horloge LRU globale ; bornes sur géométrie déformée ; plans non normalisés ; arrondi et somme des poids ; coutures d'attributs.

## 3. Tests numériques

Les tests intégrés vérifient QEM, résolution singulière, projection et contre-exemples, plans/AABB, union de sphères, seuils, scan/compaction, Hi-Z impair, arguments signés, barycentriques, gradients, quantification, normales octaédriques, CRC, plages de sections et poids entiers.

Ils exécutent les fonctions Python contenues dans le dossier, pas les pseudocodes ni un shader compilé. Ils ne prouvent ni la validité de toute coupe géométrique réelle, ni le bon fonctionnement d'un ordonnanceur GPU, ni l'absence de bug dans une future implémentation.

## 4. Ce qui reste à valider au développement

| Sujet | Validation nécessaire |
|---|---|
| Compilation de mesh | roundtrip d'asset, topologie, contours, erreur et réduction bloquée |
| Formats | writer/reader indépendants, layout CPU/GPU, corruption et dépassement |
| Sélection | coupe complète CPU/GPU par vue, résidence incomplète et transitions |
| Raster et matériaux | images, profondeur, coutures, alpha, IDs et gradients |
| Mémoire | annulation, générations, slots en vol, budgets et device loss |
| Intégration | picking, ombres, capture/export, rechargement et fermeture |
| Performance | campagnes 00–13, petites machines, coût total et mémoire |
| Extensions | banc indépendant pour chaque mode, avec repli explicite |

Les performances sont `not-run`. Les modules moteur ne sont pas implémentés par cette passe documentaire. Le choix définitif du backend, des plafonds de clusters, des codecs et des budgets reste une décision issue des expériences, non un résultat présumé.

## 5. Portée de l'autonomie

Tous les liens de lecture restent dans ce dossier. La base n'est pas une archive permettant de restituer à l'identique des programmes, binaires ou documents extérieurs. Elle vise notre développement indépendant ; une documentation cohérente ne suffit pas à garantir que chaque détail imaginable d'un moteur complet est spécifié.

Les fichiers d'origine extérieurs au dossier n'ont pas été supprimés. Leur suppression définitive est une décision distincte : cette passe ne certifie pas une conservation exhaustive de toutes leurs informations. Les tests et références de calcul présents ici doivent être gardés pendant l'implémentation et les optimisations.
