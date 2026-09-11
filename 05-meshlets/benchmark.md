# Banc de test — 05-meshlets

**Question gouvernante :** Quelle granulométrie de sous-maillage offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?

**Statut actuel :** `not-implemented` — aucun benchmark réel n'a été exécuté sur ce banc. Aucune valeur n'est mesurée ni prévue : la structure ci-dessous est le cahier des charges.

---

## 1. Hypothèse testée

Le partitionnement en clusters de 128 triangles maximise l'efficacité des workgroups WGSL sans pénaliser la bande passante VRAM.

> Cette hypothèse n'est pas vérifiée. Elle est enregistrée pour que la mesure (quand elle aura lieu) la confronte directement dans la suite.

## 2. Paliers de charge

| Palier | Triangles par meshlet |
|---|---|
| T-64 | 64 |
| T-128 | 128 |
| T-256 | 256 |
| T-512 | 512 |

Chaque palier est appliqué sur le maillage témoin `shared/fixtures/stress.ts` (grille `64×64`, 8 192 triangles) et le cube unité (`shared/fixtures/cube.ts`, 12 triangles) pour couvrir le très faible et le très élevé.

## 3. Scénario de référence minimal

```text
fixture     : stress-grid-64x64 (8 192 triangles)  [shared/fixtures]
baseline    : partitionnement naïf (triangles consécutifs par blocs)
prototype   : NON IMPLÉMENTÉ
mesure      : temps de partitionnement, nb meshlets, duplication, mémoire, métadonnées
```

## 4. Métriques obligatoires (Master Test Plan §7-05)

| Métrique | Définition |
|---|---|
| `meshletCount` | Nombre total de meshlets générés |
| `trisPerMeshlet` | Nombre moyen de triangles par meshlet |
| `vertexDupFactor` | Taux de duplication de sommets aux frontières |
| `indexMemoryBytes` | Mémoire du buffer d'indices |
| `metadataMemoryBytes` | Mémoire des métadonnées (sphère + cône + offsets) |
| `buildTimeMs` | Temps de partitionnement CPU |

## 5. Décision attendue

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Palier le plus efficace sans régression prohibitive sur la VRAM et le build time |
| `REJECT` | Surcoût mémoire > 2 × le bénéfice en culling |
| `WATCHLIST` | Gain net non démontré sous WebGPU à cause de la taille de workgroup max |

## 6. Non-fait (volontairement)

- Partitionneur sophistiqué (type meshoptimizer `clusterToMeshOptimization` ou `Simplifier` avancé) : réservé à la phase d'implémentation.
- Hiérarchisation : aucun arbre de clusters.
- Streaming de clusters : non couvert (c'est le banc 11).
