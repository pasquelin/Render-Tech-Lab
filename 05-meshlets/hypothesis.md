# Hypothèse R&D : 05-meshlets

## Hypothèse
Un partitionnement en clusters de 128 triangles maximise l'efficacité des workgroups WGSL sans pénaliser la bande passante VRAM.

## Question de Mesure
Quelle granulométrie de sous-maillage (cluster) offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?

## Système des 3 Décisions
- **`INTEGRATE`** : Gain net avéré sans régression prohibitive sur la stabilité ou la mémoire.
- **`WATCHLIST`** : Technique en veille en attente du franchissement d'un seuil de charge ou d'évolution WebGPU.
- **`REJECT`** : Surcoût algorithmique supérieur au gain mesuré.
