# Livraison isolée — 12 septembre 2026

Premier jalon livré, architecture virtualisée complète toujours bloquée. Pas de commit, push ou intégration du worktree.

Fichiers propres au jalon :

- `15-virtualized-integration/` : protocole/matrice, contrôle natif, factory runner, tests, harness smoke, documentation et inventaires Model.
- `bench/run_integration.mjs` : smoke et archives, y compris échecs.
- `shared/benchmark/integratedRunners.ts`, `bench/runners.ts`, `bench/integratedRunners.test.ts` : ajout minimal de l'identifiant 15 et factory. Ces fichiers étaient déjà présents non suivis dans le snapshot de départ; reprendre les ajouts ciblés plutôt que remplacer le chantier React.
- `01-indirect-draw/implementation/gpuDrivenRenderer.ts` : readback annulable et prise en charge d'un timer raster seul pour la référence directe; ancien contrat 2 passes conservé.
- `package.json` : `test:integration`, `bench:15`, insertion du test d'intégration dans validate.
- `tsconfig.json` : inclusion du banc 15 et de ses tests.
- `vite.config.ts` : entrée smoke sans mise en page produit.

Vérifications : `npm test` passé; 14 tests ciblés passés; TypeScript passé avec le nouveau dossier inclus; build Vite passé via `--configLoader runner`; smoke Chrome physique sur Apple M2 Max passé, avec timestamps/sans timestamps et annulations verify/measure. Les bundles finaux correspondent aux bundles du dernier smoke. Les erreurs de whitespace de `git diff --check` portent sur les modifications héritées des rapports 03, chart.ts et timing.ts; elles n'ont pas été retouchées.

Les archives sont locales et ignorées : `benchmark-runs/checks/15-*/raw.json`. Le smoke `10-31-55` a été explicitement invalidé (`REVIEW.md`) après découverte de timestamps d'une passe compute vide. Les smokes corrigés `10-33-38` puis `10-39-42` passent. Aucune campagne longue et aucun gain généralisable.

Les dépendances absentes du worktree sont accessibles via un lien `node_modules` ignoré vers celles du checkout; aucun package n'a été installé/modifié. Le build standard voulait écrire le cache Vite dans cette cible partagée, d'où l'utilisation du configLoader runner.

Seule opération demandée hors worktree : déplacement atomique et réversible de l'asset utilisateur depuis `public/EmeraldSquare_v4_1` vers `files_local/emerald-square/EmeraldSquare_v4_1` dans le checkout principal. 360 fichiers, tailles/inodes conservés, ancien chemin absent, destination ignorée. Pas de conversion lourde. Aucun autre fichier du checkout principal modifié par cette tâche.

Pour la suite : construire une véritable hiérarchie de remplacement avec erreur certifiée, cluster raster et coupe complète; relier ensuite pages physiques et occlusion. Model Day convient à la fixture urbaine future, après conversion ATI2/alpha/ORM/normales vérifiée et conditions NC/SA prises en compte. Les chiffres du contrôle résident ne doivent jamais apparaître dans les cases non exécutées de cette matrice.

# Mise à jour — incrément 2

Le premier jalon ci-dessus est dépassé. Consulter CURRENT.md : les trois briques physiques fonctionnent sur une fixture procédurale analytique (hiérarchie non nulle, sélection/raster de clusters, vrai pool de pages avec évictions). Le runner utilise ce chemin par défaut; le précédent reste disponible sous `mode:'resident-control'`.

Ajouts : geometryAsset.ts, physicalPages.ts, clusterGpu.ts, virtualizedCampaign.ts, virtualized.test.ts, presentation.ts, archivePlugin.ts, archive.test.ts, report.ts, CURRENT.md. Raccordements ciblés supplémentaires : src/lab/modules.ts, catalog.ts, canvasVisibility.ts, bootLab.ts, plugin Vite. Ces fichiers src étaient déjà présents non suivis dans le snapshot : préserver les changements du chantier React principal lors de la reprise.

Validation : 22 tests ciblés (incluant la coque et les archives), npm test, TypeScript, build. Smoke physique Chrome/M2 Max : trois scénarios avec/sans timestamps, annulation verify/measure, puis deux lancements par la vraie coque React, archivage et ouverture de rapport. Le smoke du 12 septembre 11:04:07 est passé : 48 évictions physiques dans le scénario sous pression, aucune différence RGBA A/A/B aux poses testées; profondeur et dépassements de budget géométrique des fallbacks explicitement conservés.

Limites : micro-fixture opaque/unlit, pages lues en mémoire CPU, feedback sérialisé et coûteux; pas de campagne de performance ni de généralisation à un modèle catalogue. Les dix catégories représentatives générales restent séparément non exécutées. La réussite de la fixture vaut `procedural-validated`, pas validation d'un moteur général. Aucun commit/push/merge.
