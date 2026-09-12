# Principes du Render Tech Lab

Ce document est la source canonique de la méthodologie, des règles de preuve et de l’architecture des bancs.

Le Lab est l’environnement de preuve, de comparaison et d’amélioration continue du moteur de rendu. Il produit des décisions révisables à partir d’exécutions reproductibles ; une démonstration, une constante, un oracle CPU ou une estimation ne devient jamais une mesure physique.

1. **Provenance réelle.** Tout chiffre publié conserve la configuration, le matériel, le navigateur, la résolution, la révision des sources, le protocole et les données brutes. Une valeur indisponible reste `null` ou `not-run`.
2. **Comparaisons équivalentes.** Les variantes utilisent la même scène, la même caméra, le même trajet, la même résolution, les mêmes phases d’échauffement et de mesure. Toute différence de backend ou de capacité est déclarée et limite la conclusion.
3. **Limites explicites.** Les contrôles de correction, les performances, les métriques dérivées et les observations visuelles sont distingués. Un échec, un arrêt ou un rejet archivé reste consultable sans remplacer le dernier résultat valide.
6. **Algorithmes remplaçables.** Une technique est une variante derrière un contrat mesurable. Les sélecteurs et rapports acceptent plusieurs moteurs sans coder une opposition A/B permanente.
7. **Observabilité.** Les étapes, compteurs, capacités absentes, erreurs, temps CPU/GPU et coûts mémoire sont visibles avec leur provenance. Une vue de diagnostic déclare son coût et reste exclue des mesures officielles sauf scénario dédié.
8. **Avant/après et golden.** Une optimisation exige un benchmark avant/après comparable et un contrôle golden de correction. La performance seule ne compense jamais une régression d’image ou de géométrie.
9. **Petits budgets.** Chaque architecture est évaluée sur des GPU, CPU et budgets mémoire modestes. Les caches sont bornés, les charges configurables et les modes dégradés explicites.

## Contrat avec Web Geometry

Les [principes du produit](../../webGeometry/docs/architecture/PRINCIPES_DU_PRODUIT.md) possèdent les exigences de core portable, préparation versionnée, capacités et repli transparent. Le Lab doit en vérifier les garanties dans ses campagnes et conserver les limites de chaque test ; il n’en maintient aucune seconde spécification.

Le dépôt autonome `/Users/pasquelin/Applications/webGeometry` contient désormais les sources réelles et les exports du SDK. Le projet principal du Lab consomme désormais ses exports publics via une dépendance locale. Le banc 15 propose l’exploration Emerald Square séparément des campagnes de la fixture procédurale ; le contrôle A/A de la ville complète continue de bloquer ses mesures comparatives. Les builds/tests autonomes et la validation du consommateur restent des gates distincts.

## État borné du banc 15

Le préparateur Rust existe comme bibliothèque et CLI compilées et exécutées, avec préparation native interne et cache. La preuve physique actuelle porte sur une tranche Emerald Square de 149 998 triangles chargée dans Chrome : deux poses ont satisfait le contrôle pixel exact, quatre blocs ont été mesurés et les diagnostics beauty, wireframe, clusters, LOD, erreur et pages fonctionnent sur cette fixture. La ville complète est visible, mais son contrôle strict A/A reste instable : ses mesures complètes sont donc bloquées et le banc 15 n'est pas validé dans son ensemble. Restent ouverts l'extraction des ports et étapes injectables, la simplification et l'éviction générales, l'intégration native et la CI de performance multiplateforme.

Les formats et exigences des rapports sont définis dans [`CONTRATS_DONNEES_ET_TESTS.md`](CONTRATS_DONNEES_ET_TESTS.md#9-contrat-des-résultats).

## Structure des bancs 00–15

Chaque banc expose `index.ts` et un `manifest.ts` de métadonnées sans initialisation de moteur. Ses contrats résident dans `contracts.ts`, les scénarios dans `scenarios/`, l’exécution dans `runner/`, les internes dans `implementation/`, la documentation dans `docs/` et les tests dans `tests/`. Les fixtures et outils d’assets occupent `fixtures/` et `assets/` lorsqu’ils existent. Les pages HTML à la racine conservent les routes. Les reporters et charts spécifiques restent dans `runner/` lorsqu’un banc en possède.

Le registre `src/lab/manifests.ts` couvre exactement 00–15. Les imports de `src/lab` et les dépendances entre bancs passent par les entrées publiques. Les contrats communs, l’orchestration et les archives résident respectivement dans `shared/contracts`, `shared/benchmark` et `shared/archive`. Aucun relais de compatibilité ni ancien dossier `benchmark/`, `baseline/` ou `common/` ne subsiste dans un banc. `npm run test:structure` protège ces règles et charge les seize API publiques sans navigateur.

Les résultats et archives existants restent à leurs emplacements. Un `latest.json` créé faute de fichier historique indique explicitement `not-run` et ne remplace pas les résultats comparatifs existants. La migration structurelle ne constitue aucune nouvelle preuve de performance.
