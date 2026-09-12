# Banc de test — 05-meshlets

**Question gouvernante :** Quelle granulométrie de sous-maillage offre le meilleur équilibre entre granularité de culling et explosion des métadonnées ?

**Statut actuel :** `not-implemented` — aucun benchmark réel n'a été exécuté sur ce banc. Aucune valeur n'est mesurée ni prévue : la structure ci-dessous est le cahier des charges.

---

## 1. Hypothèse testée

Le banc compare plusieurs tailles de clusters sur CPU. L'efficacité des workgroups WGSL et la bande passante VRAM restent à mesurer sur une implémentation GPU réelle.

> Cette hypothèse n'est pas vérifiée. Elle est enregistrée pour que la mesure (quand elle aura lieu) la confronte directement dans la suite.

## 2. Paliers de charge

| Palier | Triangles par meshlet |
|---|---|
| T-64 | 64 |
| T-128 | 128 |
| T-256 | 256 |
| T-512 | 512 |

Chaque palier du banc exécuté (`test_meshlets.ts`) s’applique à `shared/fixtures/sphere.ts` (sphère dense). Les fixtures cube/stress ne sont plus dans le dépôt.

## 3. Scénario de référence minimal

```text
fixture     : sphere (createSphereMesh)  [shared/fixtures/sphere.ts]
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
