# Hypothèse R&D : 08-occlusion-culling

## Hypothèse
Le crossover de rentabilité Hi-Z intervient dès 40% d'occlusion géométrique dans la scène.

## Question de Mesure
À partir de quel seuil d'occlusion le culling Hi-Z compense-t-il son propre surcoût de génération et de test ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
