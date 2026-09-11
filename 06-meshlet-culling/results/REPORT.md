# Rapport du Banc : 06-meshlet-culling

**Date :** 2026-09-11T19:42:41.232Z  
**Statut :** `INTEGRATE`  
**Meshlets soumis :** 8  
**Meshlets visibles :** 4  
**Taux de rejet global :** 50.0%

---

## 1. Décomposition des Rejets par Test

| Test | Meshlets Éliminés | Part Relative | Observation |
|---|---|---|---|
| **Frustum** | 0 | 0.0% | Élimine les clusters hors champ |
| **Backface (Cône)** | 4 | 50.0% | Élimine les faces arrière sans rasterisation |
| **Sub-pixel** | 0 | 0.0% | Élimine les clusters dont la projection < 2 px |
| **TOTAL** | **4** | **50.0%** | **Gain direct sur la rasterisation résiduelle** |

---

## 2. Invariants Validés
- **Conservation stricte :** Aucun faux négatif sur la face avant orientée vers la caméra.
- **Décomposition rigoureuse :** Métriques séparées pour frustum, cone et sub-pixel.
- **latest.json conforme :** Enregistré dans `06-meshlet-culling/results/latest.json`.
