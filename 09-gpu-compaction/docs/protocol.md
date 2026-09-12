# 09-gpu-compaction — Benchmark

**Question gouvernante :** Quelle méthode de compaction de liste visible résiste le mieux à l'explosion de charge ?

**Statut :** oracle CPU exécutable ; benchmark GPU non implémenté et aucune mesure GPU publiée.

## 1. Variantes comparées (sans préjuger du meilleur)

| ID | Variante | Principe |
|---|---|---|
| **A** | `one-thread-per-command` | 1 thread par commande, aucune compaction — référence non optimisée |
| **B** | `atomicAdd` | Compaction atomique globale via `atomicAdd` |
| **C** | `parallel-prefix-scan` | Algorithme Blelloch / Hillis–Steele par workgroup |

> Aucune variante n'est déclarée « meilleure » : c'est le banc qui doit montrer lequel, si aucun, l'est.

## 2. Paliers d'échelle

| Palier | N (commandes) |
|---|---|
| C-1k   | 1 000 |
| C-10k  | 10 000 |
| C-100k | 100 000 |
| C-1M   | 1 000 000 |

Chaque palier est exécuté **par variante** ; la grille attendue est `3 variants × 4 scales = 12` mesures.

## 3. Métriques obligatoires (Master Test Plan §7-09)

| Métrique | Définition |
|---|---|
| `timeMs` | Temps de compaction GPU (ms) |
| `atomicOperations` | Nombre logique d'opérations atomiques. La contention matérielle exige une mesure GPU séparée. |
| `bandwidth` | Volume de données lues/écrites (proxy de bande passante) |
| `compactedCount` | Taille de la liste compactée |

## 4. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Variante la plus rapide sur 3 des 4 paliers, sans régression sur les autres |
| `REJECT` | Variante systématiquement la plus lente sur les 4 paliers |
| `WATCHLIST` | `atomicAdd` ou `parallel-scan` gagnant seulement à haute échelle (100k+) — technique dépendante de la charge |

## 5. Non-fait volontairement

- Dispatch WebGPU des trois variantes, timestamps GPU et lecture de justesse.

- Compaction multi-GPU / partitionnement du travail entre workgroups.
- Compaction avec ordre stable (pas imposée — la variante choisit son approche).
- Compression des données compactées (pas seulement les indices).
