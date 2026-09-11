# Hypothèse R&D : 02-gpu-frustum-culling

## Hypothèse Formelle
L'évaluation géométrique de l'intersection entre le volume de visibilité (frustum de 6 plans) et la sphère englobante de chaque objet peut être parallélisée massivement sur les cœurs de calcul du GPU via un Compute Shader WGSL.

## Prédiction de Gain
1. Réduction du temps de soumission CPU de plus de $80\%$ dès $1\,000$ objets.
2. Élimination des stalls CPU liés au parcours récursif du graphe de scène.
3. Crossover rentable : le surcoût de dispatch WGSL devient inférieur au coût d'itération CPU à partir de $1\,000$ instances.

## Critères d'Arbitrage des 3 Décisions
- **`INTEGRATE`** : Gain de soumission $\ge 70\%$ sous charge $\ge 2\,000$ objets sans dégradation du frame time GPU.
- **`WATCHLIST`** : Gain mesuré uniquement sur GPU discret haut de gamme, non reproductible sur GPU intégré.
- **`REJECT`** : Overhead d'encodage du compute pass supérieur au gain CPU sur toute la plage de charge.
