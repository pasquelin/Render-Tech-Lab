# 09-gpu-compaction — Implementation

**Statut :** `not-implemented` — aucun benchmark réel n'a été exécuté.

## 1. Périmètre

- 3 variantes à comparer (sans préjuger du meilleur) :
  - **A** `one-thread-per-command` : 1 thread par commande, aucune compaction.
  - **B** `atomicAdd` : compaction atomique globale.
  - **C** `parallel-prefix-scan` : Blelloch / Hillis–Steele par workgroup.

## 2. Architecture prévue (NON IMPLÉMENTÉE)

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

## 4. Non-fait volontairement

- Compaction multi-GPU / partitionnement entre workgroups.
- Compaction avec ordre stable — pas imposée.
- Compression des données compactées (pas seulement les indices).
