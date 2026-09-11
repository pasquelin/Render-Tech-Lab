# Hypothèse R&D : 11-geometry-streaming

## Hypothèse
Une politique d'éviction LRU prédictive stabilise la mémoire GPU sous un plafond fixe de 512 Mo.

## Question de Mesure
Comment garantir un chargement asynchrone par morceaux sous contrainte stricte de budget VRAM sans saccade ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
