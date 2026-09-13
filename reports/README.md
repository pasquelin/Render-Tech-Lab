# Rapports et synthèses d’arbitrage R&D

Ce dossier rassemble les rapports d’arbitrage consolidés, les graphes de comparaison et les décisions architecturales (acceptées, rejetées ou en observation).

> **Règle de provenance :** Tout chiffre publié conserve sa configuration, son matériel, son navigateur et ses données brutes. Une estimation, un oracle CPU ou une valeur historique non vérifiée ne remplace jamais une mesure physique. Les nouvelles campagnes physiques sont archivées dans `benchmark-runs/measurements/` et `results/latest.json`.

---

## Index des rapports

| Banc | Sujet de recherche | Statut / Décision | Rapport |
|---|---|---|---|
| **`01-indirect-draw`** | Indirect Draw (1 draw call) & crossover baseline Three.js | `[RE-MEASURE]` | [01-indirect-draw.md](01-indirect-draw.md) |
| **`02-gpu-frustum-culling`** | Compute WGSL frustum culling (plan/sphère) & compaction | `[IMPLEMENTED / RE-MEASURE]` | [02-gpu-frustum-culling.md](02-gpu-frustum-culling.md) |
| **`03-gpu-scene`** | Scène GPU hétérogène (buffers Objet, Géométrie, Matériau, Draw) | `[RE-MEASURE]` | [03-gpu-scene.md](03-gpu-scene.md) |
| **`04-gpu-lod`** | Décimation SSE (meshoptimizer) & sélection LOD CPU/GPU | `[RE-MEASURE]` 04A/04B | [04-gpu-lod-comparison.md](04-gpu-lod-comparison.md) |
| **`05-meshlets`** | Partitionnement en clusters (64, 128, 256, 512 tris) & overhead | `[NOT IMPLEMENTED / NOT RUN]` | [05-meshlets.md](05-meshlets.md) |
| **`06-meshlet-culling`** | Culling frustum / cône normal / sous-pixel & taux de rejet | `[NOT IMPLEMENTED / NOT RUN]` | [06-meshlet-culling.md](06-meshlet-culling.md) |
| **`07-hiz`** | Pyramide de profondeur Hi-Z (mip 0 → N) & coût de génération | `[NOT IMPLEMENTED / NOT RUN]` | [07-hiz.md](07-hiz.md) |
| **`08-occlusion-culling`** | Occlusion Hi-Z sous 10 % à 99 % & équation du gain net | `[NOT IMPLEMENTED / NOT RUN]` | [08-occlusion-culling.md](08-occlusion-culling.md) |
| **`09-gpu-compaction`** | Compactage de listes visibles (1-thread / atomique / scan) | `[IMPLEMENTED / RE-MEASURE]` | [09-gpu-compaction.md](09-gpu-compaction.md) |
| **`10-material-batching`** | Matérialisation (switch / storage buffer / texture array) | `[NOT IMPLEMENTED / NOT RUN]` | [10-material-batching.md](10-material-batching.md) |
| **`11-geometry-streaming`** | Résidence VRAM & cycle de vie sous pression mémoire | `[NOT IMPLEMENTED / NOT RUN]` | [11-geometry-streaming.md](11-geometry-streaming.md) |
| **`12-visibility-buffer`** | Visibility buffer 32 bits & deferred shading barycentrique | `[NOT IMPLEMENTED / NOT RUN]` | [12-visibility-buffer.md](12-visibility-buffer.md) |
| **`15-virtualized-integration`** | Intégration géométrie virtualisée (Emerald Square & tranche 149k) | `[PARTIAL PHYSICAL VALIDATION]` | [15-virtualized-integration.md](15-virtualized-integration.md) |

---

## Format d'un rapport d'arbitrage

Chaque rapport formalise :
1. **Le problème produit réel** observé sur le terrain ou sur le banc S0–S5.
2. **La comparaison de performance** (baseline Three.js vs prototype mesuré).
3. **Le ratio gain / coût** (complexité d'intégration, empreinte VRAM/CPU).
4. **La décision formelle** (intégration au moteur, rejet motivé, ou maintien en liste d'observation).
