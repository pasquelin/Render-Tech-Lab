# Hypothèse R&D : 13-full-gpu-driven

## Hypothèse
L'architecture GPU-driven unifiée surpasse Three.js classique d'un facteur 15x à 100 000 instances.

## Question de Mesure
La chaîne complète assemblée produit-elle un gain net supérieur à la somme des complexités et des surcoûts introduits ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
