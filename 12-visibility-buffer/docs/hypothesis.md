# Hypothèse R&D : 12-visibility-buffer

## Hypothèse
La passe de visibilité 32-bit (instanceId + primitiveId) réduit de 65% la bande passante par rapport à un G-Buffer classique.

## Question de Mesure
Le découplage strict entre calcul de visibilité et shading différé apporte-t-il un gain net sur WebGPU face aux scènes denses ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
