# Programme d'optimisation mesurable

Les expériences générales de ce plan restent **not-run**, sauf les mesures explicitement décrites dans la [campagne comparative du 11 septembre 2026](PREUVES_COMPARATIVES_OPTIMISATION.md). Cette campagne couvre une fonction CPU du prototype, deux noyaux JavaScript et une scène de contrôle WebGL2. Elle ne valide ni le futur moteur GPU, ni un import natif, ni les performances sur petite machine.

## 1. Trois questions distinctes

1. **Algorithme :** produit-il moins de travail ou des données de meilleure qualité ? Comparer qualité, temps et mémoire ensemble.
2. **Implémentation :** exécute-t-elle le même calcul plus efficacement ? Garder algorithme, entrées, précision et bibliothèque identiques.
3. **Intégration :** le produit gagne-t-il réellement ? Inclure démarrage, transport, cache, upload, concurrence avec le rendu et fermeture.

Un compilateur plus lent peut produire des assets bien plus rapides à rendre. Un compilateur plus rapide peut dégrader les bounds, la compression ou les silhouettes. Rapporter ces compromis au lieu de résumer par un unique « plus rapide ».

## 2. Ordre prioritaire des hypothèses

| Priorité | Variante | Gain recherché | Recette à préserver |
|---|---|---|---|
| 1 | Réduire le nombre de triangles/instances réellement examinés | éviter du travail | coupe et visibilité complètes |
| 2 | Disposition des données : SoA/AoS/hybride | moins d'octets lus | même layout décodé |
| 3 | Amortir allocation, compilation et transferts | moins de latence et pics RAM | ownership et annulation |
| 4 | Compaction par workgroup / bins plus cohérents | moins d'atomiques et soumissions | mêmes ensembles, ordre si requis |
| 5 | Hi-Z puis deux passes | réduire le raster caché | zéro faux rejet |
| 6 | Compression et streaming | réduire mémoire/réseau | frontières, erreur et résidence |
| 7 | SIMD / précision / simplifications arithmétiques | accélérer un noyau identifié | tolérances et bornes |
| 8 | Raster logiciel et stratégies avancées | traiter les microtriangles | cohérence depth/ID et progression |

## 3. Identités algébriques sans validation de performance

Les transformations suivantes sont des hypothèses de recherche conservées pour leur explication mathématique. **Aucune n'est une optimisation adoptée.** Leur équivalence dans les réels ne prouve ni l'identité des décisions en flottants, ni un gain après compilation. Elles ne doivent pas remplacer les oracles sans comparaison recevable et sans respecter les conditions de la section 7.

### Projection centrale sans division

Pour `error>=0`, `depth>0`, `focal>=0`, `threshold>=0` :

```text
focal*error/depth <= threshold
équivaut à focal*error <= threshold*depth
```

L'équivalence algébrique ne rend pas le modèle central conservatif hors axe. Elle ne s'applique pas à une profondeur négative et nécessite une politique d'overflow/NaN en f32.

### Borne perspective sans racine carrée

Pour la borne jacobienne du document des calculs, sous les mêmes hypothèses et `Zmin>near` :

```text
error² * fmax² * (Zmin² + Rmax²) <= threshold² * Zmin⁴
```

Cette comparaison élimine la racine et les divisions de la formule développée. Elle peut cependant augmenter la plage dynamique et le nombre de multiplications. Tester une version normalisée pour éviter overflow/underflow; une formule mathématiquement équivalente peut être numériquement moins sûre.

### Frustum sans normaliser les plans

Le test AABB `dot(n,center)+offset+dot(abs(n),extent)<0` ne nécessite pas de plans unitaires. Si les plans sont extraits une seule fois par vue, économiser leur normalisation peut être négligeable. Comparer à une version avec plans prétraités, pas à six normalisations par cluster artificiellement coûteuses.

### Produits et normes

Comparer des distances carrées évite une racine lorsque les deux côtés sont non négatifs. Préserver les tolérances relatives et le comportement au zéro. Le matériel/compilateur peut déjà effectuer certaines transformations; inspecter le profil avant de multiplier les variantes source.

## 4. Campagne amont : même bibliothèque, contenants différents

Comparer une même version de noyau géométrique via : natif C++, hôte Rust + liaison C, Python + liaison native, C++→WASM en worker et éventuellement Rust→WASM. Vérifier les hashes d'entrées, les paramètres et les sorties. Une version Rust réécrite du noyau appartient à une autre campagne.

Scénarios : lancement à froid avec import, processus chaud avec import, cache hit, recompilation après modification d'attribut, annulation à 25/75 %, plusieurs petits jobs et un gros job pendant navigation 3D.

Tailles proposées, à adapter aux limites mesurées : `10k / 100k / 1M` triangles avant `10M`. Ne pas lancer d'emblée un cas dont le pic mémoire estimé dépasse le budget. Inclure meshes très connectés et beaucoup d'îlots; le nombre de triangles seul ne prédit pas tout le coût de partition/simplification.

Métriques : lecture/parsing, copies, calcul par phase, certification, écriture, total, pic de mémoire du groupe de processus, threads réellement actifs, CPU disponible pour le rendu, p95 frame pendant import, coût d'annulation, cache disque et taille de distribution.

## 5. Campagne runtime

Séparer charges dominées par CPU draw, bande passante, vertex processing, pixels/matériaux, occlusion et streaming. Utiliser les mêmes assets compilés pour comparer les backends de sélection/rendu.

Trajectoires : caméra fixe, rotation, travelling, téléportation, zoom, changement de résolution, ouverture de seconde vue. Répéter avec ombres et sans ombres; la qualité de l'ombre ne doit pas être cachée dans une comparaison de FPS.

Taux d'occlusion proposés : 0/10/50/90/99 %. Densités de compaction : 0/1/10/50/100 %. Tailles de listes : 0,1, limites de workgroup, puis `1k/10k/100k/1M`. Tester la saturation séparément : elle est d'abord un test de sûreté/correction, pas un record de débit.

Présenter un graphe coût total en fonction de la charge, avec point de croisement et intervalle d'incertitude. Un gain à 1M éléments ne justifie pas d'activer le même chemin pour 100 éléments.

### 5.1. Paramètres à couvrir avant toute validation

Chaque proposition doit déclarer son domaine de validité **avant les mesures** : fonctions remplacées, entrées, fonctionnalités, scènes, affichages et machines visés. Établir la liste de ses dépendances et de ce qui peut invalider ses précalculs. La matrice suivante constitue le minimum commun ; ajouter les paramètres propres à l'algorithme. Elle ne représente pas une preuve exhaustive de toutes les combinaisons possibles.

| Famille | Paramètres à enregistrer et cas à comparer |
|---|---|
| Affichage et résolution | Dimensions CSS de la vue, dimensions physiques réelles de chaque cible de rendu et de la sortie affichée, DPR/Retina effectif, facteur de résolution interne, upscaling, ratio largeur/hauteur, fréquence d'écran et plafond de cadence. Inclure 1280×720, 1920×1080, 2560×1440 et 3840×2160 physiques lorsque ces résolutions appartiennent au domaine annoncé, ainsi que redimensionnement et changement d'écran. |
| Caméra et vues | Position, orientation, FOV, aspect, perspective/orthographique, projection décentrée, jitter, near/far, caméra dans une borne, passage du plan proche, zoom, travelling, téléportation et vues multiples. |
| Géométrie et visibilité | Objets, instances, triangles source et effectivement soumis, taille des triangles à l'écran, niveaux LOD et transitions, distributions spatiales, recouvrement, taux d'occlusion, limites de capacité, géométrie dégénérée et coutures. |
| Transformations et précision spatiale | Échelles uniformes/non uniformes/négatives, cisaillement, grandes coordonnées, changement d'origine, bornes après transformation, objets statiques et mobiles. |
| Matériaux et passes | Matériaux et textures actifs, éclairage, ombres et tailles de leurs cibles, opacité/transparence/alpha test, anticrénelage, post-traitement, historique temporel et autres passes réellement utilisées. |
| Fonctionnalités et changements d'état | Animation, skinning/morphs/déformation, picking et identités, édition, ajout/suppression, multi-vues, invalidation des caches, annulation, rechargement et perte/restauration du contexte. |
| Résidence et mémoire | Scène résidente ou chargement progressif, cache froid/chaud, débit et latence d'entrée, RAM/VRAM disponibles et pics, staging, allocations temporaires, uploads et évictions pendant la navigation. |
| Machine et environnement | Modèles CPU/GPU, mémoire et architecture unifiée/dédiée, OS/pilote, navigateur ou Electron, versions des bibliothèques, WebGL/WebGPU et extensions, alimentation secteur/batterie, état thermique et travail concurrent. |
| Calcul numérique | Types et précision réellement exécutés, ordre des opérations, seuils et valeurs adjacentes, zéros, valeurs non finies, débordements/sous-flux, arrondis et invariants conservatifs. Un accord f64 ne valide pas automatiquement f32 ou un shader. |
| Coût et qualité | Préparation, calcul, invalidation, synchronisation, transferts et soumission ; temps CPU/GPU disponibles, cadence, latence et pics ; sorties fonctionnelles, image et stabilité temporelle. Déclarer pour chaque métrique le périmètre, la résolution du compteur et la phase froid/chaud. |

**Résolution effective :** le calcul en pixels emploie les dimensions physiques de la cible concernée. Déclarer si un seuil LOD est exprimé en pixels internes ou en pixels de sortie ; la projection de l'erreur et le seuil doivent utiliser la même unité. Ne pas déduire ces dimensions du seul DPR système : le renderer peut plafonner son ratio ou utiliser des cibles internes d'une autre taille. À vue CSS identique, doubler le ratio effectif sur les deux axes multiplie par quatre le nombre de pixels ; cela ne prédit pas un temps de rendu multiplié par quatre. LOD, culling et coût des passes doivent être mesurés avec les dimensions réellement utilisées, séparément pour chaque vue.

**Interactions à couvrir :** résolution × DPR × FOV × LOD ; résolution × matériaux × transparence × anticrénelage ; résolution/FOV/jitter × historique temporel ; mouvement × invalidation × streaming ; ombres × vues multiples × animation ; alpha/déplacement × profondeur/Hi-Z ; charge × mémoire × matériel × chauffe. Des tests isolés de chaque paramètre ne prouvent pas leurs interactions. Choisir des scènes représentatives et des cas limites à partir des dépendances du calcul, et consigner les combinaisons non couvertes. Une combinaison susceptible de changer la conclusion reste une limite bloquante pour le domaine annoncé.

### 5.2. Comparaison recevable et traçabilité

Une paire A/B rejoue exactement les mêmes entrées, trajectoires, résolutions physiques, paramètres, seeds et fonctionnalités. Modifier un facteur entre séries permet d'en étudier l'effet ; si plusieurs changent ensemble, le résultat appartient à cette configuration combinée et ne doit pas être attribué à la seule résolution. Le coût des préparations, allocations et invalidations de la candidate reste dans le périmètre mesuré.

Une résolution dynamique, un LOD automatique ou un effet adaptatif doit conserver la même politique et le même budget de qualité entre variantes. Pour isoler le calcul, rejouer la même séquence enregistrée de dimensions et d'états ; évaluer le contrôleur adaptatif séparément, puis dans la scène complète. Enregistrer les dimensions et états réellement obtenus au cours du temps. Baisser la résolution, désactiver une fonctionnalité ou réduire la qualité pour faire gagner B invalide une promesse de gain sans perte. Si un mécanisme adaptatif ne permet plus une comparaison à qualité équivalente, le gain sans perte reste non démontré.

Pour chaque ligne de matrice, enregistrer `mesuré`, `non mesuré` ou `non applicable`, avec configuration et lien de preuve. `Non applicable` exige une justification liée au fonctionnement de la proposition ; il ne permet pas de retirer une fonctionnalité du produit pour faciliter l'acceptation. Conserver les résultats par configuration, y compris les régressions : une moyenne globale ne doit pas masquer une petite machine ou une résolution qui régresse.

Fixer les critères numériques, fonctionnels, visuels et de fluidité avant la campagne. Les images fixes ne suffisent pas pour les transitions, désocclusions, scintillements ou effets temporels. Contrôler aussi les identités et sorties des fonctionnalités ; une image identique ne prouve pas le picking ou la résidence. Une métrique indisponible n'est pas remplacée par un chiffre déduit d'un autre compteur.

Le dossier de validation contient la matrice couverte, les cas manquants, les sources et versions, les échantillons, les comparaisons de qualité et le verdict par configuration. Une preuve limitée ne devient pas une validation globale. Ne pas réduire rétroactivement le domaine promis pour masquer un échec ; une proposition de portée plus étroite doit être présentée explicitement comme telle.

## 6. Petites machines et concurrence

Définir au minimum un profil à GPU intégré et mémoire limitée, un profil portable intermédiaire et un profil dédié. Les seuils précis dépendent des machines effectivement disponibles; aucune machine non testée ne reçoit une mention « supporté et performant ».

Sur architecture à mémoire unifiée, RAM et allocations GPU partagent une pression physique; ne pas additionner deux métriques déjà comptées par l'OS. Sur GPU dédié, le pic RAM de staging et la VRAM sont deux budgets distincts. Rapporter la méthode de mesure et les éventuelles limites des compteurs.

La concurrence initiale est bornée par mémoire et CPU. Le budget de threads est partagé entre jobs; « quatre workers utilisant chacun tous les cœurs » n'est pas une parallélisation maîtrisée. Mesurer également veille, batterie et charge thermique si le produit doit rester agréable sur portable.

La référence de robustesse est une seule préparation lourde en arrière-plan, progression throttled et cache réutilisable. Augmenter la concurrence uniquement quand total de travail et latence utilisateur s'améliorent sans pression mémoire excessive.

## 7. Statistiques et verdict

Conserver les échantillons bruts avec unités, timestamps et phases. Séparer froid/chaud et exclure explicitement warmup, avec sa durée déclarée. Alterner l'ordre des variantes et répéter les campagnes pour estimer bruit et dérive thermique.

Les médianes et percentiles se calculent sur les durées, pas sur les FPS. Afficher différence absolue et relative, distribution des différences ou intervalle de confiance adapté. Un écart inférieur au bruit reste indéterminé.

Un verdict `INTEGRATE` exige simultanément :

- sorties et fonctionnalités conservées dans le domaine de support, avec les cas limites et le repli ;
- aucune dégradation visuelle : mêmes scènes, trajectoires, résolution, matériaux, paramètres et critère d'image déclaré ;
- gain net reproductible, préparation, invalidation, transferts et mémoire supplémentaire compris ;
- fluidité améliorée dans la scène cible, au-delà du bruit, avec temps d'image et pics contrôlés ;
- validation sur les classes de machines réellement annoncées.

La matrice des sections 5.1 et 5.2 fait partie de ce verdict. Tous les paramètres pertinents et leurs interactions critiques doivent disposer d'une preuve dans le domaine annoncé ; une case pertinente non mesurée empêche de valider ce domaine.

Un critère inconnu interdit `INTEGRATE`. `WATCHLIST` décrit seulement une observation locale à approfondir, sans autorisation de remplacement. `REJECT` décrit une régression ou un coût non compensé. `not-run` reste un statut sans métriques et sans verdict. Une augmentation de précision ou une formule plus courte ne remplit aucun critère de performance à elle seule.

« Ordinateur de moins de cinq ans » n'est pas une classe de performance. Déclarer CPU, GPU intégré ou dédié, RAM, système, navigateur, résolution et mode d'alimentation. Le M2 Max de la campagne comparative ne valide pas les portables modestes ; leur statut reste `not-run`.

## 8. Cas qui interdisent de conclure

Une mesure constante utilisée en fallback, une sélection CPU étiquetée GPU, une fonction async exécutant le calcul dans le thread UI, des courbes venant de scènes différentes, une erreur relative traitée comme longueur monde, un readback bloquant caché, ou une image dégradée : chacun invalide l'interprétation d'un gain.

Avant chaque campagne, vérifier le chemin réellement exécuté et les unités de chaque compteur. Cette documentation ne modifie pas le code du laboratoire ni le moteur.

## 9. Comparer les représentations avancées

Les [stratégies avancées](STRATEGIES_AVANCEES.md) et le [pipeline GPU](PIPELINE_GPU_ET_EXTENSIONS.md) fournissent des expériences séparées : imposteurs, hiérarchie d’instances, ombres paginées, lots à taille fixe, réservations groupées, couverture programmable, rayons, courbes et cellules. Garder pour chaque expérience les mêmes vues, matériaux, trajectoires et budgets de qualité.

Séparer géométrie importée, examinée, retenue, effectivement rasterisée et remplacée par des images ; les triangles source d’un imposteur ne sont pas des triangles rasterisés. Compter captures, listes transitoires, scratch et pages en vol dans la mémoire totale. Comparer scènes pleines et ajourées, proches et dispersées, avec et sans plan de fond : une grille clairsemée peut empêcher l’occlusion qu’autorise un mur dense.

La cadence de présentation peut être plafonnée par l’écran et inclure des attentes. Mesurer séparément CPU, GPU par passe et latence globale. Des timestamps indisponibles restent indisponibles, jamais zéro. Lire les statistiques hors fenêtre de mesure, conserver plusieurs frames et fournir une mesure sans instrumentation. Un accord CPU/GPU peut reproduire la même erreur ; les cas analytiques et contre-exemples indépendants restent nécessaires.
