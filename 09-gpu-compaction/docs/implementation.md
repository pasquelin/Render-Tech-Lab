# 09-gpu-compaction — Implementation

**Statut :** oracle CPU de justesse exécutable ; variantes GPU et campagne physique non implémentées.

## 1. Périmètre

- 3 variantes à comparer (sans préjuger du meilleur) :
  - **A** `one-thread-per-command` : 1 thread par commande, aucune compaction.
  - **B** `atomicAdd` : compaction atomique globale.
  - **C** `parallel-prefix-scan` : Blelloch / Hillis–Steele par workgroup.

## 2. Oracle actuellement exécutable

```text
input : Uint8Array (visibleFlags, N entries)
        │
        ▼
[09A] one-thread-per-command  ─┐
[09B] atomicAdd               ─┼─►  compactedIndices[]  +  CompactionOutput
[09C] parallel-prefix-scan   ─┘
```

## 3. Règle d'arbitrage

| Verdict | Condition |
|---|---|
| `INTEGRATE` | Variante la plus rapide sur 3 des 4 paliers, sans régression sur les autres |
| `REJECT`    | Variante systématiquement la plus lente sur les 4 paliers |
| `WATCHLIST` | Variante gagnante seulement aux paliers élevés (100k+) |

Les durées renvoyées par ces fonctions sont uniquement des temps d'oracle CPU. Elles ne servent jamais à arbitrer les variantes GPU.

## 4. Branchement encore requis

- Trois pipelines WebGPU réels avec entrées et sorties identiques.
- Terminaison bornée, timestamps GPU et readback hors zone chronométrée.
- Correctness gate comparant chaque sortie GPU à l'oracle CPU.
- Campagne alternée sur les quatre paliers, avec échec explicite si WebGPU ou les timestamps sont indisponibles.

## 5. Non-fait volontairement

- Compaction multi-GPU / partitionnement entre workgroups.
- Compaction avec ordre stable — pas imposée.
- Compression des données compactées (pas seulement les indices).
