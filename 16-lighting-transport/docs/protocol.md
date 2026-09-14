# Protocole

Les règles de preuve viennent des [principes du Lab](../../docs/PRINCIPES_DU_LAB.md). Les paramètres exécutables résident dans [`LIGHTING_PROTOCOL`](../contracts.ts).

La fixture publique `createLightingScene` du SDK fournit les deux pièces et les trois sources colorées mobiles. Le protocole fixe 1 280 × 720 pixels physiques, DPR 1, une taille de patch de 1,2, 256 rayons par patch, 8 échantillons de reflet et 16 échantillons directs par source. La fixture attendue contient 282 patches et 4 158 triangles source. Ces nombres sont des paramètres et des attentes de structure, pas des mesures de débit.

Les variantes `brute` et `bvh` partagent scène, caméra, matériaux, échantillonnage et solveur. Les changements de porte, de lampes et de caméra sont appliqués dans le même ordre pour chaque contrôle. Les images répétées A/A vérifient la stabilité du rendu ; les images A/B vérifient l'équivalence. Chaque contrôle conserve le nombre de pixels différents et l'erreur maximale par canal. Toute différence rejette les mesures comparatives.

Les blocs mesurés suivent les contrôles, avec 4 images d'échauffement et 12 images mesurées par bloc. Les captures, diagnostics et vérifications restent hors de ces blocs. Le rapport conserve les frames brutes, les paramètres, la provenance et l'environnement de l'exécution.

Le temps du transport CPU, la soumission CPU, le travail total CPU de la frame et le temps GPU sont distincts. Les FPS proviennent uniquement de `1000 / rafDeltaMs` ; une commande de rendu isolée n'a pas de FPS. L'environnement consigne le plafond d'affichage lorsqu'il est mesuré. Une durée GPU indisponible reste `null` et n'est jamais remplacée par une attente de fin de file GPU.
