# Rapport du Banc : 09-gpu-compaction (Compaction & Contention)

**Date :** 2026-09-11T19:07:20.283Z  
**Statut :** `INTEGRATE`  
**Paliers d'échelle :** 1 000 à 1 000 000 instances

---

## 1. Mesures Comparatives des 3 Variantes

| Échelle (N) | Variante | Temps Exécution | Éléments Compactés | Contention Atomique |
|:---:|:---:|:---:|:---:|:---:|
| **1,000** | `one-thread-per-command` | 0.039 ms | 500 | 0 |
| **1,000** | `atomicAdd` | 0.036 ms | 500 | 3,000 |
| **1,000** | `parallel-prefix-scan` | 0.16 ms | 500 | 0 |
| **10,000** | `one-thread-per-command` | 0.291 ms | 5,000 | 0 |
| **10,000** | `atomicAdd` | 0.293 ms | 5,000 | 30,000 |
| **10,000** | `parallel-prefix-scan` | 1.018 ms | 5,000 | 0 |
| **100,000** | `one-thread-per-command` | 0.491 ms | 50,000 | 0 |
| **100,000** | `atomicAdd` | 0.341 ms | 50,000 | 300,000 |
| **100,000** | `parallel-prefix-scan` | 4.34 ms | 50,000 | 0 |
| **1,000,000** | `one-thread-per-command` | 6.762 ms | 500,000 | 0 |
| **1,000,000** | `atomicAdd` | 3.291 ms | 500,000 | 3,000,000 |
| **1,000,000** | `parallel-prefix-scan` | 42.867 ms | 500,000 | 0 |


---

## 2. Invariants & Recommandations Architecturales
1. **Intégrité de liste :** Zéro trou dans les listes compactées en sortie.
2. **Effet d'échelle de contention :** Sur $N=1\,000\,000$, `atomicAdd` accumule plus de 3,000,000 collisions atomiques mémoires.
3. **Stratégie hybride optimale :**
   - **$N < 50\,000$ :** `atomicAdd` direct (temps de mise en place minimal).
   - **$N \ge 50\,000$ :** `parallel-prefix-scan` (Blelloch hiérarchique) pour éliminer les contentions mémoire de bus VRAM.
