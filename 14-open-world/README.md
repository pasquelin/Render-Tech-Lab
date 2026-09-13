# 14 · Monde ouvert sous pression

Banc de **pression WebGL2 résident**, distinct des bancs GPU-driven 00–13. Scène urbaine réelle Bistro extérieur, répétée en 1, 9 ou 25 quartiers, sans réduction de triangles ou de textures entre les variantes. Le scénario est entièrement résident : il ne mesure pas le streaming géographique.

Aucune des variantes testées n’est une optimisation adoptée. Le goulot observé sur Bistro × 9 avec ombres est la soumission WebGL (dizaines de ms CPU), pas les tests de plans.

## Utilisation

Préparer l'asset avec la recette [ASSET.md](docs/asset.md), démarrer le projet avec `npm run dev`, puis ouvrir [le banc local](http://localhost:5174/14-open-world/index.html). Le lien « 14 · Monde ouvert sous pression » est également présent dans le laboratoire.

Le parcours 3D permet de regarder la même scène en mode brut, culling Three.js ou variante B. L’aperçu suit une fois le parcours puis se termine à la durée configurée ; « Arrêter » l’interrompt explicitement. La dernière image valide et les derniers relevés restent visibles. Une nouvelle campagne peut charger plus d'un gigaoctet de modèle et décoder ses textures ; le temps de préparation est séparé du rendu mesuré.

Le canvas occupe toute la zone de scène. En aperçu, son drawing buffer et la caméra suivent le ratio du conteneur, donc la scène n’est pas déformée. Pendant une campagne, le drawing buffer reste strictement à la résolution physique choisie ; la présentation utilise un cadrage `cover`, qui peut rogner les bords dans une zone de ratio différent sans modifier les pixels mesurés.

## API d’intégration de la coque

`startWorldPreview` accepte après `onError` un callback `onComplete({ reason, elapsedMs, error? })`. `reason` vaut `duration`, `manual`, `cancelled` ou `error`. Le callback est émis une seule fois. Le callback optionnel suivant reçoit la progression structurée.

`runWorldComparison` accepte après `onMetrics` un callback de progression structurée. Chaque événement contient `phase`, `message`, et selon la phase `completed`, `total`, `unit` et `assetBytes`. Les phases sont : téléchargement, décodage, préparation, contrôle qualité, échauffement commun, échauffement de bloc, mesure, drainage GPU, fin ou annulation. L’archivage reste piloté par la coque après le retour du rapport et doit être affiché comme une phase UI distincte.

## Protocole canonique

Pour comparer deux campagnes entre elles, figer au minimum :

| Paramètre | Valeur |
|---|---|
| Résolution | 1920×1080, ratio de rendu 1 |
| Quartiers | 9 |
| Ombres | activées, 2048² |
| FOV / parcours / lissage | 60° / mixte / désactivé |
| Images / échauffement | 120 / 30 |
| Répétitions | 2 (ABBA puis BAAB) |
| Variante B par défaut | culling adaptatif · visibilité certifiée |

Changer un facteur produit une autre configuration ; ne pas agréger 1024² avec 2048², ni 120 images avec 480.

## Comparaisons

1. **Brut contre culling Three.js** : mesure l'effet d'une technique classique en conservant exactement la géométrie, les matériaux, les ombres et la caméra.
2. **Culling Three.js contre filtrage des quartiers** : un quartier n’est rejeté que s’il est hors de la caméra **et** de toutes les vues d’ombre. Une carte d’ombre qui couvre tout le décor conserve tous les quartiers.
3. **Culling adaptatif · dernier plan rejetant** : mêmes sphères monde, mêmes six prédicats, ordre des plans seulement.
4. **Culling adaptatif · visibilité certifiée** : borne de Cauchy-Schwarz sur la variation des plans ; une marge strictement positive réutilise la visibilité, sinon les tests exacts sont refaits. Les rejets sont toujours retestés.
5. **Ombres statiques / matrices statiques** : réutilisation uniquement sur ce décor immobile. Une transformation, une lumière ou un matériau qui change exige une invalidation, non validée ici.

Les bornes des quartiers sont valables pour cette géométrie statique. Un déplacement ou une déformation des bâtiments exige une mise à jour des bornes et une nouvelle validation.

## Protocole de mesure

- Même asset local et empreinte SHA-256, mêmes positions, lumière, parcours, résolution physique et options pour A/B.
- Référence A/A puis A/B : comparaison de tous les canaux de l'image à trois poses prédéfinies, y compris l’écart A/A. Une différence rejette la campagne de performance ; elle reste archivée.
- Les variantes adaptatives rejouent ensuite tout le parcours (hors chronométrage) et comparent chaque masque de layer à `intersectsObject`.
- Ordre A/B/B/A puis B/A/A/B. 30 images d’échauffement commun, puis 30 par bloc, puis 120 images mesurées.
- Temps CPU, cadence rAF, queries GPU si disponibles. Un temps GPU indisponible reste `null`, jamais remplacé par 0. La cadence rAF n'est pas une mesure de présentation physique.
- Triangles source, principaux et d'ombres séparés. Les clones partagent leurs géométries/textures.
- Empreintes des sources avant/après : une modification pendant la campagne archive le rapport **sans** le publier comme dernière campagne.

## Conservation des preuves

Chaque campagne est un paquet autonome dans `reports/14-open-world/campaign-<identifiant>/` : `REPORT.md` pour la lecture, données JSON compressées, journaux moteur et sources capturées. Le GLB volumineux est identifié par son empreinte et sa recette, sans être dupliqué. `reports/14-open-world/latest.json` référence seulement la dernière campagne **publiée** (sources stables) ; l'historique donne accès aux précédentes, y compris les rejets.

Les tests d'archivage et de provenance s'exécutent avec `npm run test:comparison` (`npm run test:world` pour les oracles du banc 14). Ils ne remplacent pas les campagnes GPU dans le navigateur. `npm run build` vérifie l'intégration et construit cette page.

## Critères de décision

Comparer d'abord les contrôles de qualité, l’oracle de visibilité et la stabilité des sources, puis les répétitions ABBA/BAAB à configuration identique. La réduction du travail soumis ne suffit pas à annoncer une amélioration de fluidité : examiner GPU, cadence et p95. Un seul appareil ne certifie ni tous les ordinateurs de moins de cinq ans ni les petites machines.

Pour accepter une variante dans la documentation générale, il reste nécessaire de couvrir les fonctionnalités concernées, les résolutions, les mouvements, les ombres et les plateformes visées. Ce banc fournit des preuves bornées et reproductibles, pas une certification globale automatique.

## Source layout

Public API: [index.ts](index.ts); metadata: [manifest.ts](manifest.ts); contracts: [contracts.ts](contracts.ts). See [migration](docs/migration.md), [hypothesis](docs/hypothesis.md), [protocol](docs/protocol.md) and [limits](docs/limits.md). Canonical runner sources are under `runner/`, scenario metadata under `scenarios/`, and boundary tests under `tests/`. Compatibility forwarding modules have been removed.
