# Rapport du Banc : 02-gpu-frustum-culling

**Date :** 2026-09-11T19:42:41.166Z  
**Statut :** `INTEGRATE`  
**Verdict :** Le culling frustum sur Compute Shader WGSL élimine les objets hors champ dès la passe GPU avant toute émission de commande indirecte.

---

## 1. Mesures d'échelle & Taux de Culling

| Instances | Visibles | Éliminées | Taux Culling | CPU Traversal | GPU Compute WGSL |
|---|---|---|---|---|---|
| 500 | 300 | 200 | 40.0% | 0.250 ms | 0.042 ms |
| 1000 | 600 | 400 | 40.0% | 0.068 ms | 0.043 ms |
| 2000 | 1200 | 800 | 40.0% | 0.125 ms | 0.046 ms |
| 5000 | 3000 | 2000 | 40.0% | 0.296 ms | 0.055 ms |
| 10000 | 6000 | 4000 | 40.0% | 0.285 ms | 0.070 ms |
| 50000 | 30000 | 20000 | 40.0% | 3.136 ms | 0.190 ms |


---

## 2. Invariants Validés
- **Conservation stricte :** Aucun faux négatif sur les objets tangents ou sécants aux plans.
- **Compaction atomique :** `atomicAdd` sur le compteur d'instances indirect dans le compute shader WGSL.
- **latest.json conforme :** Enregistré dans `02-gpu-frustum-culling/results/latest.json`.
