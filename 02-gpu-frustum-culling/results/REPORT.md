# Rapport du Banc : 02-gpu-frustum-culling

**Date :** 2026-09-11T20:01:18.256Z  
**Statut :** `INTEGRATE`  
**Verdict :** Le culling frustum sur Compute Shader WGSL élimine les objets hors champ dès la passe GPU avant toute émission de commande indirecte.

---

## 1. Mesures d'échelle & Taux de Culling

| Instances | Visibles | Éliminées | Taux Culling | CPU Traversal | GPU Compute WGSL |
|---|---|---|---|---|---|
| 500 | 300 | 200 | 40.0% | 0.581 ms | 0.042 ms |
| 1000 | 600 | 400 | 40.0% | 0.066 ms | 0.043 ms |
| 2000 | 1200 | 800 | 40.0% | 0.148 ms | 0.046 ms |
| 5000 | 3000 | 2000 | 40.0% | 0.374 ms | 0.055 ms |
| 10000 | 6000 | 4000 | 40.0% | 0.327 ms | 0.070 ms |
| 50000 | 30000 | 20000 | 40.0% | 1.395 ms | 0.190 ms |


---

## 2. Invariants Validés
- **Conservation stricte :** Aucun faux négatif sur les objets tangents ou sécants aux plans.
- **Compaction atomique :** `atomicAdd` sur le compteur d'instances indirect dans le compute shader WGSL.
- **latest.json conforme :** Enregistré dans `02-gpu-frustum-culling/results/latest.json`.
