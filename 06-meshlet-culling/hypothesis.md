# Hypothèse R&D : 06-meshlet-culling

## Hypothèse
La combinaison frustum + cône de normale (backface) + sub-pixel élimine plus de 60% des primitives avant la passe de rendu.

## Question de Mesure
Quel volume géométrique précis est éliminé avant rasterisation par cluster culling, et quelle part revient à chaque test ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
