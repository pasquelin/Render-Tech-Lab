# Hypothèse R&D : 07-hiz

## Hypothèse
La génération d'une pyramide Hi-Z par compute shader récursif (mips 1 à N) coûte moins de 0.4 ms pour un viewport 1080p.

## Question de Mesure
Quel est le coût matériel net (en ms GPU et bande passante VRAM) de la construction hiérarchique d'un tampon de profondeur sous WebGPU ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
