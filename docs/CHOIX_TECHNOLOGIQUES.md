# Choix technologiques pour la préparation et le rendu — laboratoire

Partie laboratoire : protocoles, recettes ou suivi documentaire. La conception du produit est conservée dans [Web Geometry](../../webGeometry/docs/architecture/CHOIX_TECHNOLOGIQUES.md). Les numéros historiques des sections sont conservés.

## 6. Matrice d'expériences

Première comparaison : même noyau algorithmique et mêmes options en natif mono-thread puis WASM mono-thread. Deuxième : même noyau dans les différents contenants. Troisième : threads/SIMD. Quatrième : autre algorithme à qualité comparable. Rapporter ces campagnes séparément.

Entrées : meshes de 10k, 100k, 1M triangles seulement si admis en mémoire ; plans, maillages détaillés, îlots nombreux, coutures, non-manifold refusé et cas singuliers. Ajouter import à froid, processus chaud, cache hit, annulation et préparation pendant navigation.

Mesures : parsing, validation, partition, réduction, certification, encodage, transport, upload, total, pic RAM, mémoire GPU, threads, p95 de l'éditeur et taille du paquet distribué. Aucun temps inconnu n'est remplacé par zéro.

Si temps initial total 100 ms dont 80 ms de copies et 20 ms de calcul, accélérer le calcul de deux fois ne donne que 90 ms, soit environ 1,11×. Réduire les copies peut être plus utile que changer de langage.

## 7. Critères de décision

Retenir une option seulement si qualité, stabilité et budgets passent, puis si le gain net dépasse le bruit. Conserver le backend simple si le gain est marginal et la distribution devient beaucoup plus complexe.

Proposition de trajectoire, à valider : oracles Python, prototype worker, noyau compact portable, comparaison natif/WASM, puis backend supplémentaire seulement sur bénéfice démontré. Python ne devient pas une dépendance du rendu parce qu'il sert aux tests ; le moteur ne doit pas lancer un interpréteur par image.

Les versions, options de compilation, bibliothèques choisies, architectures et fonctionnalités disponibles sont enregistrées avec chaque résultat. La vitesse, la compatibilité et le domaine de support restent `not-run` jusqu'à cette campagne.
