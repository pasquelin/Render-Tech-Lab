# Hypothèse R&D : 09-gpu-compaction

## Hypothèse
Le parallel prefix scan (Blelloch) surpasse l'atomicAdd au-delà de 50 000 instances soumises.

## Question de Mesure
Quelle méthode de compaction de liste visible résiste le mieux à l'explosion de charge et à la concurrence des threads ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
