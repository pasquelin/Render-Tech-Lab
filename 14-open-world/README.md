# 14 · Monde ouvert sous pression

Scène urbaine réelle Bistro extérieur, répétée en 1, 9 ou 25 quartiers, sans réduction de triangles ou de textures entre les variantes. Le scénario est entièrement résident : il ne mesure pas encore le streaming géographique.

## Utilisation

Préparer l'asset avec la recette [ASSET.md](ASSET.md), démarrer le projet avec `npm run dev`, puis ouvrir [le banc local](http://localhost:5174/14-open-world/index.html). Le lien « 14 · Monde ouvert sous pression » est également présent dans le laboratoire.

Le parcours 3D permet de regarder la même scène en mode brut, culling Three.js ou filtrage des quartiers. « Arrêter » interrompt l'aperçu ou la campagne. Une nouvelle campagne peut charger plus d'un gigaoctet de modèle et décoder ses textures ; le temps de préparation est séparé du rendu mesuré.

## Comparaisons

1. **Brut contre culling Three.js** : mesure l'effet d'une technique classique en conservant exactement la géométrie, les matériaux, les ombres et la caméra. Ce n'est pas une découverte ni une preuve de supériorité sur les formules existantes du projet.
2. **Culling Three.js contre filtrage des quartiers** : variante candidate qui rejette un quartier seulement si sa sphère englobante est hors de la caméra et de toutes les vues d'ombre prises en charge. Three.js continue de tester les meshes des quartiers conservés. Une grande vue d'ombre peut conserver tous les quartiers et annuler le bénéfice attendu.

Les bornes des quartiers sont valables pour cette géométrie statique. La caméra se déplace ; les bâtiments restent à la pose déclarée dans le manifeste. Un déplacement ou une déformation des bâtiments exige une mise à jour des bornes et une nouvelle validation.

## Protocole

- Même asset local et empreinte SHA-256, mêmes positions, lumière, parcours, résolution physique et options pour A/B.
- Référence A/A puis A/B : comparaison de tous les canaux de l'image à trois poses prédéfinies, avant mesure. Une différence rejette la campagne de performance ; elle reste archivée.
- Ordre A/B/B/A, 30 images d'échauffement puis 120 images mesurées par bloc. Deux campagnes par défaut ; choix Full HD, 1440p, 4K et Full HD avec ratio 2 à dimensions physiques constantes.
- Temps CPU, cadence rAF, queries GPU si disponibles. Un temps GPU indisponible reste nul, jamais remplacé par une estimation. La cadence rAF n'est pas une mesure de présentation physique.
- Triangles source, principaux et d'ombres séparés. Les clones partagent leurs géométries/textures : le nombre de triangles source répétés ne mesure pas la quantité de géométrie unique stockée en mémoire.
- Empreintes des sources avant/après : une modification pendant la campagne rend les mesures non recevables. Versions, matériel, configuration et données brutes sont conservés.

## Conservation des preuves

Les campagnes sont écrites dans `results/comparisons/<identifiant>.json` et `.md`, avec le texte des sources du test dans `.sources.json`. Le GLB volumineux est identifié par son empreinte et sa recette, sans être dupliqué dans chaque archive. `results/COMPARISON.md`, `results/comparison-latest.json` et `reports/14-open-world.md` exposent la dernière campagne. L'historique de la page donne accès aux précédentes.

Les tests d'archivage et de provenance s'exécutent avec `npm run test:comparison`. Ils ne remplacent pas les campagnes GPU dans le navigateur. `npm run build` vérifie l'intégration et construit cette page.

## Critères de décision

Comparer d'abord les contrôles de qualité et la stabilité des sources, puis les répétitions à configuration identique. La réduction du travail soumis ne suffit pas à annoncer une amélioration de fluidité : examiner GPU, cadence et p95. Un seul appareil ne certifie ni tous les ordinateurs de moins de cinq ans ni les petites machines.

Pour accepter une variante dans la documentation générale, il reste nécessaire de couvrir les fonctionnalités concernées, les résolutions, les mouvements, les ombres et les plateformes visées. Ce banc fournit des preuves bornées et reproductibles, pas une certification globale automatique.
