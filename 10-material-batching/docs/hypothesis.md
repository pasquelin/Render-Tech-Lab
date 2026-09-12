# Hypothèse R&D : 10-material-batching

## Hypothèse
L'utilisation d'un MaterialStorageBuffer avec indexation dynamique élimine tous les changements de pipelines.

## Question de Mesure
Quelle stratégie de matérialisation minimise réellement le coût CPU / GPU / mémoire dans l'environnement WebGPU ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
