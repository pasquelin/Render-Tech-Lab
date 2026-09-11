# Choix technologiques pour la préparation et le rendu

## 1. Décision de départ

Commencer par une référence lisible, un format stable et un seul job lourd en arrière-plan. Comparer ensuite les implémentations à algorithme et qualité identiques. Aucun langage n'est déclaré gagnant sans mesure de bout en bout.

Le choix se fait sur trois axes indépendants : **algorithme**, **langage/bibliothèque**, **lieu d'exécution**. Rust et C++ peuvent cibler le natif ou WebAssembly ; Python peut orchestrer un noyau natif ; un worker peut exécuter JavaScript ou WASM. Mélanger ces axes rend les comparaisons trompeuses.

## 2. Rôles proposés

| Option | Usage à comparer | Risques/coûts à mesurer |
|---|---|---|
| JavaScript/TypeScript dans un worker | référence, orchestration, petits assets, intégration simple | allocations, GC, copies et gros graphes |
| WASM dans un worker | calcul portable, tableaux compacts, noyau partagé | copie vers mémoire linéaire, démarrage, croissance du tas |
| C++ natif isolé | calculs denses, bibliothèques natives, SIMD | sûreté mémoire, packaging, architectures, maintenance |
| Rust natif isolé | structures et ordonnanceur sûrs, calculs denses | temps de développement, dépendances, frontières FFI |
| Python avec boucles numériques | oracles et prototypes de calcul | coût des boucles/interpréteur, allocations et lancement |
| Python avec noyau natif | pipeline outillage/offline déjà disponible | coût de démarrage/imports, copies et runtime distribué |
| Compute GPU | nombreux tests indépendants, scans, sélection par frame | dispatchs, transferts, synchronisation, pression partagée |

Les qualificatifs décrivent les sujets à tester, pas un classement de vitesse. Réécrire un algorithme dans un autre langage peut changer sa précision ou ses décisions ; ce n'est plus une comparaison pure du coût d'exécution.

## 3. Où exécuter

Un Web Worker sépare le calcul du thread UI. Un transfert d'ArrayBuffer détache la propriété côté émetteur ; conserver une représentation immuable si elle reste nécessaire à l'affichage. Un partage de mémoire exige un protocole de synchronisation, pas seulement un buffer commun.

Un worker Node partage le processus et ses contraintes. Un processus auxiliaire isole mieux un crash de préparation mais ajoute lancement, communication et mémoire. `utilityProcess` lance un processus Node ; un exécutable Rust/C++ autonome se lance par un mécanisme d'exécution de programme, ce n'est pas le même contrat.

L'arrêt forcé est une solution de dernier recours pour un calcul qui n'observe pas l'annulation. Écrire uniquement des résultats temporaires jusqu'au commit permet de rejeter un travail interrompu. Mesurer temps d'arrêt et nettoyage.

## 4. Mémoire et concurrence

L'admission réserve d'abord mémoire et threads :

```text
admit(job, state):
    if job.peakMemory > state.memoryBudget - state.memoryReserved:
        return queued
    if job.threads > state.threadBudget - state.threadsReserved:
        return queued
    state.memoryReserved += job.peakMemory
    state.threadsReserved += job.threads
    return admitted
```

Les tailles et budgets sont non négatifs et les soustractions contrôlées. La réservation est libérée une seule fois à la fin réelle du job, pas dès l'envoi d'une demande d'annulation.

Le pic de préparation peut comprendre plusieurs copies du mesh, graphe d'adjacence, file de candidats, nouveaux niveaux et buffers d'encodage. Mesurer un estimateur de pic par phase avant d'admettre plusieurs jobs. Si la bibliothèque lance déjà ses propres threads, ils comptent dans le budget commun.

Sur petite machine, privilégier cache, charge bornée et maintien du frametime plutôt qu'utilisation de tous les cœurs. Un débit d'import plus élevé peut rendre l'éditeur inutilisable si le rendu et le système manquent de mémoire ou de temps CPU.

## 5. WASM, SIMD et parallélisme

WASM n'envoie pas le calcul au GPU. Il exécute un module compilé dans son environnement hôte. Garder les tableaux dans son espace mémoire pendant plusieurs phases peut éviter les allers-retours ; toute croissance de mémoire demande de gérer les vues éventuellement invalidées.

SIMD et threads sont des variantes à détecter et à tester. La voie scalaire mono-thread reste la référence portable. La mémoire partagée côté navigateur dépend du contexte de sécurité effectif ; ne pas la présumer parce que l'application est empaquetée dans Electron.

Éviter une frontière d'appel par triangle. Préférer traitement de buffers ou de régions complètes. Une meilleure granularité peut dépasser le gain d'un changement de langage.

## 6. Matrice d'expériences

Première comparaison : même noyau algorithmique et mêmes options en natif mono-thread puis WASM mono-thread. Deuxième : même noyau dans les différents contenants. Troisième : threads/SIMD. Quatrième : autre algorithme à qualité comparable. Rapporter ces campagnes séparément.

Entrées : meshes de 10k, 100k, 1M triangles seulement si admis en mémoire ; plans, maillages détaillés, îlots nombreux, coutures, non-manifold refusé et cas singuliers. Ajouter import à froid, processus chaud, cache hit, annulation et préparation pendant navigation.

Mesures : parsing, validation, partition, réduction, certification, encodage, transport, upload, total, pic RAM, mémoire GPU, threads, p95 de l'éditeur et taille du paquet distribué. Aucun temps inconnu n'est remplacé par zéro.

Si temps initial total 100 ms dont 80 ms de copies et 20 ms de calcul, accélérer le calcul de deux fois ne donne que 90 ms, soit environ 1,11×. Réduire les copies peut être plus utile que changer de langage.

## 7. Critères de décision

Retenir une option seulement si qualité, stabilité et budgets passent, puis si le gain net dépasse le bruit. Conserver le backend simple si le gain est marginal et la distribution devient beaucoup plus complexe.

Proposition de trajectoire, à valider : oracles Python, prototype worker, noyau compact portable, comparaison natif/WASM, puis backend supplémentaire seulement sur bénéfice démontré. Python ne devient pas une dépendance du rendu parce qu'il sert aux tests ; le moteur ne doit pas lancer un interpréteur par image.

Les versions, options de compilation, bibliothèques choisies, architectures et fonctionnalités disponibles sont enregistrées avec chaque résultat. La vitesse, la compatibilité et le domaine de support restent `not-run` jusqu'à cette campagne.
