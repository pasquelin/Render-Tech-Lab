# Programme d'optimisation mesurable

Toutes les expériences de ce document sont **not-run**. La passe documentaire a exécuté des oracles numériques, pas un benchmark GPU, un import natif ou une mesure de mémoire sur petite machine. Ce plan indique comment obtenir des résultats recevables ensuite.

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

## 3. Optimisations arithmétiques exactes sous hypothèses

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

## 6. Petites machines et concurrence

Définir au minimum un profil à GPU intégré et mémoire limitée, un profil portable intermédiaire et un profil dédié. Les seuils précis dépendent des machines effectivement disponibles; aucune machine non testée ne reçoit une mention « supporté et performant ».

Sur architecture à mémoire unifiée, RAM et allocations GPU partagent une pression physique; ne pas additionner deux métriques déjà comptées par l'OS. Sur GPU dédié, le pic RAM de staging et la VRAM sont deux budgets distincts. Rapporter la méthode de mesure et les éventuelles limites des compteurs.

La concurrence initiale est bornée par mémoire et CPU. Le budget de threads est partagé entre jobs; « quatre workers utilisant chacun tous les cœurs » n'est pas une parallélisation maîtrisée. Mesurer également veille, batterie et charge thermique si le produit doit rester agréable sur portable.

La référence de robustesse est une seule préparation lourde en arrière-plan, progression throttled et cache réutilisable. Augmenter la concurrence uniquement quand total de travail et latence utilisateur s'améliorent sans pression mémoire excessive.

## 7. Statistiques et verdict

Conserver les échantillons bruts avec unités, timestamps et phases. Séparer froid/chaud et exclure explicitement warmup, avec sa durée déclarée. Alterner l'ordre des variantes et répéter les campagnes pour estimer bruit et dérive thermique.

Les médianes et percentiles se calculent sur les durées, pas sur les FPS. Afficher différence absolue et relative, distribution des différences ou intervalle de confiance adapté. Un écart inférieur au bruit reste indéterminé.

Un verdict `INTEGRATE` exige correction, domaine de support, fallback, mémoire acceptable et gain net reproductible dans une charge utile au produit. `WATCHLIST` décrit un gain limité à certaines charges. `REJECT` décrit une régression ou un coût non compensé. `not-run` reste un statut sans métriques et sans verdict.

## 8. Cas qui interdisent de conclure

Une mesure constante utilisée en fallback, une sélection CPU étiquetée GPU, une fonction async exécutant le calcul dans le thread UI, des courbes venant de scènes différentes, une erreur relative traitée comme longueur monde, un readback bloquant caché, ou une image dégradée : chacun invalide l'interprétation d'un gain.

Avant chaque campagne, vérifier le chemin réellement exécuté et les unités de chaque compteur. Cette documentation ne modifie pas le code du laboratoire ni le moteur.
