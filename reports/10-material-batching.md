# Rapport du Banc : 10-material-batching (Matérialisation Multi-Matériaux)

**Date :** 2026-09-11T20:01:18.452Z  
**Statut :** `INTEGRATE`  
**Stratégie Retenue :** `storage-buffer` (Indexation dynamique via Material Storage Buffer)

---

## 1. Comparatif des 4 Stratégies sous 2 000 Objets

| Nb Matériaux | A: State-Switch | B: Storage-Buffer | C: Texture-Array | D: Pseudo-Bindless |
|:---:|:---:|:---:|:---:|:---:|
| **1** | 2.103 ms (1 sw) | **0.08 ms (1 sw)** | 0.08 ms (1 sw) | 0.09 ms (1 sw) |
| **10** | 2.13 ms (10 sw) | **0.08 ms (1 sw)** | 0.08 ms (1 sw) | 0.09 ms (1 sw) |
| **50** | 2.25 ms (50 sw) | **0.08 ms (1 sw)** | 0.08 ms (1 sw) | 0.09 ms (1 sw) |
| **100** | 2.4 ms (100 sw) | **0.08 ms (1 sw)** | 0.08 ms (1 sw) | 0.09 ms (1 sw) |
| **500** | 3.6 ms (500 sw) | **0.08 ms (1 sw)** | 0.08 ms (1 sw) | 0.09 ms (1 sw) |


---

## 2. Invariants & Arbitrage
- **Élimination des pipeline state changes :** Le tampon de stockage réduit le nombre de changements de pipeline de $M$ à **1 unique**, éliminant tout goulot CPU de soumission sous charge multi-matériaux.
- **Empreinte VRAM minimale :** 32 octets par matériau, soit seulement 3,2 Ko pour 100 matériaux.
- **latest.json conforme :** Enregistré dans `10-material-batching/results/latest.json`.
